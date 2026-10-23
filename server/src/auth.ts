import { createHash } from 'node:crypto'
import { getCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import { pool } from './db.js'

export const ROLES = ['admin', 'editor', 'viewer'] as const
export type Role = (typeof ROLES)[number]

export type User = { id: string; name: string; role: Role }
export type Env = { Variables: { user: User | null } }

export const SESSION_COOKIE = 'sid'
export const SESSION_DAYS = 30

// 權限由低到高：viewer < editor < admin，高的角色包含低的角色能做的事
const RANK: Record<Role, number> = { viewer: 0, editor: 1, admin: 2 }

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

export function hasRole(user: User | null, role: Role) {
  return !!user && RANK[user.role] >= RANK[role]
}

// cookie 存原始 token，資料庫只存雜湊；資料庫外洩時無法直接拿來登入
export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

// 每個請求都解析 session cookie，結果放在 c.var.user（未登入為 null）
// 停用的帳號視同未登入
export const session = createMiddleware<Env>(async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE)
  let user: User | null = null
  if (token) {
    const { rows } = await pool.query<User>(
      `SELECT u.id, u.username AS name, u.role
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > now() AND u.disabled_at IS NULL`,
      [hashToken(token)],
    )
    user = rows[0] ?? null
  }
  c.set('user', user)
  await next()
})

export const requireAuth = createMiddleware<Env>(async (c, next) => {
  if (!c.var.user) return c.json({ error: '請先登入' }, 401)
  await next()
})

// 未登入回 401，角色不足回 403
export function requireRole(role: Role) {
  return createMiddleware<Env>(async (c, next) => {
    if (!c.var.user) return c.json({ error: '請先登入' }, 401)
    if (!hasRole(c.var.user, role)) return c.json({ error: '沒有權限' }, 403)
    await next()
  })
}

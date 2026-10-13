import { createHash } from 'node:crypto'
import { getCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import { pool } from './db.js'

export type User = { id: string; name: string }
export type Env = { Variables: { user: User | null } }

export const SESSION_COOKIE = 'sid'
export const SESSION_DAYS = 30

// cookie 存原始 token，資料庫只存雜湊；資料庫外洩時無法直接拿來登入
export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

// 每個請求都解析 session cookie，結果放在 c.var.user（未登入為 null）
export const session = createMiddleware<Env>(async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE)
  let user: User | null = null
  if (token) {
    const { rows } = await pool.query<User>(
      `SELECT u.id, u.username AS name
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > now()`,
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

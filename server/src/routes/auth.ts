import { randomBytes } from 'node:crypto'
import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { SESSION_COOKIE, SESSION_DAYS, hashToken, requireAuth, type Env } from '../auth.js'
import { pool } from '../db.js'
import { passwordError } from '../lib/account.js'
import { readBody } from '../lib/http.js'
import { hashPassword, verifyPassword } from '../lib/password.js'

export const authRoutes = new Hono<Env>()

authRoutes.post('/login', async (c) => {
  const body = await readBody(c)
  const username = typeof body.username === 'string' ? body.username.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!username || !password) return c.json({ error: '請輸入帳號與密碼' }, 400)

  const { rows } = await pool.query<{
    id: string
    username: string
    role: string
    password_hash: string
    disabled: boolean
  }>(
    `SELECT id, username, role, password_hash, disabled_at IS NOT NULL AS disabled
     FROM users WHERE username = $1`,
    [username],
  )
  const user = rows[0]
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return c.json({ error: '帳號或密碼錯誤' }, 401)
  }
  // 密碼正確才告知已停用，不讓別人用來猜測帳號狀態
  if (user.disabled) return c.json({ error: '此帳號已停用，請聯絡管理員' }, 403)

  const token = randomBytes(32).toString('base64url')
  await pool.query(
    `INSERT INTO sessions (token_hash, user_id, expires_at)
     VALUES ($1, $2, now() + make_interval(days => $3::int))`,
    [hashToken(token), user.id, SESSION_DAYS],
  )
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  })
  return c.json({ user: { name: user.username, role: user.role } })
})

authRoutes.post('/logout', async (c) => {
  const token = getCookie(c, SESSION_COOKIE)
  if (token) await pool.query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)])
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
  return c.body(null, 204)
})

authRoutes.get('/me', (c) => {
  const user = c.var.user
  return c.json({ user: user && { name: user.name, role: user.role } })
})

// 修改自己的密碼；成功後其他裝置的 session 都會登出，目前這個保留
authRoutes.post('/password', requireAuth, async (c) => {
  const body = await readBody(c)
  const current = typeof body.currentPassword === 'string' ? body.currentPassword : ''
  const next = typeof body.newPassword === 'string' ? body.newPassword : ''
  const invalid = passwordError(next)
  if (invalid) return c.json({ error: invalid }, 400)

  const user = c.var.user!
  const { rows } = await pool.query<{ password_hash: string }>(
    'SELECT password_hash FROM users WHERE id = $1',
    [user.id],
  )
  if (!(await verifyPassword(current, rows[0]!.password_hash))) {
    return c.json({ error: '目前的密碼不正確' }, 400)
  }

  const token = getCookie(c, SESSION_COOKIE)!
  await pool.query('UPDATE users SET password_hash = $2 WHERE id = $1', [user.id, await hashPassword(next)])
  await pool.query('DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2', [user.id, hashToken(token)])
  return c.body(null, 204)
})

import { randomBytes } from 'node:crypto'
import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { SESSION_COOKIE, SESSION_DAYS, hashToken, type Env } from '../auth.js'
import { pool } from '../db.js'
import { readBody } from '../lib/http.js'
import { verifyPassword } from '../lib/password.js'

export const authRoutes = new Hono<Env>()

authRoutes.post('/login', async (c) => {
  const body = await readBody(c)
  const username = typeof body.username === 'string' ? body.username.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!username || !password) return c.json({ error: '請輸入帳號與密碼' }, 400)

  const { rows } = await pool.query<{ id: string; username: string; password_hash: string }>(
    'SELECT id, username, password_hash FROM users WHERE username = $1',
    [username],
  )
  const user = rows[0]
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return c.json({ error: '帳號或密碼錯誤' }, 401)
  }

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
  return c.json({ user: { name: user.username } })
})

authRoutes.post('/logout', async (c) => {
  const token = getCookie(c, SESSION_COOKIE)
  if (token) await pool.query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)])
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
  return c.body(null, 204)
})

authRoutes.get('/me', (c) => {
  const user = c.var.user
  return c.json({ user: user && { name: user.name } })
})

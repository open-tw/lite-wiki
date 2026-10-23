import { Hono } from 'hono'
import { isRole, requireRole, type Env } from '../auth.js'
import { pool } from '../db.js'
import { passwordError, usernameError } from '../lib/account.js'
import { isUniqueViolation, readBody, toPositiveInt } from '../lib/http.js'
import { hashPassword } from '../lib/password.js'

// 帳號管理，只有 admin 能用
// 不提供刪除：修訂紀錄與上傳都引用作者，不再使用的帳號改為停用
export const userRoutes = new Hono<Env>()

userRoutes.use(requireRole('admin'))

const USER_COLUMNS = `id, username, role, disabled_at IS NOT NULL AS disabled, created_at AS "createdAt"`

userRoutes.get('/', async (c) => {
  const { rows } = await pool.query(`SELECT ${USER_COLUMNS} FROM users ORDER BY id`)
  return c.json(rows)
})

userRoutes.post('/', async (c) => {
  const body = await readBody(c)
  const username = typeof body.username === 'string' ? body.username.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const role = body.role ?? 'editor'
  const invalid = usernameError(username) ?? passwordError(password)
  if (invalid) return c.json({ error: invalid }, 400)
  if (!isRole(role)) return c.json({ error: 'role 必須是 admin、editor 或 viewer' }, 400)

  try {
    const { rows } = await pool.query(
      `INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING ${USER_COLUMNS}`,
      [username, await hashPassword(password), role],
    )
    return c.json(rows[0], 201)
  } catch (err) {
    if (isUniqueViolation(err)) return c.json({ error: '帳號已存在' }, 409)
    throw err
  }
})

// 修改角色、停用／啟用、重設密碼；欄位都是選填，只改有送的
// 停用或重設密碼後，該帳號已登入的 session 全部失效
userRoutes.patch('/:id', async (c) => {
  const id = toPositiveInt(c.req.param('id'))
  if (id === null) return c.json({ error: '找不到帳號' }, 404)
  const body = await readBody(c)
  const { role, disabled, password } = body
  if (role !== undefined && !isRole(role)) return c.json({ error: 'role 必須是 admin、editor 或 viewer' }, 400)
  if (disabled !== undefined && typeof disabled !== 'boolean') {
    return c.json({ error: 'disabled 必須是布林值' }, 400)
  }
  if (password !== undefined) {
    const invalid = typeof password === 'string' ? passwordError(password) : '密碼必須是字串'
    if (invalid) return c.json({ error: invalid }, 400)
  }
  // 不能改自己的角色或停用自己，避免把自己鎖在外面；自己的密碼用 /auth/password 修改
  if (String(id) === c.var.user!.id && (role !== undefined || disabled !== undefined)) {
    return c.json({ error: '不能變更自己的角色或停用自己' }, 400)
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // 鎖住所有有效的 admin：兩位 admin 同時互相降級或停用時，後到的會看到自己已不是 admin
    // 加上不能改自己，任何時候都至少保留一位有效的 admin
    const admins = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE role = 'admin' AND disabled_at IS NULL FOR UPDATE`,
    )
    if (!admins.rows.some((r) => r.id === c.var.user!.id)) {
      await client.query('ROLLBACK')
      return c.json({ error: '沒有權限' }, 403)
    }

    const { rows } = await client.query(
      `UPDATE users SET
         role = COALESCE($2, role),
         disabled_at = CASE WHEN $3::boolean IS NULL THEN disabled_at
                            WHEN $3 THEN COALESCE(disabled_at, now())
                            ELSE NULL END,
         password_hash = COALESCE($4, password_hash)
       WHERE id = $1
       RETURNING ${USER_COLUMNS}`,
      [id, role ?? null, disabled ?? null, typeof password === 'string' ? await hashPassword(password) : null],
    )
    if (!rows[0]) {
      await client.query('ROLLBACK')
      return c.json({ error: '找不到帳號' }, 404)
    }
    if (disabled === true || password !== undefined) {
      await client.query('DELETE FROM sessions WHERE user_id = $1', [id])
    }
    await client.query('COMMIT')
    return c.json(rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
})

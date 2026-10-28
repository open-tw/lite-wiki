// 測試共用：準備測試資料庫、每個測試前清空資料、建立帳號與登入
// 用法：在測試檔最上面呼叫 setupTestDb()
// 環境設定（測試資料庫等）由 npm test 的 --import ./test/env.ts 先載入
import { readFile } from 'node:fs/promises'
import { after, before, beforeEach } from 'node:test'
import pg from 'pg'
import { app } from '../src/app.js'
import { pool } from '../src/db.js'
import type { Role } from '../src/auth.js'
import { hashPassword } from '../src/lib/password.js'

export { app, pool }

// 測試資料庫不存在就建立；連到預設的 postgres 資料庫執行 CREATE DATABASE
async function ensureDatabase() {
  const name = process.env.PG_DATABASE!
  const admin = new pg.Client({
    host: process.env.PG_HOST,
    port: Number(process.env.PG_PORT ?? 5432),
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: 'postgres',
  })
  await admin.connect()
  try {
    const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [name])
    if (!rowCount) await admin.query(`CREATE DATABASE "${name.replaceAll('"', '""')}"`)
  } finally {
    await admin.end()
  }
}

export function setupTestDb() {
  before(async () => {
    await ensureDatabase()
    // 和 npm run db:init 相同；init.sql 可重複執行
    await pool.query(await readFile(new URL('../sql/init.sql', import.meta.url), 'utf8'))
  })
  beforeEach(async () => {
    await pool.query('TRUNCATE users, sessions, pages, page_revisions, uploads RESTART IDENTITY CASCADE')
  })
  after(async () => {
    await pool.end()
  })
}

export const PASSWORD = 'correct horse'

export async function createUser(
  username: string,
  role: Role = 'editor',
  { password = PASSWORD, disabled = false }: { password?: string; disabled?: boolean } = {},
) {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO users (username, password_hash, role, disabled_at)
     VALUES ($1, $2, $3, CASE WHEN $4::boolean THEN now() END) RETURNING id`,
    [username, await hashPassword(password), role, disabled],
  )
  return rows[0]!.id
}

type RequestOptions = { method?: string; body?: unknown; cookie?: string }

// 呼叫 /api 底下的路由；body 會轉成 JSON
export function api(path: string, { method = 'GET', body, cookie }: RequestOptions = {}) {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (cookie) headers.cookie = cookie
  return app.request(`/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

// 從回應的 Set-Cookie 取出 session cookie，回傳可以直接放進 Cookie 標頭的字串
export function sessionCookie(res: Response) {
  const header = res.headers.get('set-cookie') ?? ''
  const match = /(?:^|,\s*)sid=([^;]*)/.exec(header)
  return match?.[1] ? `sid=${match[1]}` : null
}

// 登入並回傳 session cookie；登入失敗時直接拋錯，讓測試在設定階段就停下
export async function login(username: string, password = PASSWORD) {
  const res = await api('/auth/login', { method: 'POST', body: { username, password } })
  const cookie = sessionCookie(res)
  if (res.status !== 200 || !cookie) throw new Error(`登入 ${username} 失敗：${res.status}`)
  return cookie
}

// 建立帳號並登入，回傳 cookie
export async function loginAs(username: string, role: Role = 'editor') {
  await createUser(username, role)
  return login(username)
}

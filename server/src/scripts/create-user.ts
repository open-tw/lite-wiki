import { isRole } from '../auth.js'
import { pool } from '../db.js'
import { passwordError, usernameError } from '../lib/account.js'
import { hashPassword } from '../lib/password.js'

// 建立第一個 admin 帳號用；之後的帳號可由 admin 在「帳號管理」頁面建立
// 沒給角色時：資料庫還沒有帳號就建立 admin，否則建立 editor
const [username = '', password = '', role] = process.argv.slice(2)
if (!username || !password || (role !== undefined && !isRole(role))) {
  console.error('用法：npm run user:create -- <帳號> <密碼> [admin|editor|viewer]')
  process.exit(1)
}
const invalid = usernameError(username) ?? passwordError(password)
if (invalid) {
  console.error(invalid)
  process.exit(1)
}

try {
  const { rows } = await pool.query<{ role: string }>(
    `INSERT INTO users (username, password_hash, role)
     VALUES ($1, $2, COALESCE($3, CASE WHEN EXISTS (SELECT 1 FROM users) THEN 'editor' ELSE 'admin' END))
     RETURNING role`,
    [username, await hashPassword(password), role ?? null],
  )
  console.log(`已建立使用者 ${username}（${rows[0]!.role}）`)
} finally {
  await pool.end()
}

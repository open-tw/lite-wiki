import { pool } from '../db.js'
import { hashPassword } from '../lib/password.js'

// 目前沒有註冊頁，用這個腳本建立帳號
const [username, password] = process.argv.slice(2)
if (!username || !password) {
  console.error('用法：npm run user:create -- <帳號> <密碼>')
  process.exit(1)
}

try {
  await pool.query('INSERT INTO users (username, password_hash) VALUES ($1, $2)', [
    username,
    await hashPassword(password),
  ])
  console.log(`已建立使用者 ${username}`)
} finally {
  await pool.end()
}

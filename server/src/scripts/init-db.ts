import { readFile } from 'node:fs/promises'
import { pool } from '../db.js'

const sql = await readFile(new URL('../../sql/init.sql', import.meta.url), 'utf8')

try {
  await pool.query(sql)
  console.log('Database initialized')
} finally {
  await pool.end()
}

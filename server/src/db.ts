import pg from 'pg'

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

export const pool = new pg.Pool({
  host: requireEnv('PG_HOST'),
  port: Number(process.env.PG_PORT ?? 5432),
  user: requireEnv('PG_USER'),
  // 本機用 trust 驗證時可以不設密碼
  password: process.env.PG_PASSWORD,
  database: requireEnv('PG_DATABASE'),
})

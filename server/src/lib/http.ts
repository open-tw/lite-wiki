import type { Context } from 'hono'

// 讀取 JSON body；格式錯誤或不是物件時回傳空物件，交給各路由自行檢查欄位
export async function readBody(c: Context): Promise<Record<string, unknown>> {
  const body: unknown = await c.req.json().catch(() => null)
  return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {}
}

export function toPositiveInt(value: unknown) {
  const n = typeof value === 'string' ? Number(value) : value
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : null
}

// PostgreSQL unique_violation
export function isUniqueViolation(err: unknown) {
  return err instanceof Error && 'code' in err && err.code === '23505'
}

import { createHash } from 'node:crypto'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { requireAuth, type Env } from '../auth.js'
import { pool } from '../db.js'
import { detectImage, extOf } from '../lib/image.js'
import { getFile, putFile } from '../lib/storage.js'

export const uploadRoutes = new Hono<Env>()

const MAX_BYTES = 5 * 1024 * 1024
const TOO_LARGE = '圖片不可超過 5MB'

// 上傳圖片（multipart/form-data，欄位 file）
// 同一張圖重複上傳時不另存，直接回傳既有網址
uploadRoutes.post(
  '/',
  requireAuth,
  // multipart 的邊界與欄位標頭會多佔一些空間，實際檔案大小下面再檢查一次
  bodyLimit({ maxSize: MAX_BYTES + 64 * 1024, onError: (c) => c.json({ error: TOO_LARGE }, 413) }),
  async (c) => {
    const body = await c.req.parseBody().catch(() => null)
    const file = body?.file
    if (!(file instanceof File)) return c.json({ error: '請以 multipart/form-data 上傳 file 欄位' }, 400)
    if (file.size > MAX_BYTES) return c.json({ error: TOO_LARGE }, 413)

    const data = Buffer.from(await file.arrayBuffer())
    const type = detectImage(data)
    if (!type) return c.json({ error: '只支援 PNG、JPEG、GIF、WebP 圖片' }, 415)

    const sha256 = createHash('sha256').update(data).digest('hex')
    const name = `${sha256}.${type.ext}`
    // 先寫檔再寫資料庫，資料庫裡的紀錄一定有對應的檔案；內容相同，重複寫入無妨
    await putFile(name, data)
    const { rowCount } = await pool.query(
      `INSERT INTO uploads (sha256, mime, size, orig_name, uploader_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (sha256) DO NOTHING`,
      [sha256, type.mime, data.length, file.name, c.var.user!.id],
    )
    return c.json({ url: `/api/uploads/${name}`, mime: type.mime, size: data.length }, rowCount ? 201 : 200)
  },
)

// 讀取圖片：目前公開；之後有私人頁面時，在這裡依引用此圖的頁面檢查權限，
// 並把 Cache-Control 改為 private
uploadRoutes.get('/:name', async (c) => {
  const match = /^([0-9a-f]{64})\.([a-z]+)$/.exec(c.req.param('name'))
  if (!match) return c.json({ error: '找不到檔案' }, 404)
  const [name, sha256, ext] = match

  const { rows } = await pool.query<{ mime: string }>('SELECT mime FROM uploads WHERE sha256 = $1', [sha256])
  const mime = rows[0]?.mime
  if (!mime || extOf(mime) !== ext) return c.json({ error: '找不到檔案' }, 404)

  const file = await getFile(name)
  if (!file) return c.json({ error: '找不到檔案' }, 404)
  return c.body(file.stream, 200, {
    'Content-Type': mime,
    'Content-Length': String(file.size),
    'Cache-Control': 'public, max-age=31536000, immutable',
    // 不讓瀏覽器猜測型別，也禁止檔案被當成頁面執行腳本
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
  })
})

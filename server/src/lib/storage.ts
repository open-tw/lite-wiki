import { randomBytes } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, rename, stat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { Readable } from 'node:stream'

// 上傳檔案存在本機磁碟；之後要改用 S3 等服務時只需替換這個檔案
// 相對路徑以啟動 server 的目錄為準
const UPLOAD_DIR = resolve(process.env.UPLOAD_DIR ?? 'uploads')

// name 必須由 server 產生（不可含使用者輸入），避免 path traversal
export async function putFile(name: string, data: Buffer) {
  await mkdir(UPLOAD_DIR, { recursive: true })
  // 先寫暫存檔再改名，讀取端不會讀到寫一半的檔案
  const tmp = join(UPLOAD_DIR, `.${name}.${randomBytes(6).toString('hex')}.tmp`)
  await writeFile(tmp, data)
  await rename(tmp, join(UPLOAD_DIR, name))
}

// 檔案不存在時回 null
export async function getFile(name: string) {
  const path = join(UPLOAD_DIR, name)
  const info = await stat(path).catch(() => null)
  if (!info?.isFile()) return null
  return { size: info.size, stream: Readable.toWeb(createReadStream(path)) as ReadableStream }
}

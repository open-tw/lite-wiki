// 測試用的環境設定；必須在載入 src/db.ts 之前執行
// npm test 用 --import 在所有測試檔之前載入，測試檔的 import 順序就不影響
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// 測試會清空資料表，一律改用另一個資料庫，不碰 PG_DATABASE（開發用的資料）
const database = process.env.PG_TEST_DATABASE ?? 'lite_wiki_test'
if (!database.endsWith('_test')) {
  throw new Error(`PG_TEST_DATABASE 必須以 _test 結尾，避免清掉其他資料庫：${database}`)
}
process.env.PG_DATABASE = database
process.env.PG_HOST ??= 'localhost'
process.env.PG_USER ??= 'postgres'

// 上傳的圖片寫到暫存目錄，不留在專案裡
process.env.UPLOAD_DIR = mkdtempSync(join(tmpdir(), 'lite-wiki-test-'))

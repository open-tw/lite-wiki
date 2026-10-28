# server — Lite Wiki 後端

Hono + PostgreSQL（`pg`，不使用 ORM）。安裝與啟動方式見[根目錄 README](../README.md)，API 規格見 [docs/api.md](docs/api.md)。

| 指令 | 說明 |
|---|---|
| `npm run dev` | 開發模式（檔案變更自動重啟） |
| `npm run db:init` | 執行 `sql/init.sql` 建立資料表（可重複執行） |
| `npm run user:create -- <帳號> <密碼>` | 建立登入帳號 |
| `npm run build` / `npm start` | 編譯到 `dist/` 並啟動 |
| `npm test` | 執行測試（需要 PostgreSQL，見下方） |
| `npm run typecheck` | 型別檢查（含測試） |

## 測試

測試使用 Node 內建的 `node:test`，直接呼叫 `src/app.ts` 的 Hono app（不開 port），資料庫用真的 PostgreSQL。

```bash
docker compose up -d   # 或使用自己的 PostgreSQL
npm test
```

- 連線設定沿用 `.env` 的 `PG_HOST`、`PG_PORT`、`PG_USER`、`PG_PASSWORD`，但資料庫一律改用 `PG_TEST_DATABASE`（預設 `lite_wiki_test`，名稱必須以 `_test` 結尾），不會動到開發用的資料
- 測試資料庫不存在時會自動建立並執行 `sql/init.sql`；每個測試開始前會清空所有資料表
- 上傳的圖片寫到系統暫存目錄
- 只跑一個檔案：`npx tsx --env-file-if-exists=.env --import ./test/env.ts --test test/auth.test.ts`

測試檔放在 `test/`，共用的工具（建立帳號、登入、呼叫 API）在 `test/helpers.ts`。每個測試檔開頭呼叫 `setupTestDb()`。

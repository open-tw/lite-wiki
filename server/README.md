# server — Lite Wiki 後端

Hono + PostgreSQL（`pg`，不使用 ORM）。安裝與啟動方式見[根目錄 README](../README.md)，API 規格見 [docs/api.md](docs/api.md)。

| 指令 | 說明 |
|---|---|
| `npm run dev` | 開發模式（檔案變更自動重啟） |
| `npm run db:init` | 執行 `sql/init.sql` 建立資料表（可重複執行） |
| `npm run user:create -- <帳號> <密碼>` | 建立登入帳號 |
| `npm run build` / `npm start` | 編譯到 `dist/` 並啟動 |

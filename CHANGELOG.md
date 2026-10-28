# 更新紀錄

格式參考 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/)，版本號遵循 [語意化版本](https://semver.org/lang/zh-TW/)。
1.0 之前，有不相容的變更時會提升次版號（例如 0.1 → 0.2）。

## [未發布]

### 新增

- 後端自動化測試（`cd server && npm test`），涵蓋登入、session、修改密碼、帳號管理與頁面的角色權限。測試使用另一個資料庫（預設 `lite_wiki_test`），不影響開發資料。
- GitHub Actions：每次 push 與 PR 執行後端測試、型別檢查，以及前後端建置。

### 變更

- 後端的 Hono app 移到 `server/src/app.ts`，`src/index.ts` 只負責啟動 server。

## [0.2.0] - 2026-10-23

### 升級前請先看

從 v0.1.0 升級需要注意以下幾點：

1. **重新執行資料庫初始化**：更新程式碼後執行 `cd server && npm run db:init`，補上新的欄位與資料表。這個指令可以重複執行，不會影響既有資料。
2. **帳號角色**：升級後，最早建立的帳號會成為「管理員」，其他既有帳號都是「編輯者」。需要調整的話，用管理員帳號登入後到「帳號管理」修改。
3. **備份上傳的圖片**：圖片存在 `UPLOAD_DIR`（預設 `server/uploads/`），不在資料庫裡。用容器部署時請掛載成 volume，備份時要和資料庫一起備份。
4. **反向代理的請求大小上限**：若有設定（例如 Nginx 預設 `client_max_body_size 1m`），請調到 6MB 以上，否則較大的圖片會上傳失敗。

### 新增

- **圖片上傳**：在編輯器用工具列、貼上或拖曳插入圖片，支援 PNG、JPEG、GIF、WebP，單張 5MB 以內；同一張圖只存一份。
- **帳號與角色**：分為檢視者（只能瀏覽）、編輯者（建立、編輯頁面與上傳圖片）、管理員（另外可以刪除、還原頁面與管理帳號）。
- **帳號管理**頁面（管理員）：新增帳號、修改角色、停用或啟用、重設密碼。停用或重設密碼後，該帳號已登入的地方會立即登出。
- **我的帳號**頁面：修改自己的密碼，成功後其他裝置會被登出。
- **刪除與還原頁面**（管理員）：頁面上的「刪除」按鈕，以及「已刪除的頁面」可以還原。刪除的頁面保留所有版本；在同一個網址重新建立時，舊版本會接在新版本之後。
- **版本差異標示**：比較兩個版本時標出新增與刪除的行和字，可切換單欄或並排，沒有變更的段落會自動摺疊。
- **修訂歷史**可以選任意兩個版本比較。
- 編輯器介面改為正體中文。

### 變更

- 刪除頁面改為軟刪除，版本紀錄都會保留；只有管理員可以刪除。
- 建立、編輯頁面與上傳圖片需要編輯者以上的角色；檢視者看不到編輯相關的按鈕。
- `npm run user:create` 在資料庫還沒有帳號時建立的是管理員，也可以在最後加上角色（`admin`、`editor`、`viewer`）。之後的帳號建議由管理員在「帳號管理」頁面建立。
- 新建立或修改的密碼至少要 8 個字（既有密碼不受影響）。

### API 變更

給直接呼叫 API 的使用者，詳細規格見 [`server/docs/api.md`](server/docs/api.md)：

- `PUT /api/pages/:slug` 需要 editor 以上，角色不足回 `403`。
- `DELETE /api/pages/:slug` 改為軟刪除，並需要 admin。
- `GET /api/auth/me` 與登入的回應多了 `role` 欄位。停用的帳號登入時回 `403`。
- 新增 `POST /api/uploads`（需要 editor）、`GET /api/uploads/:name`、`GET /api/deleted`、`POST /api/restore/:slug`、`POST /api/auth/password`、`GET`／`POST /api/users`、`PATCH /api/users/:id`。

### 已知問題

- 版本比較的「上一個／下一個變更」：只有一處變動時按了沒有反應，也不會標示目前跳到哪一處。

## [0.1.0] - 2026-10-13

第一個公開版本（Alpha）。

- 所見即所得的 Markdown 編輯器（MDXEditor），可切換原始碼模式，或與上一版比較
- 每次儲存都保留版本，可瀏覽歷史版本，並左右並排比較兩個版本的原文
- 用網址表示的階層頁面與麵包屑
- 搜尋、最近變更
- 同時編輯時的衝突提示
- 帳號登入（帳號以 `npm run user:create` 建立）

[未發布]: https://github.com/open-tw/lite-wiki/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/open-tw/lite-wiki/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/open-tw/lite-wiki/releases/tag/v0.1.0

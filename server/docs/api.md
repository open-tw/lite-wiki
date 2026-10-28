# 前端 ↔ API ↔ 資料庫對應

前端目前的資料來源是 `app/src/lib/wiki-api.ts`（記憶體）與 `app/src/lib/auth.ts`（只存名字）。
本文件整理每個前端路由需要的資料、對應的 API 與資料表，作為接上真正後端的依據。

- 所有 API 以 `/api` 開頭（`src/app.ts` 用 `basePath('/api')` 統一加上，定義路由時不用寫），回傳 JSON；時間一律為 ISO 8601 字串
- slug 可包含 `/`（例如 `docs/intro`），在 Hono 用 `:slug{.+}` 取得
- 標示 🔒 的 API 需要登入（session cookie），未登入回 `401`；後面標註角色的（例如 🔒 editor）另外需要該角色以上，不足回 `403`
- 角色由低到高：`viewer`（只能瀏覽）< `editor`（建立、編輯頁面與上傳圖片）< `admin`（另可刪除、還原頁面與管理帳號）
- 錯誤一律回 `{ error: string }`；參數格式錯誤回 `400`
- 第一個帳號用 `npm run user:create -- <帳號> <密碼>` 建立（資料庫沒有帳號時自動為 admin），之後由 admin 在 `/admin/users` 建立；沒有開放註冊

## 資料表

| 資料表 | 用途 | 對應前端 |
|---|---|---|
| `users` | 帳號（角色、停用標記） | `User`、Header 的 `user.name`、修訂的 `author`、`/admin/users` |
| `sessions` | 登入狀態 | `auth.ts`、`_auth.tsx` 守衛 |
| `pages` | 頁面（slug、標題、目前版本、軟刪除標記） | `Page.slug`、`Page.title` |
| `page_revisions` | 每次儲存的內容 | `Revision`（`rev`、`content`、`author`、`createdAt`） |
| `uploads` | 上傳圖片的 metadata（檔案本體在 `UPLOAD_DIR`） | 編輯器插入的圖片 |

## 路由對應

| 前端路由 | 前端函式 | API | 資料表 |
|---|---|---|---|
| `/login` | `auth.login` | `POST /api/auth/login` | `users`、`sessions` |
| Header 登出 | `auth.logout` | `POST /api/auth/logout` | `sessions` |
| App 啟動 / `_auth` 守衛 | `auth.get` | `GET /api/auth/me` | `sessions`、`users` |
| `/account` 修改密碼 | `auth.changePassword` | 🔒 `POST /api/auth/password` | `users`、`sessions` |
| `/admin/users` | `listUsers`、`createUser`、`updateUser` | 🔒 admin `GET`、`POST /api/users`、`PATCH /api/users/:id` | `users`、`sessions` |
| `/pages` | `listPages` | `GET /api/pages` | `pages` |
| `/new`（檢查 slug、上層頁面選單） | `listPages` | `GET /api/pages` | `pages` |
| `/recent` | `listPages` + 前端攤平排序 | `GET /api/recent` | `page_revisions`、`pages`、`users` |
| `/search` | `searchPages` | `GET /api/search?q=` | `pages`、`page_revisions` |
| `/wiki/$` | `getPage`、`getBreadcrumbs` | `GET /api/pages/:slug`、`GET /api/breadcrumbs/:slug` | `pages`、`page_revisions`、`users` |
| `/history/$` | `getPage`、`getBreadcrumbs` | `GET /api/revisions/:slug`、`GET /api/breadcrumbs/:slug` | `page_revisions`、`users` |
| `/history/$?rev=N` | 同上 | `GET /api/pages/:slug?rev=N` | `page_revisions` |
| `/diff/$?from=A&to=B` | `getPage`、`getBreadcrumbs` | `GET /api/pages/:slug?rev=A`、`?rev=B`、`GET /api/breadcrumbs/:slug` | `page_revisions` |
| `/edit/$` 載入 | `getPage`、`getBreadcrumbs` | `GET /api/pages/:slug`（404 = 新建）、`GET /api/breadcrumbs/:slug` | 同 `/wiki/$` |
| `/edit/$` 儲存 | `savePage` | 🔒 editor `PUT /api/pages/:slug` | `pages`、`page_revisions` |
| `/wiki/$` 刪除按鈕 | `deletePage` | 🔒 admin `DELETE /api/pages/:slug` | `pages`（軟刪除，版本保留） |
| `/admin/deleted` | `listDeleted` | 🔒 admin `GET /api/deleted` | `pages`、`users` |
| `/admin/deleted` 還原 | `restorePage` | 🔒 admin `POST /api/restore/:slug` | `pages` |
| `/edit/$` 插入圖片（工具列、貼上、拖曳） | `uploadImage` | 🔒 editor `POST /api/uploads` | `uploads` |
| 頁面中的 `<img>` | — | `GET /api/uploads/:name` | `uploads` |

## API 規格

頁面採軟刪除：刪除只設定 `pages.deleted_at`、`deleted_by`，版本紀錄都保留。
除了 `GET /api/deleted`，所有讀取頁面的 API 都加上 `deleted_at IS NULL`，已刪除的頁面一律視為不存在（`404`、不出現在列表、最近變更與搜尋）。

### 驗證

#### `POST /api/auth/login`
```ts
// request
{ username: string; password: string }
// 200：設定 httpOnly session cookie
{ user: { name: string; role: 'admin' | 'editor' | 'viewer' } }
// 401：帳號或密碼錯誤
// 403：帳號已停用（只在密碼正確時才回，避免洩漏帳號狀態）
```

#### `POST /api/auth/logout`
刪除 `sessions` 中的資料並清除 cookie。回 `204`。

#### `GET /api/auth/me`
```ts
// 200；停用帳號的 session 視同未登入
{ user: { name: string; role: 'admin' | 'editor' | 'viewer' } | null }
```
角色每個請求都從資料庫讀取，admin 改了角色會立即生效，不必重新登入。

#### 🔒 `POST /api/auth/password`
修改自己的密碼。成功回 `204`，並刪除這個帳號其他的 session（目前這個保留）。
```ts
// request
{ currentPassword: string; newPassword: string }   // newPassword 至少 8 個字
// 400：目前的密碼不正確、新密碼太短
```

### 帳號管理（🔒 admin）

帳號不提供刪除：修訂紀錄與上傳都引用作者，不再使用的帳號改為停用。
```ts
type ManagedUser = { id: string; username: string; role: 'admin' | 'editor' | 'viewer'; disabled: boolean; createdAt: string }
```

#### `GET /api/users`
所有帳號，依建立順序。回 `ManagedUser[]`。

#### `POST /api/users`
```ts
// request；role 預設 editor
{ username: string; password: string; role?: 'admin' | 'editor' | 'viewer' }
// 201：ManagedUser
// 400：帳號為空、超過 32 字或含空白；密碼少於 8 個字；role 不正確
// 409：帳號已存在
```

#### `PATCH /api/users/:id`
修改角色、停用／啟用、重設密碼；欄位都是選填，只改有送的。回 `200` 與更新後的 `ManagedUser`，帳號不存在回 `404`。
```ts
{ role?: 'admin' | 'editor' | 'viewer'; disabled?: boolean; password?: string }
```
- 停用或重設密碼時，刪除該帳號所有的 session
- 不能變更自己的角色或停用自己（`400`），自己的密碼用 `POST /api/auth/password` 修改
- 在 transaction 中先 `SELECT ... WHERE role = 'admin' AND disabled_at IS NULL FOR UPDATE` 並確認自己仍是有效的 admin，兩位 admin 同時互相降級時後到的會得到 `403`；因此任何時候都至少保留一位 admin

### 頁面

#### `GET /api/pages`
所有頁面，依 slug 排序。給 `/pages` 列表和 `/new` 的 slug 檢查使用。
```ts
{ slug: string; title: string; updatedAt: string }[]
```
```sql
SELECT slug, title, updated_at FROM pages WHERE deleted_at IS NULL ORDER BY slug
```

#### `GET /api/pages/:slug` 、`GET /api/pages/:slug?rev=N`
取得頁面某個版本的內容；沒給 `rev` 時取最新版本。頁面或版本不存在時回 `404`。
```ts
{
  slug: string
  title: string
  currentRev: number    // 最新版本號，存檔時當作 baseRev 送回
  revision: { rev: number; content: string; author: string; createdAt: string }
}
```
```sql
SELECT p.slug, p.title, p.current_rev, r.rev, r.content, u.username AS author, r.created_at
FROM pages p
JOIN page_revisions r ON r.page_id = p.id AND r.rev = COALESCE($2, p.current_rev)
JOIN users u ON u.id = r.author_id
WHERE p.slug = $1 AND p.deleted_at IS NULL
```

#### 🔒 editor `PUT /api/pages/:slug`
儲存內容：頁面不存在就建立（第 1 版），存在就新增一個版本。作者為目前登入的使用者。
```ts
// request
{
  content: string
  title?: string   // 只在新建時使用；沒給就用 slug 最後一段（與前端 savePage 相同）
  baseRev?: number // 編輯時載入的版本；與 current_rev 不同表示有人先存了，回 409
}
// 201：新建頁面；200：新增版本
{ slug: string; rev: number }
// 409：版本衝突（頁面已被其他人更新或建立）
{ error: string; currentRev: number | null }
```
在同一個 transaction 中：
1. `SELECT ... FROM pages WHERE slug = $1 FOR UPDATE`
2. 不存在 → `INSERT INTO pages (slug, title, current_rev) VALUES ($1, $2, 1)`
   存在 → 檢查 `baseRev`，再 `UPDATE pages SET current_rev = current_rev + 1, updated_at = now()`
   已刪除 → 視為新建（回 `201`）：沿用同一筆，清除刪除標記、更新標題，版號接續，舊版本一併恢復；有送 `baseRev` 則回 `409`
3. `INSERT INTO page_revisions (page_id, rev, content, author_id)`

新建時若兩個人同時送出，`pages.slug` 的 UNIQUE 會讓後到的失敗，回 `409`。

#### 🔒 admin `DELETE /api/pages/:slug`
軟刪除頁面，回 `204`；頁面不存在或已刪除回 `404`。版本紀錄保留，可用 `POST /api/restore/:slug` 還原。
子頁面（slug 前綴相同的頁面）不受影響，麵包屑會把這一層顯示為「尚未建立」。
```sql
UPDATE pages SET deleted_at = now(), deleted_by = $2 WHERE slug = $1 AND deleted_at IS NULL
```

#### 🔒 admin `GET /api/deleted`
已刪除的頁面，依刪除時間由新到舊。
```ts
{ slug: string; title: string; deletedAt: string; deletedBy: string }[]
```

#### 🔒 admin `POST /api/restore/:slug`
還原已刪除的頁面，不新增版本，內容回到刪除前的最新版本。找不到已刪除的頁面回 `404`。
```ts
// 200
{ slug: string; rev: number }
```

#### `GET /api/revisions/:slug`
修訂歷史列表，不含內容，依 `rev` 由新到舊。頁面不存在回 `404`。
```ts
{
  slug: string
  title: string
  revisions: { rev: number; author: string; createdAt: string }[]
}
```

#### `GET /api/breadcrumbs/:slug`
slug 每一層前綴的標題；頁面不存在也要回傳（`/wiki/$` 的「尚未建立」頁面會用到）。
```ts
{ slug: string; title: string; exists: boolean }[]
```
```sql
-- $1 為所有前綴，例如 ['docs', 'docs/react', 'docs/react/hooks']
SELECT slug, title FROM pages WHERE slug = ANY($1) AND deleted_at IS NULL
```
查不到的前綴用該段文字當 title、`exists: false`。

### 列表與搜尋

#### `GET /api/recent?limit=50`
所有頁面最近的修訂，依時間由新到舊，`limit` 預設 50。
```ts
{ slug: string; title: string; rev: number; author: string; createdAt: string }[]
```
```sql
SELECT p.slug, p.title, r.rev, u.username AS author, r.created_at
FROM page_revisions r
JOIN pages p ON p.id = r.page_id
JOIN users u ON u.id = r.author_id
WHERE p.deleted_at IS NULL
ORDER BY r.created_at DESC
LIMIT $1
```

#### `GET /api/search?q=`
在標題與最新內容中搜尋（不分大小寫）。
```ts
{ slug: string; title: string }[]
```
```sql
SELECT p.slug, p.title
FROM pages p
JOIN page_revisions r ON r.page_id = p.id AND r.rev = p.current_rev
WHERE p.deleted_at IS NULL
  AND (p.title ILIKE $1 OR r.content ILIKE $1)   -- $1 = '%' || 跳脫後的 q || '%'
ORDER BY p.updated_at DESC
```
頁面變多後可加 `pg_trgm` 索引或改用全文搜尋。

### 圖片

檔案存在 `UPLOAD_DIR`（預設 `server/uploads/`），檔名為 `<sha256>.<副檔名>`，由 server 產生。
同一張圖只存一份；內容不會改變，所以可以長期快取。

#### 🔒 editor `POST /api/uploads`
上傳圖片，`multipart/form-data`，欄位名稱 `file`。
只接受 PNG、JPEG、GIF、WebP（依檔頭判斷，不看副檔名與 `Content-Type`），不接受 SVG。
```ts
// 201：新上傳；200：同一張圖已存在，回傳既有網址
{ url: string; mime: string; size: number }   // url 例如 /api/uploads/<sha256>.png
// 400：沒有 file 欄位
// 413：超過 5MB
// 415：不支援的格式
```
先寫入檔案，再 `INSERT ... ON CONFLICT (sha256) DO NOTHING`，資料庫的紀錄一定有對應的檔案。

#### `GET /api/uploads/:name`
回傳圖片本體，找不到回 `404`。目前不需登入。
- `Content-Type` 取自 `uploads.mime`；副檔名與 mime 不符也回 `404`
- `Cache-Control: public, max-age=31536000, immutable`
- `X-Content-Type-Options: nosniff`、`Content-Security-Policy: default-src 'none'; sandbox`

之後有私人頁面時：依「引用這張圖的頁面」檢查權限（新增 `page_uploads` 關聯表，儲存頁面時解析內容更新），並把 `Cache-Control` 改為 `private`。

目前沒有刪除 API：舊版本可能仍引用圖片，刪除會讓歷史頁面破圖。未被任何版本引用的檔案之後可用清理腳本處理。

## 前端串接（已完成）

- `app/src/lib/api.ts`：共用 `api()` fetch 與 `ApiError`（含 `status` 與錯誤 body）；slug 每段分別編碼
- `app/src/lib/wiki-api.ts`：每個 API 一個函式，型別與本文件一致；`404` 轉成 `null`
- `app/src/lib/auth.ts`：`init()` 在 `main.tsx` 渲染前呼叫 `GET /api/auth/me`，`_auth` 守衛維持同步判斷；`login`、`logout` 呼叫 API
- `/login` 加上密碼欄位與錯誤訊息
- `/edit/$` 儲存時送 `baseRev`；`409` 提示有人先更新、`401` 提示登入過期，內容都保留在編輯器
- `/history/$` 只拿版本列表，有 `rev` 時另外取該版本；`/diff/$` 分別取兩個版本
- `/diff/$` 用 `@codemirror/merge`（MDXEditor 已依賴，未新增套件）比對 Markdown 原文：預設單欄（`unifiedMergeView`），可切換並排（`MergeView`），選擇存在 localStorage；未變更段落摺疊、增刪行數用 `Chunk.build` 計算；`from` 大於 `to` 時自動對調
- `/history/$` 可選任意兩個版本比較（左欄舊版、右欄新版）
- `/edit/$` 啟用 MDXEditor 的 `imagePlugin`，上傳走 `uploadImage`；失敗時在編輯器下方顯示錯誤。關閉圖片縮放，避免存成檢視頁不渲染的 HTML `<img>`
- `/recent` 改用 `GET /api/recent`；時間用 `lib/format.ts` 轉成在地格式
- 角色：`auth.ts` 的 `hasRole`、`mayEdit` 只決定按鈕顯示；`_auth/_editor.tsx`、`_auth/_admin.tsx` 兩個無路徑 layout 在 `beforeLoad` 檢查角色，不足時顯示「沒有權限」（`components/Forbidden.tsx`）。實際權限一律以 API 的 `403` 為準
- `lib/admin-api.ts`：帳號管理與刪除／還原頁面
- `app/vite.config.ts` 設定 `/api` proxy 到 `http://localhost:3001`；正式環境需由同一個網域提供前端與 `/api`

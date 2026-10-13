# 前端 ↔ API ↔ 資料庫對應

前端目前的資料來源是 `app/src/lib/wiki-api.ts`（記憶體）與 `app/src/lib/auth.ts`（只存名字）。
本文件整理每個前端路由需要的資料、對應的 API 與資料表，作為接上真正後端的依據。

- 所有 API 以 `/api` 開頭（`src/index.ts` 用 `basePath('/api')` 統一加上，定義路由時不用寫），回傳 JSON；時間一律為 ISO 8601 字串
- slug 可包含 `/`（例如 `docs/intro`），在 Hono 用 `:slug{.+}` 取得
- 標示 🔒 的 API 需要登入（session cookie），未登入回 `401`
- 錯誤一律回 `{ error: string }`；參數格式錯誤回 `400`
- 帳號用 `npm run user:create -- <帳號> <密碼>` 建立（目前沒有註冊 API）

## 資料表

| 資料表 | 用途 | 對應前端 |
|---|---|---|
| `users` | 帳號 | `User`、Header 的 `user.name`、修訂的 `author` |
| `sessions` | 登入狀態 | `auth.ts`、`_auth.tsx` 守衛 |
| `pages` | 頁面（slug、標題、目前版本） | `Page.slug`、`Page.title` |
| `page_revisions` | 每次儲存的內容 | `Revision`（`rev`、`content`、`author`、`createdAt`） |

## 路由對應

| 前端路由 | 前端函式 | API | 資料表 |
|---|---|---|---|
| `/login` | `auth.login` | `POST /api/auth/login` | `users`、`sessions` |
| Header 登出 | `auth.logout` | `POST /api/auth/logout` | `sessions` |
| App 啟動 / `_auth` 守衛 | `auth.get` | `GET /api/auth/me` | `sessions`、`users` |
| `/pages` | `listPages` | `GET /api/pages` | `pages` |
| `/new`（檢查 slug、上層頁面選單） | `listPages` | `GET /api/pages` | `pages` |
| `/recent` | `listPages` + 前端攤平排序 | `GET /api/recent` | `page_revisions`、`pages`、`users` |
| `/search` | `searchPages` | `GET /api/search?q=` | `pages`、`page_revisions` |
| `/wiki/$` | `getPage`、`getBreadcrumbs` | `GET /api/pages/:slug`、`GET /api/breadcrumbs/:slug` | `pages`、`page_revisions`、`users` |
| `/history/$` | `getPage`、`getBreadcrumbs` | `GET /api/revisions/:slug`、`GET /api/breadcrumbs/:slug` | `page_revisions`、`users` |
| `/history/$?rev=N` | 同上 | `GET /api/pages/:slug?rev=N` | `page_revisions` |
| `/diff/$?from=A&to=B` | `getPage`、`getBreadcrumbs` | `GET /api/pages/:slug?rev=A`、`?rev=B`、`GET /api/breadcrumbs/:slug` | `page_revisions` |
| `/edit/$` 載入 | `getPage`、`getBreadcrumbs` | `GET /api/pages/:slug`（404 = 新建）、`GET /api/breadcrumbs/:slug` | 同 `/wiki/$` |
| `/edit/$` 儲存 | `savePage` | 🔒 `PUT /api/pages/:slug` | `pages`、`page_revisions` |
| （前端尚無） | — | 🔒 `DELETE /api/pages/:slug` | `pages`（版本一併刪除） |

## API 規格

### 驗證

#### `POST /api/auth/login`
```ts
// request
{ username: string; password: string }
// 200：設定 httpOnly session cookie
{ user: { name: string } }
// 401：帳號或密碼錯誤
```

#### `POST /api/auth/logout`
刪除 `sessions` 中的資料並清除 cookie。回 `204`。

#### `GET /api/auth/me`
```ts
// 200
{ user: { name: string } | null }
```

### 頁面

#### `GET /api/pages`
所有頁面，依 slug 排序。給 `/pages` 列表和 `/new` 的 slug 檢查使用。
```ts
{ slug: string; title: string; updatedAt: string }[]
```
```sql
SELECT slug, title, updated_at FROM pages ORDER BY slug
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
WHERE p.slug = $1
```

#### 🔒 `PUT /api/pages/:slug`
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
3. `INSERT INTO page_revisions (page_id, rev, content, author_id)`

新建時若兩個人同時送出，`pages.slug` 的 UNIQUE 會讓後到的失敗，回 `409`。

#### 🔒 `DELETE /api/pages/:slug`
刪除頁面與它的所有版本，回 `204`；頁面不存在回 `404`。
子頁面（slug 前綴相同的頁面）不受影響，麵包屑會把這一層顯示為「尚未建立」。

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
SELECT slug, title FROM pages WHERE slug = ANY($1)
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
WHERE p.title ILIKE $1 OR r.content ILIKE $1   -- $1 = '%' || 跳脫後的 q || '%'
ORDER BY p.updated_at DESC
```
頁面變多後可加 `pg_trgm` 索引或改用全文搜尋。

## 前端串接（已完成）

- `app/src/lib/api.ts`：共用 `api()` fetch 與 `ApiError`（含 `status` 與錯誤 body）；slug 每段分別編碼
- `app/src/lib/wiki-api.ts`：每個 API 一個函式，型別與本文件一致；`404` 轉成 `null`
- `app/src/lib/auth.ts`：`init()` 在 `main.tsx` 渲染前呼叫 `GET /api/auth/me`，`_auth` 守衛維持同步判斷；`login`、`logout` 呼叫 API
- `/login` 加上密碼欄位與錯誤訊息
- `/edit/$` 儲存時送 `baseRev`；`409` 提示有人先更新、`401` 提示登入過期，內容都保留在編輯器
- `/history/$` 只拿版本列表，有 `rev` 時另外取該版本；`/diff/$` 分別取兩個版本
- `/recent` 改用 `GET /api/recent`；時間用 `lib/format.ts` 轉成在地格式
- `app/vite.config.ts` 設定 `/api` proxy 到 `http://localhost:3001`；正式環境需由同一個網域提供前端與 `/api`

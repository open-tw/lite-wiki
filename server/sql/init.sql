-- lite-wiki 資料庫初始化
-- 可重複執行（皆使用 IF NOT EXISTS）
-- 與前端路由 / API 的對應見 docs/api.md

-- 使用者：對應 login.tsx、Header 顯示的 user.name
-- 目前沒有註冊頁，帳號先用 SQL 或腳本建立
CREATE TABLE IF NOT EXISTS users (
  id             BIGSERIAL PRIMARY KEY,
  username       TEXT        NOT NULL UNIQUE,
  password_hash  TEXT        NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 登入 session：cookie 存原始 token，資料庫只存它的雜湊
-- 對應 _auth.tsx 的登入守衛、登出按鈕
CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT        PRIMARY KEY,
  user_id     BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);

-- 頁面：對應前端的 Page（slug、title）
-- 階層（例如 docs/intro）直接用 slug 的 / 表示，麵包屑用 slug 前綴查詢
-- current_rev 指向最新版本，讀頁面時不必再找 MAX(rev)；也用來偵測同時編輯的衝突
CREATE TABLE IF NOT EXISTS pages (
  id           BIGSERIAL PRIMARY KEY,
  slug         TEXT        NOT NULL UNIQUE CHECK (slug <> ''),
  title        TEXT        NOT NULL CHECK (title <> ''),
  current_rev  INTEGER     NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 軟刪除：刪除只標記時間與刪除者，版本紀錄都保留，可以還原
-- 讀取的 API 一律加上 deleted_at IS NULL；在已刪除的 slug 重新建立時沿用同一筆，舊版本一併恢復
-- 用 ADD COLUMN IF NOT EXISTS，已建立的資料庫重新執行 db:init 即可補上
ALTER TABLE pages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE pages ADD COLUMN IF NOT EXISTS deleted_by BIGINT REFERENCES users(id);

-- 修訂版本：對應前端的 Revision（rev、content、author、createdAt）
-- 每次儲存新增一筆，rev 在同一頁面內從 1 遞增
CREATE TABLE IF NOT EXISTS page_revisions (
  id          BIGSERIAL PRIMARY KEY,
  page_id     BIGINT      NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  rev         INTEGER     NOT NULL CHECK (rev > 0),
  content     TEXT        NOT NULL,
  author_id   BIGINT      NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (page_id, rev)
);

-- /recent：所有頁面的修訂依時間排序
CREATE INDEX IF NOT EXISTS page_revisions_created_at_idx ON page_revisions (created_at DESC);

-- 上傳的圖片：檔案本體存在 UPLOAD_DIR，這裡只存 metadata
-- 檔名為 <sha256>.<副檔名>，同一張圖只存一份；內容不會變，可長期快取
CREATE TABLE IF NOT EXISTS uploads (
  id           BIGSERIAL PRIMARY KEY,
  sha256       TEXT        NOT NULL UNIQUE,
  mime         TEXT        NOT NULL,  -- 由檔頭判斷，不採用使用者送來的值
  size         INTEGER     NOT NULL,
  orig_name    TEXT        NOT NULL,  -- 只供顯示，不用於檔案路徑
  uploader_id  BIGINT      NOT NULL REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

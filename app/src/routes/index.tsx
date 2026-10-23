import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { mayEdit, useAuth } from '#/lib/auth'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const { user } = useAuth()
  const navigate = useNavigate()

  return (
    <main className="my-20 text-center sm:my-28">
      <h1 className="mb-3 text-4xl sm:text-5xl">Lite Wiki</h1>
      {/* 中文自動斷行容易把詞拆開，寬螢幕時手動在冒號後換行 */}
      <p className="mx-auto mt-0 max-w-lg text-lg text-gray-600">
        輕量的團隊知識庫：
        <span className="sm:block">用 Markdown 撰寫，每次修改都保留版本紀錄。</span>
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {/* /new 需要登入；未登入時 _auth 守衛會先導向登入頁，登入後再回到 /new；檢視者不顯示 */}
        {mayEdit(user) && (
          <Link to="/new" className="btn btn-primary px-5 py-2.5 text-base hover:no-underline">
            ＋ 建立新頁面
          </Link>
        )}
        <Link to="/pages" className="btn px-5 py-2.5 text-base hover:no-underline">
          瀏覽所有頁面
        </Link>
      </div>
      {!user && <p className="text-sm text-gray-500">建立或編輯頁面需要先登入</p>}

      <form
        className="mx-auto mt-12 flex max-w-md gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const q = String(new FormData(e.currentTarget).get('q') ?? '').trim()
          if (q) navigate({ to: '/search', search: { q } })
        }}
      >
        <input
          name="q"
          type="search"
          className="input"
          placeholder="搜尋頁面標題或內容…"
          aria-label="搜尋"
        />
        <button type="submit" className="btn shrink-0">
          搜尋
        </button>
      </form>
    </main>
  )
}

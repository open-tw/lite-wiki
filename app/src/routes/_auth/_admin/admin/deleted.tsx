import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { ApiError } from '#/lib/api'
import { listDeleted, restorePage } from '#/lib/admin-api'
import { formatDateTime } from '#/lib/format'
import { pageHead } from '#/lib/head'

// 需要 admin：守衛在 _auth/_admin.tsx
export const Route = createFileRoute('/_auth/_admin/admin/deleted')({
  loader: () => listDeleted(),
  head: () => pageHead('已刪除的頁面'),
  component: DeletedPage,
})

function DeletedPage() {
  const pages = Route.useLoaderData()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  // 剛還原的頁面，顯示連結讓使用者前往
  const [restored, setRestored] = useState<{ slug: string; title: string } | null>(null)

  return (
    <main>
      <h1>已刪除的頁面</h1>
      {/* 中文句子之間不要有空白，JSX 跨行會插入空格，所以拆成字串相接 */}
      <p className="text-sm text-gray-600">
        {'還原後內容會回到刪除前的最新版本，歷史紀錄都保留。' +
          '若有人在同一個網址重新建立了頁面，舊的版本會接在新版本之下，這一頁就不會再出現在這裡。'}
      </p>

      {error && <p role="alert">{error}</p>}
      {restored && (
        <p className="text-sm text-green-700">
          已還原
          <Link to="/wiki/$" params={{ _splat: restored.slug }} className="mx-1">
            {restored.title}
          </Link>
        </p>
      )}

      {pages.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 px-6 py-12 text-center text-gray-500">
          沒有已刪除的頁面。
        </div>
      ) : (
        <ul role="list" className="m-0 list-none divide-y divide-gray-100 rounded-lg border border-gray-200 p-0">
          {pages.map((p) => (
            <li key={p.slug} className="mt-0 flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <span className="min-w-0">
                <span className="block truncate font-medium">{p.title}</span>
                <span className="block truncate font-mono text-xs text-gray-500">/wiki/{p.slug}</span>
                <span className="block text-xs text-gray-500">
                  {p.deletedBy} 於 {formatDateTime(p.deletedAt)} 刪除
                </span>
              </span>
              <button
                type="button"
                className="btn"
                onClick={async () => {
                  setError(null)
                  setRestored(null)
                  try {
                    await restorePage(p.slug)
                    setRestored(p)
                    await router.invalidate()
                  } catch (err) {
                    setError(err instanceof ApiError ? err.message : '無法連線到伺服器，請稍後再試。')
                  }
                }}
              >
                還原
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

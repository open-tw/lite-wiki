import { Link, createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { mayEdit, useAuth } from '#/lib/auth'
import { listPages } from '#/lib/wiki-api'
import { formatDateTime } from '#/lib/format'
import { pageHead } from '#/lib/head'

export const Route = createFileRoute('/pages')({
  loader: () => listPages(),
  head: () => pageHead('所有頁面'),
  component: PagesIndex,
})

function PagesIndex() {
  const pages = Route.useLoaderData()
  const { user } = useAuth()
  const [filter, setFilter] = useState('')

  const term = filter.trim().toLowerCase()
  const filtered = term
    ? pages.filter((p) => p.title.toLowerCase().includes(term) || p.slug.includes(term))
    : pages

  return (
    <main>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="mb-0">
          所有頁面
          <span className="ml-3 align-middle rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-medium text-gray-600">
            {pages.length}
          </span>
        </h1>
        {mayEdit(user) && (
          <Link to="/new" className="btn btn-primary shrink-0 hover:no-underline">
            ＋ 新增頁面
          </Link>
        )}
      </div>

      {pages.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 px-6 py-12 text-center text-gray-500">
          <p className="mt-0">還沒有任何頁面。</p>
          {mayEdit(user) && <Link to="/new">建立第一個頁面</Link>}
        </div>
      ) : (
        <>
          <input
            type="search"
            className="input mb-4"
            placeholder="篩選標題或網址…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="篩選頁面"
          />

          <div className="overflow-hidden rounded-lg border border-gray-200">
            <div className="hidden grid-cols-[1fr_auto] gap-4 border-b border-gray-200 bg-gray-50 px-4 py-2 text-xs font-medium tracking-wide text-gray-500 uppercase sm:grid">
              <span>頁面</span>
              <span>最後更新</span>
            </div>
            <ul role="list" className="m-0 list-none divide-y divide-gray-100 p-0">
              {filtered.map((p) => {
                // 依 slug 的層數縮排（列表已依 slug 排序，子頁面會緊接在上層之後）；篩選時改為平鋪
                const depth = term ? 0 : p.slug.split('/').length - 1
                return (
                  <li key={p.slug} className="mt-0">
                    <Link
                      to="/wiki/$"
                      params={{ _splat: p.slug }}
                      className="flex items-start gap-2 py-3 pr-4 text-inherit hover:bg-gray-50 hover:no-underline"
                      style={{ paddingLeft: `${1 + depth * 1.5}rem` }}
                    >
                      {/* 子頁面的連接符號放在左側獨立一欄，標題和網址才會對齊 */}
                      {depth > 0 && (
                        <span className="text-gray-300" aria-hidden>
                          └
                        </span>
                      )}
                      {/* 寬螢幕：時間在右側一欄；窄螢幕：時間接在網址下方 */}
                      <span className="grid min-w-0 flex-1 gap-x-4 sm:grid-cols-[1fr_auto] sm:items-center">
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-blue-600">{p.title}</span>
                          <span className="block truncate font-mono text-xs text-gray-500">
                            /wiki/{p.slug}
                          </span>
                        </span>
                        <time
                          dateTime={p.updatedAt}
                          className="mt-1 text-xs whitespace-nowrap text-gray-500 sm:mt-0 sm:text-sm"
                        >
                          {formatDateTime(p.updatedAt)}
                        </time>
                      </span>
                    </Link>
                  </li>
                )
              })}
              {filtered.length === 0 && (
                <li className="mt-0 px-4 py-8 text-center text-sm text-gray-500">
                  找不到符合「{filter.trim()}」的頁面
                </li>
              )}
            </ul>
          </div>
        </>
      )}
    </main>
  )
}

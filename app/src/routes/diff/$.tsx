import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { useState } from 'react'
import { Breadcrumbs } from '#/components/Breadcrumbs'
import { RevisionDiff, diffStats, type DiffMode } from '#/components/RevisionDiff'
import { formatDateTime } from '#/lib/format'
import { pageHead } from '#/lib/head'
import { normalizeSlug } from '#/lib/slug'
import { getBreadcrumbs, getPage, type Revision } from '#/lib/wiki-api'

type DiffSearch = { from: number; to: number }

// 使用者選的單欄／並排存在瀏覽器；讀寫失敗（私密模式等）時用預設的單欄
const MODE_KEY = 'lite-wiki:diff-mode'

function loadMode(): DiffMode {
  try {
    return localStorage.getItem(MODE_KEY) === 'split' ? 'split' : 'unified'
  } catch {
    return 'unified'
  }
}

function saveMode(mode: DiffMode) {
  try {
    localStorage.setItem(MODE_KEY, mode)
  } catch {
    // 存不了就只在這次瀏覽有效
  }
}

// 公開：未登入也能比較版本
export const Route = createFileRoute('/diff/$')({
  // from 一律是較舊的版本；網址給反了就對調
  validateSearch: (search: Record<string, unknown>): DiffSearch => {
    const a = Number(search.from) || 1
    const b = Number(search.to) || 1
    return { from: Math.min(a, b), to: Math.max(a, b) }
  },
  loaderDeps: ({ search }) => ({ from: search.from, to: search.to }),
  loader: async ({ params, deps }) => {
    const slug = normalizeSlug(params._splat ?? '')
    const [fromPage, toPage, crumbs] = await Promise.all([
      getPage(slug, deps.from),
      getPage(slug, deps.to),
      getBreadcrumbs(slug),
    ])
    if (!fromPage || !toPage) throw notFound()
    return { page: toPage, crumbs, from: fromPage.revision, to: toPage.revision }
  },
  head: ({ loaderData }) =>
    pageHead(
      loaderData &&
        `${loaderData.page.title}：第 ${loaderData.from.rev} 版 → 第 ${loaderData.to.rev} 版`,
    ),
  component: DiffPage,
})

function DiffPage() {
  const { page, crumbs, from, to } = Route.useLoaderData()
  const [mode, setMode] = useState(loadMode)
  const { added, removed } = diffStats(from.content, to.content)
  const same = added === 0 && removed === 0

  return (
    // 並排時放寬內容區，兩欄才不會太擠
    <main className={mode === 'split' ? 'w-[min(80rem,calc(100%-2rem))]' : undefined}>
      <Breadcrumbs crumbs={crumbs} current="版本比較" />
      <h1>
        {page.title}：第 {from.rev} 版 → 第 {to.rev} 版
      </h1>

      <div className="mb-4 grid gap-2 text-sm sm:grid-cols-2">
        <RevisionInfo slug={page.slug} revision={from} label="舊" />
        <RevisionInfo slug={page.slug} revision={to} label="新" />
      </div>

      {same ? (
        <p className="rounded-md border border-dashed border-gray-300 px-4 py-8 text-center text-gray-500">
          兩個版本的內容相同。
        </p>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>
              <span className="font-medium text-green-700">+{added}</span>{' '}
              <span className="font-medium text-red-700">−{removed}</span> 行
            </span>
            <div role="group" aria-label="顯示方式" className="flex gap-1">
              {(['unified', 'split'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={m === mode ? 'btn btn-primary' : 'btn'}
                  aria-pressed={m === mode}
                  onClick={() => {
                    setMode(m)
                    saveMode(m)
                  }}
                >
                  {m === 'unified' ? '單欄' : '並排'}
                </button>
              ))}
            </div>
          </div>
          <RevisionDiff original={from.content} modified={to.content} mode={mode} />
        </>
      )}
    </main>
  )
}

function RevisionInfo({ slug, revision, label }: { slug: string; revision: Revision; label: string }) {
  return (
    <div className="rounded-md border border-gray-200 px-3 py-2">
      <span className="mr-2 text-gray-500">{label}</span>
      <Link to="/history/$" params={{ _splat: slug }} search={{ rev: revision.rev }}>
        第 {revision.rev} 版
      </Link>
      <span className="ml-2 text-gray-500">
        {revision.author} · {formatDateTime(revision.createdAt)}
      </span>
    </div>
  )
}

import { Link, createFileRoute, notFound, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { MarkdownView } from '#/components/MarkdownView'
import { Breadcrumbs } from '#/components/Breadcrumbs'
import { pageHead } from '#/lib/head'
import { formatDateTime } from '#/lib/format'
import { normalizeSlug } from '#/lib/slug'
import { getBreadcrumbs, getHistory, getPage, type RevisionMeta } from '#/lib/wiki-api'

type HistorySearch = { rev?: number }

// 公開：未登入也能看歷史版本
export const Route = createFileRoute('/history/$')({
  validateSearch: (search: Record<string, unknown>): HistorySearch => {
    const rev = Number(search.rev)
    return Number.isInteger(rev) && rev > 0 ? { rev } : {}
  },
  loaderDeps: ({ search }) => ({ rev: search.rev }),
  loader: async ({ params, deps }) => {
    const slug = normalizeSlug(params._splat ?? '')
    // 有指定 rev 時另外取該版本的內容；版本不存在就顯示歷史列表
    const [page, crumbs, selected] = await Promise.all([
      getHistory(slug),
      getBreadcrumbs(slug),
      deps.rev ? getPage(slug, deps.rev) : null,
    ])
    if (!page) throw notFound()
    return { page, crumbs, selected: selected?.revision }
  },
  head: ({ loaderData }) =>
    pageHead(
      loaderData &&
        (loaderData.selected
          ? `${loaderData.page.title}（第 ${loaderData.selected.rev} 版）`
          : `${loaderData.page.title} 的修訂歷史`),
    ),
  component: HistoryPage,
})

function HistoryPage() {
  const { page, crumbs, selected } = Route.useLoaderData()

  if (selected) {
    return (
      <main>
        <Breadcrumbs crumbs={crumbs} current={`第 ${selected.rev} 版`} />
        <h1>
          {page.title}（第 {selected.rev} 版）
        </h1>
        <MarkdownView markdown={selected.content} />
      </main>
    )
  }

  return (
    <main>
      <Breadcrumbs crumbs={crumbs} current="修訂歷史" />
      <h1>{page.title} 的修訂歷史</h1>
      {page.revisions.length > 1 ? (
        <CompareForm slug={page.slug} revisions={page.revisions} />
      ) : (
        <RevisionList slug={page.slug} revisions={page.revisions} />
      )}
    </main>
  )
}

type ListProps = { slug: string; revisions: RevisionMeta[] }

function RevisionList({ slug, revisions }: ListProps) {
  return (
    <ol reversed className="text-sm">
      {revisions.map((r) => (
        <li key={r.rev}>
          <RevisionLine slug={slug} revision={r} />
        </li>
      ))}
    </ol>
  )
}

// 版本、作者、時間，以及與上一版的差異連結
function RevisionLine({ slug, revision: r }: { slug: string; revision: RevisionMeta }) {
  return (
    <>
      <Link to="/history/$" params={{ _splat: slug }} search={{ rev: r.rev }}>
        第 {r.rev} 版
      </Link>{' '}
      {r.author} · {formatDateTime(r.createdAt)}
      {r.rev > 1 && (
        <>
          {' '}
          <Link to="/diff/$" params={{ _splat: slug }} search={{ from: r.rev - 1, to: r.rev }}>
            差異
          </Link>
        </>
      )}
    </>
  )
}

// 選兩個版本比較：左欄選舊版、右欄選新版（與維基百科相同）
// 舊版只能選比新版早的版本，反之亦然，所以不會選到同一版
function CompareForm({ slug, revisions }: ListProps) {
  const navigate = useNavigate()
  // revisions 由新到舊；預設比較最新的兩個版本
  const [from, setFrom] = useState(revisions[1]!.rev)
  const [to, setTo] = useState(revisions[0]!.rev)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        navigate({ to: '/diff/$', params: { _splat: slug }, search: { from, to } })
      }}
    >
      <ol reversed className="list-none space-y-1 pl-0 text-sm">
        {revisions.map((r) => (
          <li key={r.rev} className="flex items-center gap-2">
            <input
              type="radio"
              name="from"
              aria-label={`第 ${r.rev} 版作為舊版`}
              checked={from === r.rev}
              disabled={r.rev >= to}
              onChange={() => setFrom(r.rev)}
              className="disabled:invisible"
            />
            <input
              type="radio"
              name="to"
              aria-label={`第 ${r.rev} 版作為新版`}
              checked={to === r.rev}
              disabled={r.rev <= from}
              onChange={() => setTo(r.rev)}
              className="disabled:invisible"
            />
            <span>
              <RevisionLine slug={slug} revision={r} />
            </span>
          </li>
        ))}
      </ol>
      <button type="submit" className="btn mt-4">
        比較第 {from} 版與第 {to} 版
      </button>
    </form>
  )
}

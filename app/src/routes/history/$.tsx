import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { MarkdownView } from '#/components/MarkdownView'
import { Breadcrumbs } from '#/components/Breadcrumbs'
import { pageHead } from '#/lib/head'
import { formatDateTime } from '#/lib/format'
import { normalizeSlug } from '#/lib/slug'
import { getBreadcrumbs, getHistory, getPage } from '#/lib/wiki-api'

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
      <ol reversed className="text-sm">
        {page.revisions.map((r) => (
          <li key={r.rev}>
            <Link to="/history/$" params={{ _splat: page.slug }} search={{ rev: r.rev }}>
              第 {r.rev} 版
            </Link>{' '}
            {r.author} · {formatDateTime(r.createdAt)}
            {r.rev > 1 && (
              <>
                {' '}
                <Link
                  to="/diff/$"
                  params={{ _splat: page.slug }}
                  search={{ from: r.rev - 1, to: r.rev }}
                >
                  差異
                </Link>
              </>
            )}
          </li>
        ))}
      </ol>
    </main>
  )
}

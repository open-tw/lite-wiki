import { createFileRoute, notFound } from '@tanstack/react-router'
import { Breadcrumbs } from '#/components/Breadcrumbs'
import { pageHead } from '#/lib/head'
import { normalizeSlug } from '#/lib/slug'
import { getBreadcrumbs, getPage } from '#/lib/wiki-api'

type DiffSearch = { from: number; to: number }

// 公開：未登入也能比較版本
export const Route = createFileRoute('/diff/$')({
  validateSearch: (search: Record<string, unknown>): DiffSearch => ({
    from: Number(search.from) || 1,
    to: Number(search.to) || 1,
  }),
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

  // TODO: 換成真正的 diff 呈現
  return (
    <main>
      <Breadcrumbs crumbs={crumbs} current="版本比較" />
      <h1>
        {page.title}：第 {from.rev} 版 → 第 {to.rev} 版
      </h1>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <pre className="overflow-x-auto rounded-md bg-gray-100 p-3 whitespace-pre-wrap">{from.content}</pre>
        <pre className="overflow-x-auto rounded-md bg-gray-100 p-3 whitespace-pre-wrap">{to.content}</pre>
      </div>
    </main>
  )
}

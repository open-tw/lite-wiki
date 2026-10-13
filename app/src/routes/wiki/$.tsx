import { Link, createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { MarkdownView } from '#/components/MarkdownView'
import { Breadcrumbs } from '#/components/Breadcrumbs'
import { pageHead } from '#/lib/head'
import { normalizeSlug } from '#/lib/slug'
import { getBreadcrumbs, getPage } from '#/lib/wiki-api'

// 公開：未登入也能瀏覽
export const Route = createFileRoute('/wiki/$')({
  beforeLoad: async ({ params }) => {
    const slug = normalizeSlug(params._splat ?? '')
    if (!slug) throw redirect({ to: '/' })
    if (slug !== params._splat) {
      throw redirect({ to: '/wiki/$', params: { _splat: slug }, replace: true })
    }
    // 放在 context 而不是 loader：頁面不存在時 notFoundComponent 也能用
    return { crumbs: await getBreadcrumbs(slug) }
  },
  loader: async ({ params }) => {
    const page = await getPage(params._splat!)
    if (!page) throw notFound()
    return page
  },
  // 頁面不存在時沒有 loaderData，改用麵包屑最後一層的名稱
  head: ({ loaderData, match }) =>
    pageHead(loaderData?.title ?? `${match.context.crumbs.at(-1)?.title}（尚未建立）`),
  component: WikiPage,
  notFoundComponent: PageNotFound,
})

function WikiPage() {
  const page = Route.useLoaderData()
  const { crumbs } = Route.useRouteContext()

  return (
    <main>
      <Breadcrumbs crumbs={crumbs} />
      <h1>{page.title}</h1>
      <nav className="-mt-3 mb-6 flex gap-4 text-sm">
        <Link to="/edit/$" params={{ _splat: page.slug }}>
          編輯
        </Link>
        <Link to="/history/$" params={{ _splat: page.slug }}>
          歷史
        </Link>
        <Link to="/new" search={{ parent: page.slug }}>
          新增子頁面
        </Link>
      </nav>
      <MarkdownView markdown={page.revision.content} />
    </main>
  )
}

function PageNotFound() {
  const { _splat } = Route.useParams()
  const { crumbs } = Route.useRouteContext()

  return (
    <main>
      <Breadcrumbs crumbs={crumbs} />
      <h1>{crumbs.at(-1)?.title}</h1>
      <p>此頁面尚未建立。</p>
      <Link to="/edit/$" params={{ _splat: _splat! }}>
        建立此頁面
      </Link>
    </main>
  )
}

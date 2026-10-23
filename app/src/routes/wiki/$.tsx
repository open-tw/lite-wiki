import { Link, createFileRoute, notFound, redirect, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { MarkdownView } from '#/components/MarkdownView'
import { Breadcrumbs } from '#/components/Breadcrumbs'
import { ConfirmDialog } from '#/components/ConfirmDialog'
import { deletePage } from '#/lib/admin-api'
import { ApiError } from '#/lib/api'
import { hasRole, mayEdit, useAuth } from '#/lib/auth'
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
  const { user } = useAuth()
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <main>
      <Breadcrumbs crumbs={crumbs} />
      <h1>{page.title}</h1>
      <nav className="-mt-3 mb-6 flex gap-4 text-sm">
        {mayEdit(user) && (
          <Link to="/edit/$" params={{ _splat: page.slug }}>
            編輯
          </Link>
        )}
        <Link to="/history/$" params={{ _splat: page.slug }}>
          歷史
        </Link>
        {mayEdit(user) && (
          <Link to="/new" search={{ parent: page.slug }}>
            新增子頁面
          </Link>
        )}
        {hasRole(user, 'admin') && (
          <button
            type="button"
            className="cursor-pointer text-red-600 hover:underline"
            onClick={() => setConfirming(true)}
          >
            刪除
          </button>
        )}
      </nav>
      {error && <p role="alert">刪除失敗：{error}</p>}
      <MarkdownView markdown={page.revision.content} />
      {hasRole(user, 'admin') && (
        <ConfirmDialog
          open={confirming}
          title="刪除頁面"
          confirmLabel="刪除"
          cancelLabel="取消"
          onCancel={() => setConfirming(false)}
          onConfirm={async () => {
            setConfirming(false)
            setError(null)
            try {
              await deletePage(page.slug)
            } catch (err) {
              setError(err instanceof ApiError ? err.message : '無法連線到伺服器，請稍後再試。')
              return
            }
            navigate({ to: '/pages' })
          }}
        >
          <p>確定要刪除「{page.title}」嗎？子頁面不受影響。刪除後可以在「已刪除的頁面」還原。</p>
        </ConfirmDialog>
      )}
    </main>
  )
}

function PageNotFound() {
  const { _splat } = Route.useParams()
  const { crumbs } = Route.useRouteContext()
  const { user } = useAuth()

  return (
    <main>
      <Breadcrumbs crumbs={crumbs} />
      <h1>{crumbs.at(-1)?.title}</h1>
      <p>此頁面尚未建立。</p>
      {mayEdit(user) && (
        <Link to="/edit/$" params={{ _splat: _splat! }}>
          建立此頁面
        </Link>
      )}
    </main>
  )
}

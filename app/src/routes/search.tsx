import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { searchPages } from '#/lib/wiki-api'
import { pageHead } from '#/lib/head'

type SearchParams = { q?: string }

export const Route = createFileRoute('/search')({
  validateSearch: (search: Record<string, unknown>): SearchParams =>
    typeof search.q === 'string' && search.q.trim() ? { q: search.q.trim() } : {},
  loaderDeps: ({ search }) => ({ q: search.q }),
  loader: ({ deps }) => (deps.q ? searchPages(deps.q) : []),
  head: ({ match }) => pageHead(match.search.q ? `搜尋：${match.search.q}` : '搜尋'),
  component: SearchPage,
})

function SearchPage() {
  const { q } = Route.useSearch()
  const results = Route.useLoaderData()
  const navigate = useNavigate({ from: Route.fullPath })

  return (
    <main>
      <h1>搜尋</h1>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const value = new FormData(e.currentTarget).get('q')
          navigate({ search: { q: String(value ?? '') } })
        }}
      >
        <input name="q" className="input" defaultValue={q} key={q} />
        <button type="submit" className="btn btn-primary shrink-0">
          搜尋
        </button>
      </form>
      {q && (
        <ul className="mt-6">
          {results.map((p) => (
            <li key={p.slug}>
              <Link to="/wiki/$" params={{ _splat: p.slug }}>
                {p.title}
              </Link>
            </li>
          ))}
          {results.length === 0 && <li>找不到「{q}」</li>}
        </ul>
      )}
    </main>
  )
}

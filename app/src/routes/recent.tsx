import { Link, createFileRoute } from '@tanstack/react-router'
import { listRecent } from '#/lib/wiki-api'
import { formatDateTime } from '#/lib/format'
import { pageHead } from '#/lib/head'

export const Route = createFileRoute('/recent')({
  loader: () => listRecent(50),
  head: () => pageHead('最近變更'),
  component: RecentChanges,
})

function RecentChanges() {
  const changes = Route.useLoaderData()

  return (
    <main>
      <h1>最近變更</h1>
      <ul>
        {changes.map((c) => (
          <li key={`${c.slug}@${c.rev}`}>
            <Link to="/wiki/$" params={{ _splat: c.slug }}>
              {c.title}
            </Link>{' '}
            第 {c.rev} 版 · {c.author} · {formatDateTime(c.createdAt)}
          </li>
        ))}
      </ul>
    </main>
  )
}

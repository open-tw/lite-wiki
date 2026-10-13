import { Link } from '@tanstack/react-router'
import type { Crumb } from '#/lib/wiki-api'

type Props = {
  crumbs: Crumb[]
  // 給了 current 時，crumbs 全部都是連結，最後再接上 current（例如「編輯」）；
  // 沒給時，最後一個 crumb 就是目前頁面，不做成連結
  current?: string
}

export function Breadcrumbs({ crumbs, current }: Props) {
  const linked = current === undefined ? crumbs.slice(0, -1) : crumbs
  const last = current ?? crumbs.at(-1)?.title

  return (
    <nav aria-label="麵包屑" className="mb-4">
      <ol className="m-0 flex list-none flex-wrap gap-1 p-0 text-sm text-gray-500 [&>li+li]:before:mr-1 [&>li+li]:before:text-gray-400 [&>li+li]:before:content-['/']">
        <li>
          <Link to="/">首頁</Link>
        </li>
        {linked.map((c) => (
          <li key={c.slug}>
            <Link
              to="/wiki/$"
              params={{ _splat: c.slug }}
              // 尚未建立的頁面，類似維基百科的紅色連結
              className={c.exists ? undefined : 'text-red-600'}
              title={c.exists ? undefined : '此頁面尚未建立'}
            >
              {c.title}
            </Link>
          </li>
        ))}
        {last !== undefined && <li aria-current="page">{last}</li>}
      </ol>
    </nav>
  )
}

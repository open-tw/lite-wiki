import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { URL_NAME_PATTERN, normalizeSlug, suggestUrlName } from '#/lib/slug'
import { listPages } from '#/lib/wiki-api'
import { pageHead } from '#/lib/head'

// 需要 editor 以上：守衛在 _auth.tsx（登入）與 _auth/_editor.tsx（角色）
export const Route = createFileRoute('/_auth/_editor/new')({
  validateSearch: (search: Record<string, unknown>): { parent?: string } =>
    typeof search.parent === 'string' && normalizeSlug(search.parent)
      ? { parent: normalizeSlug(search.parent) }
      : {},
  // TODO: 頁面多了之後，改成依輸入呼叫 API 檢查 slug 是否存在
  loader: async () => (await listPages()).map((p) => p.slug).sort(),
  head: () => pageHead('新增頁面'),
  component: NewPage,
})

function NewPage() {
  const { parent: initialParent } = Route.useSearch()
  const slugs = Route.useLoaderData()
  const navigate = useNavigate()
  const [parent, setParent] = useState(initialParent ?? '')
  const [title, setTitle] = useState('')
  // 使用者手動改過網址名稱後，就不再跟著標題自動更新
  const [customName, setCustomName] = useState<string | null>(null)

  const name = customName ?? suggestUrlName(title)
  const hasTitle = title.trim() !== ''
  const validName = URL_NAME_PATTERN.test(name)
  const slug = normalizeSlug(`${parent}/${name}`)
  const exists = validName && slugs.includes(slug)
  const canSubmit = hasTitle && validName && !exists

  return (
    <main>
      <h1>新增頁面</h1>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (!canSubmit) return
          navigate({ to: '/edit/$', params: { _splat: slug }, search: { title: title.trim() } })
        }}
      >
        <label className="block text-sm font-medium">
          上層頁面
          <input
            list="page-slugs"
            className="input mt-1"
            value={parent}
            onChange={(e) => setParent(e.target.value)}
            placeholder="留空表示最上層"
          />
          <datalist id="page-slugs">
            {slugs.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>

        <label className="block text-sm font-medium">
          頁面標題
          <input
            value={title}
            className="input mt-1"
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：Hooks 入門"
            autoFocus
            required
          />
        </label>

        <label className="block text-sm font-medium">
          網址名稱
          <input
            value={name}
            className="input mt-1"
            onChange={(e) => setCustomName(e.target.value.toLowerCase())}
            placeholder="例如：hooks-intro"
            required
          />
          <small className="mt-1 block text-gray-500">只能使用英文小寫、數字和 -</small>
        </label>

        <p>
          網址預覽：<code>{validName ? `/wiki/${slug}` : '—'}</code>
        </p>
        {name !== '' && !validName && (
          <p role="alert">網址名稱格式不正確：只能使用英文小寫、數字和 -，且不能以 - 開頭或結尾。</p>
        )}
        {exists && (
          <p role="alert">
            此網址已有頁面 →{' '}
            <Link to="/wiki/$" params={{ _splat: slug }}>
              前往該頁
            </Link>
          </p>
        )}

        <div className="flex items-center justify-end gap-4">
          {initialParent ? (
            <Link to="/wiki/$" params={{ _splat: initialParent }}>
              取消
            </Link>
          ) : (
            <Link to="/">取消</Link>
          )}
          <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
            下一步：編輯內容
          </button>
        </div>
      </form>
    </main>
  )
}

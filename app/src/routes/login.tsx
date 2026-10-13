import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { ApiError } from '#/lib/api'
import { auth } from '#/lib/auth'
import { pageHead } from '#/lib/head'

// 只接受站內路徑，避免 open redirect
function sanitizeRedirect(url: unknown) {
  return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') ? url : '/'
}

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    search.redirect === undefined ? {} : { redirect: sanitizeRedirect(search.redirect) },
  beforeLoad: ({ context, search }) => {
    if (context.auth.get().user) throw redirect({ href: search.redirect ?? '/' })
  },
  head: () => pageHead('登入'),
  component: LoginPage,
})

function LoginPage() {
  const { redirect: to } = Route.useSearch()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  return (
    <main>
      <h1>登入</h1>
      <form
        className="max-w-xs space-y-3"
        onSubmit={async (e) => {
          e.preventDefault()
          const form = new FormData(e.currentTarget)
          const name = String(form.get('name') ?? '').trim()
          const password = String(form.get('password') ?? '')
          if (!name || !password) return
          setPending(true)
          setError(null)
          try {
            await auth.login(name, password)
          } catch (err) {
            setError(err instanceof ApiError ? err.message : '無法連線到伺服器')
            setPending(false)
            return
          }
          // redirect 是含 search 的完整站內 href，用 history.push 原樣導回
          router.history.push(to ?? '/')
        }}
      >
        <input name="name" className="input" placeholder="使用者名稱" autoComplete="username" required />
        <input
          name="password"
          className="input"
          type="password"
          placeholder="密碼"
          autoComplete="current-password"
          required
        />
        <button type="submit" className="btn btn-primary" disabled={pending}>
          登入
        </button>
        {error && <p role="alert">{error}</p>}
      </form>
    </main>
  )
}

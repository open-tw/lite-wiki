import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { ApiError } from '#/lib/api'
import { ROLE_LABELS, useAuth } from '#/lib/auth'
import { pageHead } from '#/lib/head'

// 需登入：守衛在 _auth.tsx；所有角色都能修改自己的密碼
export const Route = createFileRoute('/_auth/account')({
  head: () => pageHead('我的帳號'),
  component: AccountPage,
})

function AccountPage() {
  const { user } = useAuth()
  const { auth } = Route.useRouteContext()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pending, setPending] = useState(false)

  if (!user) return null

  return (
    <main>
      <h1>我的帳號</h1>
      <p>
        {user.name}
        <span className="ml-2 rounded-full bg-gray-100 px-2.5 py-0.5 text-sm text-gray-600">
          {ROLE_LABELS[user.role]}
        </span>
      </p>

      <h2 className="mt-8">修改密碼</h2>
      <form
        className="max-w-xs space-y-3"
        onSubmit={async (e) => {
          e.preventDefault()
          const formEl = e.currentTarget
          const form = new FormData(formEl)
          const current = String(form.get('current') ?? '')
          const next = String(form.get('next') ?? '')
          setError(null)
          setDone(false)
          if (next !== form.get('confirm')) {
            setError('兩次輸入的新密碼不一致')
            return
          }
          setPending(true)
          try {
            await auth.changePassword(current, next)
            formEl.reset()
            setDone(true)
          } catch (err) {
            if (err instanceof ApiError && err.status === 401) auth.clear()
            setError(err instanceof ApiError ? err.message : '無法連線到伺服器，請稍後再試。')
          } finally {
            setPending(false)
          }
        }}
      >
        <input
          name="current"
          type="password"
          className="input"
          placeholder="目前的密碼"
          autoComplete="current-password"
          required
        />
        <input
          name="next"
          type="password"
          className="input"
          placeholder="新密碼（至少 8 個字）"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <input
          name="confirm"
          type="password"
          className="input"
          placeholder="再輸入一次新密碼"
          autoComplete="new-password"
          required
        />
        <button type="submit" className="btn btn-primary" disabled={pending}>
          修改密碼
        </button>
        {error && <p role="alert">{error}</p>}
        {done && <p className="text-sm text-green-700">密碼已更新，其他裝置上的登入已登出。</p>}
      </form>
    </main>
  )
}

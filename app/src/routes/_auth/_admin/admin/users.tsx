import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { ApiError } from '#/lib/api'
import { createUser, listUsers, updateUser, type ManagedUser } from '#/lib/admin-api'
import { ROLE_LABELS, useAuth, type Role } from '#/lib/auth'
import { formatDateTime } from '#/lib/format'
import { pageHead } from '#/lib/head'

const ROLES: Role[] = ['admin', 'editor', 'viewer']

// 需要 admin：守衛在 _auth/_admin.tsx
export const Route = createFileRoute('/_auth/_admin/admin/users')({
  loader: () => listUsers(),
  head: () => pageHead('帳號管理'),
  component: UsersPage,
})

function errorMessage(err: unknown) {
  return err instanceof ApiError ? err.message : '無法連線到伺服器，請稍後再試。'
}

function UsersPage() {
  const users = Route.useLoaderData()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  // 每次修改後重新載入列表，畫面以後端為準
  async function run(action: () => Promise<unknown>) {
    setError(null)
    try {
      await action()
      await router.invalidate()
      return true
    } catch (err) {
      setError(errorMessage(err))
      return false
    }
  }

  return (
    <main>
      <h1>帳號管理</h1>
      {/* 中文句子之間不要有空白，JSX 跨行會插入空格，所以拆成字串相接 */}
      <p className="text-sm text-gray-600">
        {'檢視者只能瀏覽；編輯者可以建立、編輯頁面與上傳圖片；管理員另外可以刪除、還原頁面與管理帳號。' +
          '帳號無法刪除（修訂紀錄會引用作者），不再使用的帳號請停用。'}
      </p>

      <CreateUserForm onCreate={(input) => run(() => createUser(input))} />

      {error && <p role="alert">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2">帳號</th>
              <th className="px-4 py-2">角色</th>
              <th className="px-4 py-2">建立時間</th>
              <th className="px-4 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <UserRow key={u.id} user={u} run={run} />
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}

function CreateUserForm({
  onCreate,
}: {
  onCreate: (input: { username: string; password: string; role: Role }) => Promise<boolean>
}) {
  const [pending, setPending] = useState(false)

  return (
    <form
      className="my-6 flex flex-wrap items-end gap-2 rounded-lg border border-gray-200 p-4"
      onSubmit={async (e) => {
        e.preventDefault()
        const formEl = e.currentTarget
        const form = new FormData(formEl)
        setPending(true)
        const ok = await onCreate({
          username: String(form.get('username') ?? '').trim(),
          password: String(form.get('password') ?? ''),
          role: form.get('role') as Role,
        })
        setPending(false)
        if (ok) formEl.reset()
      }}
    >
      <h2 className="m-0 w-full text-base">新增帳號</h2>
      <input name="username" className="input w-40" placeholder="帳號" autoComplete="off" required />
      <input
        name="password"
        type="password"
        className="input w-48"
        placeholder="初始密碼（至少 8 個字）"
        autoComplete="new-password"
        minLength={8}
        required
      />
      <select name="role" className="input w-auto" defaultValue="editor" aria-label="角色">
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </select>
      <button type="submit" className="btn btn-primary" disabled={pending}>
        新增
      </button>
    </form>
  )
}

function UserRow({ user, run }: { user: ManagedUser; run: (action: () => Promise<unknown>) => Promise<boolean> }) {
  const { user: me } = useAuth()
  const self = me?.name === user.username
  const [resetting, setResetting] = useState(false)

  return (
    <tr className={user.disabled ? 'text-gray-400' : undefined}>
      <td className="px-4 py-3 font-medium">
        {user.username}
        {self && <span className="ml-2 text-xs font-normal text-gray-500">（你）</span>}
        {user.disabled && <span className="ml-2 text-xs font-normal text-red-600">已停用</span>}
      </td>
      <td className="px-4 py-3">
        {/* 不能改自己的角色，避免把自己鎖在外面（後端同樣會擋） */}
        <select
          className="input w-auto py-1"
          value={user.role}
          disabled={self}
          aria-label={`${user.username} 的角色`}
          onChange={(e) => run(() => updateUser(user.id, { role: e.target.value as Role }))}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(user.createdAt)}</td>
      <td className="px-4 py-3">
        {resetting ? (
          <form
            className="flex justify-end gap-2"
            onSubmit={async (e) => {
              e.preventDefault()
              const password = String(new FormData(e.currentTarget).get('password') ?? '')
              if (await run(() => updateUser(user.id, { password }))) setResetting(false)
            }}
          >
            <input
              name="password"
              type="password"
              className="input w-40 py-1"
              placeholder="新密碼"
              autoComplete="new-password"
              minLength={8}
              required
              autoFocus
            />
            <button type="submit" className="btn">
              確定
            </button>
            <button type="button" className="btn" onClick={() => setResetting(false)}>
              取消
            </button>
          </form>
        ) : (
          <div className="flex justify-end gap-2 whitespace-nowrap">
            {/* 自己的密碼在「我的帳號」修改，需要輸入目前的密碼 */}
            {!self && (
              <button type="button" className="btn" onClick={() => setResetting(true)}>
                重設密碼
              </button>
            )}
            {!self && (
              <button
                type="button"
                className="btn"
                onClick={() => run(() => updateUser(user.id, { disabled: !user.disabled }))}
              >
                {user.disabled ? '啟用' : '停用'}
              </button>
            )}
          </div>
        )}
      </td>
    </tr>
  )
}

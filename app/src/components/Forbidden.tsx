import { ErrorComponent, Link, type ErrorComponentProps } from '@tanstack/react-router'
import { hasRole, type Role, type auth } from '#/lib/auth'

// 角色不足時由 layout 的 beforeLoad 拋出，交給 roleErrorComponent 顯示
export class ForbiddenError extends Error {}

// 給 _editor、_admin 這類 layout 的 beforeLoad 用：已登入（_auth 守衛）但角色不足時拋出 ForbiddenError
export function requireRole(context: { auth: typeof auth }, role: Role) {
  if (!hasRole(context.auth.get().user, role)) throw new ForbiddenError()
}

export function roleErrorComponent({ error }: ErrorComponentProps) {
  if (!(error instanceof ForbiddenError)) return <ErrorComponent error={error} />
  return (
    <main>
      <h1>沒有權限</h1>
      <p>你的帳號沒有權限使用這個頁面。如果需要，請聯絡管理員調整角色。</p>
      <Link to="/">回首頁</Link>
    </main>
  )
}

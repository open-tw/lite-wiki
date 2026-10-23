import { createFileRoute } from '@tanstack/react-router'
import { requireRole, roleErrorComponent } from '#/components/Forbidden'

// 無路徑 layout：放在 _admin/ 底下的路由（帳號管理、已刪除的頁面）需要 admin
export const Route = createFileRoute('/_auth/_admin')({
  beforeLoad: ({ context }) => requireRole(context, 'admin'),
  errorComponent: roleErrorComponent,
})

import { createFileRoute } from '@tanstack/react-router'
import { requireRole, roleErrorComponent } from '#/components/Forbidden'

// 無路徑 layout：放在 _editor/ 底下的路由（建立、編輯頁面）需要 editor 以上
export const Route = createFileRoute('/_auth/_editor')({
  beforeLoad: ({ context }) => requireRole(context, 'editor'),
  errorComponent: roleErrorComponent,
})

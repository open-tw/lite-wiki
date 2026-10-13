import { createFileRoute, redirect } from '@tanstack/react-router'

// 無路徑 layout：放在 _auth/ 底下的路由都需要登入（component 預設為 Outlet）
export const Route = createFileRoute('/_auth')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.get().user) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
  },
})

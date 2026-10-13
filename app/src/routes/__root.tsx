import {
  HeadContent,
  Link,
  Outlet,
  createRootRouteWithContext,
  useRouter,
} from "@tanstack/react-router";

import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";

import { auth, useAuth } from "#/lib/auth";
import { pageHead } from "#/lib/head";
import "../styles.css";

export type RouterContext = {
  auth: typeof auth;
};

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => pageHead(),
  component: RootComponent,
  // 全站 404：找不到路由，或子路由 throw notFound() 但自己沒有 notFoundComponent
  notFoundComponent: () => (
    <main>
      <h1>找不到頁面</h1>
      <Link to="/">回首頁</Link>
    </main>
  ),
});

function RootComponent() {
  return (
    <>
      <HeadContent />
      <Header />
      <Outlet />
      {/* 只在開發模式顯示；production build 時由 vite.config.ts 的 devtools() 移除 */}
      <TanStackDevtools
        config={{
          position: "bottom-right",
        }}
        plugins={[
          {
            name: "TanStack Router",
            render: <TanStackRouterDevtoolsPanel />,
          },
        ]}
      />
    </>
  );
}

function Header() {
  const { user } = useAuth();
  const router = useRouter();

  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-gray-200 px-4 py-3">
      <nav className="flex flex-wrap gap-x-4 gap-y-1">
        <Link to="/">Lite Wiki</Link>
        <Link to="/pages">所有頁面</Link>
        <Link to="/recent">最近變更</Link>
        <Link to="/search">搜尋</Link>
        <Link to="/new">＋ 新增頁面</Link>
      </nav>
      {user ? (
        <span className="flex items-center gap-2 text-sm">
          {user.name}
          <button
            className="btn"
            onClick={async () => {
              await auth.logout();
              router.invalidate();
            }}
          >
            登出
          </button>
        </span>
      ) : (
        <Link to="/login">登入</Link>
      )}
    </header>
  );
}

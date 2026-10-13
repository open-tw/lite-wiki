# app — Lite Wiki 前端

React 19 + TanStack Router + Tailwind CSS 的單頁應用。安裝與啟動方式見[根目錄 README](../README.md)。

```bash
npm install
npm run dev     # http://localhost:3000，/api 會轉給後端 http://localhost:3001
npm run build   # 輸出到 dist/
```

- 路由檔案放在 `src/routes/`，`src/routeTree.gen.ts` 由 TanStack Router 自動產生，不要手動修改
- 呼叫後端的函式集中在 `src/lib/wiki-api.ts`、`src/lib/auth.ts`

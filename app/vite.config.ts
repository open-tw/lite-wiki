import { defineConfig } from "vite";

import { tanstackRouter } from "@tanstack/router-plugin/vite";

import viteReact from "@vitejs/plugin-react";

import tailwindcss from "@tailwindcss/vite";

import { devtools } from "@tanstack/devtools-vite";

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    tailwindcss(),
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    viteReact(),
  ],
  // 開發時把 /api 轉給後端（server/，預設 3001），前後端同源，cookie 不必處理 CORS
  server: {
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});

export default config;

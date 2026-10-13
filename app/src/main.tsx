import ReactDOM from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { getRouter } from './router'
import { auth } from './lib/auth'

const router = getRouter()

const rootElement = document.getElementById('app')!

// 先向後端確認登入狀態，_auth 守衛和 Header 才能同步讀取
auth.init().then(() => {
  if (!rootElement.innerHTML) {
    const root = ReactDOM.createRoot(rootElement)
    root.render(<RouterProvider router={router} />)
  }
})

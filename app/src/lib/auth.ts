import { useSyncExternalStore } from 'react'
import { api } from './api'

// 登入狀態以後端 session cookie 為準；這裡只是給 UI 和路由守衛同步讀取的快取
export type User = { name: string }

export type AuthState = {
  user: User | null
}

let state: AuthState = { user: null }
const listeners = new Set<() => void>()

function setUser(user: User | null) {
  state = { user }
  listeners.forEach((l) => l())
}

export const auth = {
  get: () => state,
  // App 啟動時呼叫一次，確認 cookie 裡的 session 是否還有效
  async init() {
    try {
      const { user } = await api<{ user: User | null }>('/auth/me')
      setUser(user)
    } catch {
      setUser(null)
    }
  },
  // 帳密錯誤時拋出 401 的 ApiError
  async login(username: string, password: string) {
    const { user } = await api<{ user: User }>('/auth/login', {
      method: 'POST',
      json: { username, password },
    })
    setUser(user)
  },
  async logout() {
    try {
      await api('/auth/logout', { method: 'POST' })
    } finally {
      setUser(null)
    }
  },
  // 後端回 401（session 過期）時，讓前端狀態跟著登出
  clear() {
    setUser(null)
  },
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}

export function useAuth() {
  return useSyncExternalStore(auth.subscribe, auth.get)
}

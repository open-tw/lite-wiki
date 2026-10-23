import { useSyncExternalStore } from 'react'
import { api } from './api'

// 登入狀態以後端 session cookie 為準；這裡只是給 UI 和路由守衛同步讀取的快取
// 角色同樣以後端為準：前端只用來決定要不要顯示按鈕，實際權限由 API 檢查（403）
export type Role = 'admin' | 'editor' | 'viewer'
export type User = { name: string; role: Role }

export const ROLE_LABELS: Record<Role, string> = { admin: '管理員', editor: '編輯者', viewer: '檢視者' }

// 權限由低到高：viewer < editor < admin（與 server/src/auth.ts 相同）
const RANK: Record<Role, number> = { viewer: 0, editor: 1, admin: 2 }

export function hasRole(user: User | null, role: Role) {
  return !!user && RANK[user.role] >= RANK[role]
}

// 顯示「編輯」「新增頁面」等連結：未登入也顯示（點了會先導向登入），viewer 不顯示
export function mayEdit(user: User | null) {
  return !user || hasRole(user, 'editor')
}

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
  // 目前密碼錯誤或新密碼太短時拋出 400 的 ApiError；成功後其他裝置會被登出
  async changePassword(currentPassword: string, newPassword: string) {
    await api('/auth/password', { method: 'POST', json: { currentPassword, newPassword } })
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

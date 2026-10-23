import { api, slugPath } from './api'
import type { Role } from './auth'

// 帳號管理與頁面刪除／還原，都需要 admin；型別對應 server/docs/api.md
export type ManagedUser = { id: string; username: string; role: Role; disabled: boolean; createdAt: string }
export type DeletedPage = { slug: string; title: string; deletedAt: string; deletedBy: string }

export function listUsers() {
  return api<ManagedUser[]>('/users')
}

// 帳號重複時拋出 409 的 ApiError
export function createUser(input: { username: string; password: string; role: Role }) {
  return api<ManagedUser>('/users', { method: 'POST', json: input })
}

// 只送要改的欄位；password 為重設密碼
export function updateUser(id: string, changes: { role?: Role; disabled?: boolean; password?: string }) {
  return api<ManagedUser>(`/users/${id}`, { method: 'PATCH', json: changes })
}

export function deletePage(slug: string) {
  return api<void>(`/pages/${slugPath(slug)}`, { method: 'DELETE' })
}

export function listDeleted() {
  return api<DeletedPage[]>('/deleted')
}

export function restorePage(slug: string) {
  return api<{ slug: string; rev: number }>(`/restore/${slugPath(slug)}`, { method: 'POST' })
}

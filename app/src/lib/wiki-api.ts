import { ApiError, api, slugPath } from './api'

// 型別對應 server/docs/api.md
export type Revision = { rev: number; content: string; author: string; createdAt: string }
export type RevisionMeta = Omit<Revision, 'content'>
export type Page = { slug: string; title: string; currentRev: number; revision: Revision }
export type PageSummary = { slug: string; title: string; updatedAt: string }
export type PageHistory = { slug: string; title: string; revisions: RevisionMeta[] }
export type RecentChange = RevisionMeta & { slug: string; title: string }
export type Crumb = { slug: string; title: string; exists: boolean }

// 404 轉成 null，其他錯誤照常拋出
async function orNull<T>(promise: Promise<T>) {
  try {
    return await promise
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

// 沒給 rev 時取最新版本；頁面或版本不存在回 null
export function getPage(slug: string, rev?: number) {
  return orNull(api<Page>(`/pages/${slugPath(slug)}${rev ? `?rev=${rev}` : ''}`))
}

export function getHistory(slug: string) {
  return orNull(api<PageHistory>(`/revisions/${slugPath(slug)}`))
}

export function listPages() {
  return api<PageSummary[]>('/pages')
}

export function listRecent(limit = 50) {
  return api<RecentChange[]>(`/recent?limit=${limit}`)
}

export function searchPages(q: string) {
  return api<{ slug: string; title: string }[]>(`/search?q=${encodeURIComponent(q)}`)
}

// 作者由後端從登入 session 取得
// title 只在新建頁面時使用；baseRev 是編輯時載入的版本，有人先存過會拋出 409 的 ApiError
export function savePage(slug: string, content: string, opts: { title?: string; baseRev?: number } = {}) {
  return api<{ slug: string; rev: number }>(`/pages/${slugPath(slug)}`, {
    method: 'PUT',
    json: { content, ...opts },
  })
}

// 上傳圖片，回傳可放進 Markdown 的網址；超過 5MB（413）或格式不支援（415）會拋出 ApiError
export async function uploadImage(file: File) {
  const body = new FormData()
  body.append('file', file)
  // 不手動設定 Content-Type，讓瀏覽器帶上 multipart 的 boundary
  const { url } = await api<{ url: string }>('/uploads', { method: 'POST', body })
  return url
}

// 麵包屑：從最上層到 slug 本身的每一層；不存在的頁面用網址那一段當標題
export function getBreadcrumbs(slug: string) {
  return api<Crumb[]>(`/breadcrumbs/${slugPath(slug)}`)
}

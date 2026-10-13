export const SITE_NAME = 'Lite Wiki'

// 路由 head 用：瀏覽器分頁標題為「頁面標題 - Lite Wiki」
export function pageHead(title?: string) {
  return { meta: [{ title: title ? `${title} - ${SITE_NAME}` : SITE_NAME }] }
}

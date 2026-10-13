// 統一頁面 slug：小寫、空白轉 -、去除多餘的 /
export function normalizeSlug(raw: string) {
  return raw
    .split('/')
    .map((s) => s.trim().toLowerCase().replace(/\s+/g, '-'))
    .filter(Boolean)
    .join('/')
}

// 新頁面的網址名稱（單一段）：只允許英文小寫、數字和 -
export const URL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// 從標題產生建議的網址名稱；非英數字元會被去掉，純中文標題會得到空字串
export function suggestUrlName(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

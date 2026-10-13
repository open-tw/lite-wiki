// 與前端 app/src/lib/slug.ts 的 normalizeSlug 相同：小寫、空白轉 -、去除多餘的 /
export function normalizeSlug(raw: string) {
  return raw
    .split('/')
    .map((s) => s.trim().toLowerCase().replace(/\s+/g, '-'))
    .filter(Boolean)
    .join('/')
}

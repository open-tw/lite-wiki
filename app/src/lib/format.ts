// API 回傳的 ISO 時間轉成在地時間顯示
export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('zh-TW', { dateStyle: 'medium', timeStyle: 'short' })
}

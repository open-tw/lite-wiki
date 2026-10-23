// 帳號與密碼的格式檢查；API 與 user:create 腳本共用，回傳錯誤訊息，沒問題回 null
export const MIN_PASSWORD_LENGTH = 8

export function usernameError(username: string) {
  if (!username) return '請輸入帳號'
  if (username.length > 32) return '帳號不可超過 32 個字'
  if (/\s/.test(username)) return '帳號不可包含空白'
  return null
}

export function passwordError(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) return `密碼至少要 ${MIN_PASSWORD_LENGTH} 個字`
  return null
}

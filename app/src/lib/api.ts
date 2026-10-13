// 呼叫後端 /api 的共用 fetch；開發時由 Vite proxy 轉到後端（見 vite.config.ts）
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    // 錯誤回應的完整 body，例如 409 時帶回的 currentRev
    readonly body: Record<string, unknown> = {},
  ) {
    super(message)
  }
}

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {}
  const res = await fetch(`/api${path}`, {
    ...rest,
    headers: json === undefined ? rest.headers : { 'Content-Type': 'application/json', ...rest.headers },
    body: json === undefined ? rest.body : JSON.stringify(json),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(res.status, typeof body.error === 'string' ? body.error : res.statusText, body)
  }
  return (res.status === 204 ? undefined : await res.json()) as T
}

// slug 含 /，每一段分別編碼，保留 / 當路徑分隔
export function slugPath(slug: string) {
  return slug.split('/').map(encodeURIComponent).join('/')
}

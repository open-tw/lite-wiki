import { createFileRoute, useBlocker, useNavigate, useRouter } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { MarkdownEditor } from '#/components/MarkdownEditor'
import { Breadcrumbs } from '#/components/Breadcrumbs'
import { pageHead } from '#/lib/head'
import { ConfirmDialog } from '#/components/ConfirmDialog'
import { ApiError } from '#/lib/api'
import { normalizeSlug } from '#/lib/slug'
import { getBreadcrumbs, getPage, savePage, uploadImage } from '#/lib/wiki-api'

// 需要 editor 以上：守衛在 _auth.tsx（登入）與 _auth/_editor.tsx（角色）
export const Route = createFileRoute('/_auth/_editor/edit/$')({
  // title：從 /new 帶過來的原始標題，只在新建時使用
  validateSearch: (search: Record<string, unknown>): { title?: string } =>
    typeof search.title === 'string' && search.title.trim() ? { title: search.title.trim() } : {},
  loader: async ({ params }) => {
    const slug = normalizeSlug(params._splat ?? '')
    const [page, crumbs] = await Promise.all([getPage(slug), getBreadcrumbs(slug)])
    return { slug, page, crumbs }
  },
  head: ({ loaderData, match }) =>
    pageHead(
      loaderData?.page
        ? `編輯：${loaderData.page.title}`
        : `建立：${match.search.title ?? loaderData?.slug}`,
    ),
  component: EditPage,
})

function EditPage() {
  const { slug, page, crumbs } = Route.useLoaderData()
  const { title } = Route.useSearch()
  const { auth } = Route.useRouteContext()
  const navigate = useNavigate()
  const router = useRouter()
  const original = page?.revision.content ?? ''
  // MDXEditor 預設會 trim，且載入時會整理一次內容；以整理後的結果當作「未修改」的基準
  const [baseline, setBaseline] = useState(original.trim())
  const [content, setContent] = useState(original.trim())
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const dirty = content !== baseline
  // 存檔後的跳轉不需要提醒；用 ref 才能在同一個事件中立即生效
  const saved = useRef(false)

  const blocker = useBlocker({
    shouldBlockFn: () => dirty && !saved.current,
    // 重新整理或關閉分頁時，改由瀏覽器顯示內建的提醒（文字無法自訂）
    enableBeforeUnload: () => dirty && !saved.current,
    withResolver: true,
  })

  return (
    <main>
      <Breadcrumbs
        // 新建時頁面還不存在，用 /new 帶來的標題顯示最後一層
        crumbs={crumbs.map((c) => (c.slug === slug && title && !c.exists ? { ...c, title } : c))}
        current={page ? '編輯' : '建立'}
      />
      <h1>{page ? `編輯：${page.title}` : `建立：${title ?? slug}`}</h1>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          setSaving(true)
          setSaveError(null)
          try {
            // baseRev：載入時的最新版本，讓後端偵測是否有人先存過
            await savePage(slug, content, { title, baseRev: page?.currentRev })
          } catch (err) {
            setSaving(false)
            if (err instanceof ApiError && err.status === 401) {
              auth.clear()
              setSaveError('登入已過期，請在新分頁重新登入後再儲存（目前的內容不會遺失）。')
            } else if (err instanceof ApiError && err.status === 409) {
              setSaveError('這個頁面已被其他人更新。請先複製你的內容，重新載入後再合併修改。')
            } else {
              setSaveError(err instanceof ApiError ? err.message : '無法連線到伺服器，請稍後再試。')
            }
            return
          }
          saved.current = true
          // 讓已快取的 loader 資料失效，回到檢視頁時拿到最新版本
          await router.invalidate()
          navigate({ to: '/wiki/$', params: { _splat: slug } })
        }}
      >
        <MarkdownEditor
          markdown={original}
          original={original}
          onChange={(markdown, initialNormalize) => {
            if (initialNormalize) setBaseline(markdown)
            setContent(markdown)
          }}
          onError={setError}
          onUploadImage={async (file) => {
            setUploadError(null)
            try {
              return await uploadImage(file)
            } catch (err) {
              // MDXEditor 只會把錯誤印在 console，這裡自己顯示；仍要拋出，編輯器才不會插入圖片
              if (err instanceof ApiError && err.status === 401) {
                auth.clear()
                setUploadError('登入已過期，請在新分頁重新登入後再上傳。')
              } else {
                setUploadError(err instanceof ApiError ? err.message : '無法連線到伺服器，請稍後再試。')
              }
              throw err
            }
          }}
        />
        {error && <p role="alert">Markdown 解析失敗：{error}</p>}
        {uploadError && <p role="alert">圖片上傳失敗：{uploadError}</p>}
        {saveError && <p role="alert">儲存失敗：{saveError}</p>}
        <div className="flex items-center justify-end gap-4">
          <button type="submit" className="btn btn-primary" disabled={!dirty || saving}>
            儲存
          </button>
        </div>
      </form>
      <ConfirmDialog
        open={blocker.status === 'blocked'}
        title="尚未儲存的變更"
        confirmLabel="放棄變更並離開"
        cancelLabel="繼續編輯"
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      >
        <p>這個頁面有尚未儲存的變更，離開後將會遺失。</p>
      </ConfirmDialog>
    </main>
  )
}

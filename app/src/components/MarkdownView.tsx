import { useRouter } from '@tanstack/react-router'
import Markdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'

// 檢視頁的 Markdown 渲染；rehype-sanitize 會過濾內容中的 HTML，避免 XSS
export function MarkdownView({ markdown }: { markdown: string }) {
  const router = useRouter()

  return (
    <article className="prose max-w-none prose-pre:bg-gray-100 prose-pre:text-gray-800">
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          a: ({ href, children }) => {
            // 站內連結走 client-side 導覽，不重新載入整頁
            const internal = href?.startsWith('/') && !href.startsWith('//')
            return (
              <a
                href={href}
                onClick={(e) => {
                  if (!internal || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
                  e.preventDefault()
                  router.history.push(href!)
                }}
                {...(!internal && { target: '_blank', rel: 'noopener noreferrer' })}
              >
                {children}
              </a>
            )
          },
        }}
      >
        {markdown}
      </Markdown>
    </article>
  )
}

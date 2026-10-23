import { markdown } from '@codemirror/lang-markdown'
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { Chunk, MergeView, goToNextChunk, goToPreviousChunk, unifiedMergeView } from '@codemirror/merge'
import { EditorState, Text, type Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { useEffect, useRef } from 'react'

// 版本比較：用 @codemirror/merge（MDXEditor 的「與上一版比較」也是用它），比對 Markdown 原文
// unified：單欄，刪除的內容顯示在新內容上方；split：左右並排（舊版在左）
export type DiffMode = 'unified' | 'split'

type Props = { original: string; modified: string; mode: DiffMode }

// 沒有變更的段落摺疊起來，前後各留 3 行
const COLLAPSE = { margin: 3, minSize: 4 }

// 唯讀、自動換行、Markdown 語法上色；字型與大小沿用頁面的等寬字
const readOnly: Extension = [
  EditorState.readOnly.of(true),
  EditorView.editable.of(false),
  EditorView.lineWrapping,
  markdown(),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  EditorView.theme({ '&': { fontSize: '0.875rem' }, '.cm-scroller': { fontFamily: 'var(--font-mono)' } }),
  // 摺疊區的文字（CodeMirror 內建為英文）
  EditorState.phrases.of({ '$ unchanged lines': '$ 行未變更（點擊展開）' }),
  // 跳到變更處時，留出上方固定工具列的高度，避免被擋住
  EditorView.scrollMargins.of(() => ({ top: 64 })),
]

function toText(s: string) {
  return Text.of(s.split('\n'))
}

// 新增與刪除的行數；修改一行算刪除一行加新增一行（與 GitHub 相同）
export function diffStats(original: string, modified: string) {
  const a = toText(original)
  const b = toText(modified)
  let added = 0
  let removed = 0
  for (const c of Chunk.build(a, b)) {
    if (c.toA > c.fromA) removed += a.lineAt(c.endA).number - a.lineAt(c.fromA).number + 1
    if (c.toB > c.fromB) added += b.lineAt(c.endB).number - b.lineAt(c.fromB).number + 1
  }
  return { added, removed }
}

export function RevisionDiff({ original, modified, mode }: Props) {
  const parent = useRef<HTMLDivElement>(null)
  // 「上一個／下一個變更」要操作的 editor：unified 是唯一那個，split 是右邊的新版本
  const target = useRef<EditorView | null>(null)

  useEffect(() => {
    const el = parent.current!
    if (mode === 'unified') {
      const view = new EditorView({
        parent: el,
        doc: modified,
        extensions: [
          readOnly,
          unifiedMergeView({ original, mergeControls: false, collapseUnchanged: COLLAPSE }),
        ],
      })
      target.current = view
      return () => view.destroy()
    }
    const view = new MergeView({
      parent: el,
      a: { doc: original, extensions: readOnly },
      b: { doc: modified, extensions: readOnly },
      collapseUnchanged: COLLAPSE,
    })
    target.current = view.b
    return () => view.destroy()
  }, [original, modified, mode])

  return (
    <div>
      {/* 固定在畫面上方，捲到下面時仍然可以切換到上一個／下一個變更 */}
      <div className="sticky top-0 z-10 flex justify-end gap-2 bg-white py-2">
        <button type="button" className="btn" onClick={() => target.current && goToPreviousChunk(target.current)}>
          ‹ 上一個變更
        </button>
        <button type="button" className="btn" onClick={() => target.current && goToNextChunk(target.current)}>
          下一個變更 ›
        </button>
      </div>
      <div ref={parent} className="overflow-hidden rounded-md border border-gray-200" />
    </div>
  )
}

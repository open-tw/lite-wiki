import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  CodeToggle,
  CreateLink,
  DiffSourceToggleWrapper,
  InsertCodeBlock,
  InsertTable,
  InsertThematicBreak,
  ListsToggle,
  MDXEditor,
  Separator,
  UndoRedo,
  codeBlockPlugin,
  codeMirrorPlugin,
  diffSourcePlugin,
  headingsPlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
} from '@mdxeditor/editor'
import '@mdxeditor/editor/style.css'

type Props = {
  // 初始內容；MDXEditor 是非受控元件，之後的變動透過 onChange 回傳
  markdown: string
  // 上一個版本的內容，給「差異」模式比較用
  original: string
  // initialNormalize 為 true：MDXEditor 載入時整理原始內容所觸發，不是使用者的修改
  onChange: (markdown: string, initialNormalize: boolean) => void
  onError?: (message: string) => void
}

export function MarkdownEditor({ markdown, original, onChange, onError }: Props) {
  return (
    <MDXEditor
      className="mb-3 rounded-md border border-gray-300"
      // 與檢視頁 MarkdownView 相同的排版，編輯時看到的就是儲存後的樣子
      contentEditableClassName="prose max-w-none min-h-80 prose-pre:bg-gray-100 prose-pre:text-gray-800"
      markdown={markdown}
      onChange={onChange}
      onError={({ error }) => onError?.(error)}
      plugins={[
        headingsPlugin(),
        listsPlugin(),
        quotePlugin(),
        thematicBreakPlugin(),
        linkPlugin(),
        linkDialogPlugin(),
        tablePlugin(),
        codeBlockPlugin({ defaultCodeBlockLanguage: '' }),
        codeMirrorPlugin({
          codeBlockLanguages: {
            '': '純文字',
            js: 'JavaScript',
            ts: 'TypeScript',
            tsx: 'TSX',
            css: 'CSS',
            json: 'JSON',
            bash: 'Bash',
          },
        }),
        markdownShortcutPlugin(),
        // 可切換「所見即所得 / 與上一版差異 / Markdown 原始碼」
        diffSourcePlugin({ diffMarkdown: original, viewMode: 'rich-text' }),
        toolbarPlugin({
          toolbarContents: () => (
            <DiffSourceToggleWrapper>
              <UndoRedo />
              <Separator />
              <BlockTypeSelect />
              <BoldItalicUnderlineToggles />
              <CodeToggle />
              <Separator />
              <ListsToggle />
              <CreateLink />
              <InsertTable />
              <InsertCodeBlock />
              <InsertThematicBreak />
            </DiffSourceToggleWrapper>
          ),
        }),
      ]}
    />
  )
}

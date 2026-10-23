import zhTW from '#/locales/mdxeditor-zh-TW.json'

// MDXEditor 的正體中文翻譯，傳給 <MDXEditor translation>
// 字串來源：https://github.com/mdx-editor/editor/tree/main/locales/zh-tw（npm 套件不含 locales）
// 已修正官方檔案的錯誤與用詞，並補上 4.3.1 缺少的 key；升級 MDXEditor 時記得對照有無新增 key
// key 以 . 分層（例如 toolbar.blockTypes.heading）；找不到時用英文預設值，{{name}} 換成 interpolations 的值
export function translation(key: string, defaultValue: string, interpolations: Record<string, unknown> = {}) {
  const found = key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], zhTW)
  const value = typeof found === 'string' ? found : defaultValue
  return value.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
    name in interpolations ? String(interpolations[name]) : match,
  )
}

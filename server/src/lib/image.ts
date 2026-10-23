// 允許上傳的圖片格式；用檔頭（magic bytes）判斷，不信任副檔名或使用者送來的 MIME
// 不收 SVG：SVG 可內嵌 <script>，從同網域開啟會造成 XSS
export type ImageType = { mime: string; ext: string }

const TYPES: { mime: string; ext: string; match: (b: Buffer) => boolean }[] = [
  {
    mime: 'image/png',
    ext: 'png',
    match: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  { mime: 'image/jpeg', ext: 'jpg', match: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: 'image/gif',
    ext: 'gif',
    match: (b) => ['GIF87a', 'GIF89a'].includes(b.toString('latin1', 0, 6)),
  },
  {
    mime: 'image/webp',
    ext: 'webp',
    match: (b) => b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP',
  },
]

export function detectImage(data: Buffer): ImageType | null {
  const type = TYPES.find((t) => t.match(data))
  return type ? { mime: type.mime, ext: type.ext } : null
}

export function extOf(mime: string) {
  return TYPES.find((t) => t.mime === mime)?.ext ?? null
}

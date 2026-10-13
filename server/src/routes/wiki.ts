import { Hono, type Context } from 'hono'
import { requireAuth, type Env } from '../auth.js'
import { pool } from '../db.js'
import { isUniqueViolation, readBody, toPositiveInt } from '../lib/http.js'
import { normalizeSlug } from '../lib/slug.js'

export const wikiRoutes = new Hono<Env>()

// 路由用 :slug{.+} 取得含 / 的 slug；正規化後為空字串時回 null
function slugParam(c: Context) {
  return normalizeSlug(c.req.param('slug') ?? '') || null
}

// 所有頁面（/pages 列表、/new 檢查 slug）
wikiRoutes.get('/pages', async (c) => {
  const { rows } = await pool.query(
    'SELECT slug, title, updated_at AS "updatedAt" FROM pages ORDER BY slug',
  )
  return c.json(rows)
})

// 頁面某個版本的內容；沒給 rev 時取最新版本
wikiRoutes.get('/pages/:slug{.+}', async (c) => {
  const slug = slugParam(c)
  if (!slug) return c.json({ error: '無效的 slug' }, 400)
  const revQuery = c.req.query('rev')
  const rev = revQuery === undefined ? null : toPositiveInt(revQuery)
  if (revQuery !== undefined && rev === null) return c.json({ error: 'rev 必須是正整數' }, 400)

  const { rows } = await pool.query(
    `SELECT p.slug, p.title, p.current_rev, r.rev, r.content, u.username AS author, r.created_at
     FROM pages p
     JOIN page_revisions r ON r.page_id = p.id AND r.rev = COALESCE($2::int, p.current_rev)
     JOIN users u ON u.id = r.author_id
     WHERE p.slug = $1`,
    [slug, rev],
  )
  const row = rows[0]
  if (!row) return c.json({ error: '找不到頁面' }, 404)
  return c.json({
    slug: row.slug,
    title: row.title,
    currentRev: row.current_rev,
    revision: { rev: row.rev, content: row.content, author: row.author, createdAt: row.created_at },
  })
})

// 儲存：頁面不存在就建立（第 1 版，回 201），存在就新增一個版本（回 200）
wikiRoutes.put('/pages/:slug{.+}', requireAuth, async (c) => {
  const slug = slugParam(c)
  if (!slug) return c.json({ error: '無效的 slug' }, 400)
  const body = await readBody(c)
  if (typeof body.content !== 'string') return c.json({ error: 'content 必須是字串' }, 400)
  const content = body.content
  // title 只在新建時使用；沒給就用 slug 最後一段（與前端 savePage 相同）
  const title =
    typeof body.title === 'string' && body.title.trim() ? body.title.trim() : slug.split('/').at(-1)!
  const baseRev = body.baseRev === undefined ? null : toPositiveInt(body.baseRev)
  if (body.baseRev !== undefined && baseRev === null) {
    return c.json({ error: 'baseRev 必須是正整數' }, 400)
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query<{ id: string; current_rev: number }>(
      'SELECT id, current_rev FROM pages WHERE slug = $1 FOR UPDATE',
      [slug],
    )
    const page = rows[0]
    // 編輯時載入的版本不是最新版本（或頁面已被刪除），表示有人先改過
    if (baseRev !== null && page?.current_rev !== baseRev) {
      await client.query('ROLLBACK')
      return c.json({ error: '頁面已被其他人更新', currentRev: page?.current_rev ?? null }, 409)
    }

    let pageId: string
    let rev: number
    if (page) {
      pageId = page.id
      rev = page.current_rev + 1
      await client.query('UPDATE pages SET current_rev = $2, updated_at = now() WHERE id = $1', [
        pageId,
        rev,
      ])
    } else {
      rev = 1
      const inserted = await client.query<{ id: string }>(
        'INSERT INTO pages (slug, title, current_rev) VALUES ($1, $2, 1) RETURNING id',
        [slug, title],
      )
      pageId = inserted.rows[0]!.id
    }
    await client.query(
      'INSERT INTO page_revisions (page_id, rev, content, author_id) VALUES ($1, $2, $3, $4)',
      [pageId, rev, content, c.var.user!.id],
    )
    await client.query('COMMIT')
    return c.json({ slug, rev }, page ? 200 : 201)
  } catch (err) {
    await client.query('ROLLBACK')
    // 兩個人同時建立同一個 slug，後到的會撞到 pages.slug 的 UNIQUE
    if (isUniqueViolation(err)) return c.json({ error: '頁面已被其他人建立', currentRev: null }, 409)
    throw err
  } finally {
    client.release()
  }
})

// 刪除頁面與所有版本；子頁面（slug 前綴相同的頁面）不受影響
wikiRoutes.delete('/pages/:slug{.+}', requireAuth, async (c) => {
  const slug = slugParam(c)
  if (!slug) return c.json({ error: '無效的 slug' }, 400)
  const { rowCount } = await pool.query('DELETE FROM pages WHERE slug = $1', [slug])
  if (!rowCount) return c.json({ error: '找不到頁面' }, 404)
  return c.body(null, 204)
})

// 修訂歷史列表（不含內容），由新到舊
wikiRoutes.get('/revisions/:slug{.+}', async (c) => {
  const slug = slugParam(c)
  if (!slug) return c.json({ error: '無效的 slug' }, 400)
  const { rows } = await pool.query(
    `SELECT p.slug, p.title, r.rev, u.username AS author, r.created_at AS "createdAt"
     FROM pages p
     JOIN page_revisions r ON r.page_id = p.id
     JOIN users u ON u.id = r.author_id
     WHERE p.slug = $1
     ORDER BY r.rev DESC`,
    [slug],
  )
  // 每個頁面至少有一個版本，查不到就是頁面不存在
  const first = rows[0]
  if (!first) return c.json({ error: '找不到頁面' }, 404)
  return c.json({
    slug: first.slug,
    title: first.title,
    revisions: rows.map(({ rev, author, createdAt }) => ({ rev, author, createdAt })),
  })
})

// 麵包屑：slug 每一層前綴的標題；不存在的頁面用網址那一段當標題
wikiRoutes.get('/breadcrumbs/:slug{.+}', async (c) => {
  const slug = slugParam(c)
  if (!slug) return c.json({ error: '無效的 slug' }, 400)
  const segments = slug.split('/')
  const prefixes = segments.map((_, i) => segments.slice(0, i + 1).join('/'))
  const { rows } = await pool.query<{ slug: string; title: string }>(
    'SELECT slug, title FROM pages WHERE slug = ANY($1)',
    [prefixes],
  )
  const titles = new Map(rows.map((r) => [r.slug, r.title]))
  return c.json(
    prefixes.map((s, i) => ({ slug: s, title: titles.get(s) ?? segments[i], exists: titles.has(s) })),
  )
})

// 最近變更：所有頁面的修訂，由新到舊
wikiRoutes.get('/recent', async (c) => {
  const limit = Math.min(toPositiveInt(c.req.query('limit')) ?? 50, 200)
  const { rows } = await pool.query(
    `SELECT p.slug, p.title, r.rev, u.username AS author, r.created_at AS "createdAt"
     FROM page_revisions r
     JOIN pages p ON p.id = r.page_id
     JOIN users u ON u.id = r.author_id
     ORDER BY r.created_at DESC, r.id DESC
     LIMIT $1`,
    [limit],
  )
  return c.json(rows)
})

// 在標題與最新內容中搜尋（不分大小寫）
wikiRoutes.get('/search', async (c) => {
  const q = c.req.query('q')?.trim()
  if (!q) return c.json([])
  // 跳脫 LIKE 的特殊字元，讓使用者輸入的 % _ 照字面比對
  const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`
  const { rows } = await pool.query(
    `SELECT p.slug, p.title
     FROM pages p
     JOIN page_revisions r ON r.page_id = p.id AND r.rev = p.current_rev
     WHERE p.title ILIKE $1 OR r.content ILIKE $1
     ORDER BY p.updated_at DESC`,
    [pattern],
  )
  return c.json(rows)
})

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { api, loginAs, setupTestDb } from './helpers.js'

setupTestDb()

function save(slug: string, cookie: string, body: Record<string, unknown> = { content: '# hi' }) {
  return api(`/pages/${slug}`, { method: 'PUT', cookie, body })
}

describe('頁面的角色權限', () => {
  test('建立頁面：未登入 401、viewer 403、editor 可以', async () => {
    assert.equal((await api('/pages/a', { method: 'PUT', body: { content: 'x' } })).status, 401)
    assert.equal((await save('a', await loginAs('vi', 'viewer'))).status, 403)
    assert.equal((await save('a', await loginAs('ed', 'editor'))).status, 201)
  })

  test('匿名可以讀取頁面', async () => {
    await save('docs/intro', await loginAs('ed'), { title: '簡介', content: '# hi' })
    const res = await api('/pages/docs/intro')
    assert.equal(res.status, 200)
    const page = (await res.json()) as { title: string; revision: { content: string; author: string } }
    assert.equal(page.title, '簡介')
    assert.equal(page.revision.content, '# hi')
    assert.equal(page.revision.author, 'ed')
  })

  test('刪除與還原只有 admin 可以', async () => {
    const editor = await loginAs('ed', 'editor')
    const admin = await loginAs('root', 'admin')
    await save('a', editor)

    assert.equal((await api('/pages/a', { method: 'DELETE', cookie: editor })).status, 403)
    assert.equal((await api('/pages/a', { method: 'DELETE', cookie: admin })).status, 204)
    assert.equal((await api('/pages/a')).status, 404)

    assert.equal((await api('/restore/a', { method: 'POST', cookie: editor })).status, 403)
    assert.equal((await api('/restore/a', { method: 'POST', cookie: admin })).status, 200)
    assert.equal((await api('/pages/a')).status, 200)
  })
})

describe('PUT /pages/:slug', () => {
  test('再次儲存新增版本並回 200', async () => {
    const cookie = await loginAs('ed')
    await save('a', cookie)
    const res = await save('a', cookie, { content: 'v2', baseRev: 1 })
    assert.equal(res.status, 200)
    assert.deepEqual(await res.json(), { slug: 'a', rev: 2 })
  })

  test('baseRev 不是最新版本時回 409，不會覆蓋', async () => {
    const cookie = await loginAs('ed')
    await save('a', cookie)
    await save('a', cookie, { content: 'v2', baseRev: 1 })
    const res = await save('a', cookie, { content: 'stale', baseRev: 1 })
    assert.equal(res.status, 409)
    assert.equal(((await res.json()) as { currentRev: number }).currentRev, 2)
    const page = (await (await api('/pages/a')).json()) as { revision: { content: string } }
    assert.equal(page.revision.content, 'v2')
  })
})

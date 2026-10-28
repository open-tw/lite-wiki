import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { api, createUser, login, loginAs, PASSWORD, pool, setupTestDb } from './helpers.js'

setupTestDb()

type ManagedUser = { id: string; username: string; role: string; disabled: boolean }

async function sessionCount(username: string) {
  const { rows } = await pool.query<{ count: string }>(
    'SELECT count(*) FROM sessions s JOIN users u ON u.id = s.user_id WHERE u.username = $1',
    [username],
  )
  return Number(rows[0]!.count)
}

describe('帳號管理的權限', () => {
  test('未登入回 401，editor 與 viewer 回 403', async () => {
    assert.equal((await api('/users')).status, 401)
    assert.equal((await api('/users', { cookie: await loginAs('ed', 'editor') })).status, 403)
    assert.equal((await api('/users', { cookie: await loginAs('vi', 'viewer') })).status, 403)
  })

  test('admin 可以列出帳號', async () => {
    const cookie = await loginAs('root', 'admin')
    await createUser('alice', 'viewer')
    const res = await api('/users', { cookie })
    assert.equal(res.status, 200)
    const users = (await res.json()) as ManagedUser[]
    assert.deepEqual(
      users.map((u) => [u.username, u.role, u.disabled]),
      [
        ['root', 'admin', false],
        ['alice', 'viewer', false],
      ],
    )
  })
})

describe('POST /users', () => {
  test('建立帳號，沒給角色時為 editor，建立後可以登入', async () => {
    const cookie = await loginAs('root', 'admin')
    const res = await api('/users', { method: 'POST', cookie, body: { username: 'alice', password: PASSWORD } })
    assert.equal(res.status, 201)
    assert.equal(((await res.json()) as ManagedUser).role, 'editor')
    await login('alice')
  })

  test('重複的帳號回 409', async () => {
    const cookie = await loginAs('root', 'admin')
    const res = await api('/users', { method: 'POST', cookie, body: { username: 'root', password: PASSWORD } })
    assert.equal(res.status, 409)
  })

  test('格式錯誤回 400', async () => {
    const cookie = await loginAs('root', 'admin')
    for (const body of [
      { username: '', password: PASSWORD },
      { username: 'has space', password: PASSWORD },
      { username: 'x'.repeat(33), password: PASSWORD },
      { username: 'alice', password: 'short' },
      { username: 'alice', password: PASSWORD, role: 'owner' },
    ]) {
      const res = await api('/users', { method: 'POST', cookie, body })
      assert.equal(res.status, 400, JSON.stringify(body))
    }
  })
})

describe('PATCH /users/:id', () => {
  test('修改角色', async () => {
    const cookie = await loginAs('root', 'admin')
    const id = await createUser('alice', 'viewer')
    const res = await api(`/users/${id}`, { method: 'PATCH', cookie, body: { role: 'editor' } })
    assert.equal(res.status, 200)
    assert.equal(((await res.json()) as ManagedUser).role, 'editor')
  })

  test('停用後該帳號的 session 全部刪除，也不能登入；啟用後恢復', async () => {
    const cookie = await loginAs('root', 'admin')
    const id = await createUser('alice')
    await login('alice')
    await login('alice')

    const res = await api(`/users/${id}`, { method: 'PATCH', cookie, body: { disabled: true } })
    assert.equal(res.status, 200)
    assert.equal(await sessionCount('alice'), 0)
    const denied = await api('/auth/login', { method: 'POST', body: { username: 'alice', password: PASSWORD } })
    assert.equal(denied.status, 403)

    await api(`/users/${id}`, { method: 'PATCH', cookie, body: { disabled: false } })
    await login('alice')
  })

  test('重設密碼後該帳號的 session 全部刪除，新密碼可以登入', async () => {
    const cookie = await loginAs('root', 'admin')
    const id = await createUser('alice')
    await login('alice')

    const res = await api(`/users/${id}`, { method: 'PATCH', cookie, body: { password: 'reset password' } })
    assert.equal(res.status, 200)
    assert.equal(await sessionCount('alice'), 0)
    await login('alice', 'reset password')
  })

  test('不能變更自己的角色或停用自己', async () => {
    const cookie = await loginAs('root', 'admin')
    const { rows } = await pool.query<{ id: string }>(`SELECT id FROM users WHERE username = 'root'`)
    const id = rows[0]!.id
    assert.equal((await api(`/users/${id}`, { method: 'PATCH', cookie, body: { role: 'editor' } })).status, 400)
    assert.equal((await api(`/users/${id}`, { method: 'PATCH', cookie, body: { disabled: true } })).status, 400)
  })

  test('找不到帳號回 404', async () => {
    const cookie = await loginAs('root', 'admin')
    assert.equal((await api('/users/999', { method: 'PATCH', cookie, body: { role: 'editor' } })).status, 404)
    assert.equal((await api('/users/abc', { method: 'PATCH', cookie, body: { role: 'editor' } })).status, 404)
  })

  test('格式錯誤回 400', async () => {
    const cookie = await loginAs('root', 'admin')
    const id = await createUser('alice')
    for (const body of [{ role: 'owner' }, { disabled: 'yes' }, { password: 'short' }, { password: 12345678 }]) {
      const res = await api(`/users/${id}`, { method: 'PATCH', cookie, body })
      assert.equal(res.status, 400, JSON.stringify(body))
    }
  })
})

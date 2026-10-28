import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { hashToken } from '../src/auth.js'
import { api, createUser, login, loginAs, PASSWORD, pool, sessionCookie, setupTestDb } from './helpers.js'

setupTestDb()

async function me(cookie?: string) {
  const res = await api('/auth/me', { cookie })
  return ((await res.json()) as { user: { name: string; role: string } | null }).user
}

describe('POST /auth/login', () => {
  test('帳號密碼正確時回傳使用者並設定 session cookie', async () => {
    await createUser('alice', 'editor')
    const res = await api('/auth/login', { method: 'POST', body: { username: 'alice', password: PASSWORD } })
    assert.equal(res.status, 200)
    assert.deepEqual(await res.json(), { user: { name: 'alice', role: 'editor' } })

    const setCookie = res.headers.get('set-cookie') ?? ''
    assert.match(setCookie, /HttpOnly/i)
    assert.match(setCookie, /SameSite=Lax/i)
    assert.deepEqual(await me(sessionCookie(res)!), { name: 'alice', role: 'editor' })
  })

  test('帳號前後的空白會被忽略', async () => {
    await createUser('alice')
    const res = await api('/auth/login', { method: 'POST', body: { username: '  alice ', password: PASSWORD } })
    assert.equal(res.status, 200)
  })

  test('資料庫只存 token 的雜湊', async () => {
    await createUser('alice')
    const cookie = await login('alice')
    const token = cookie.slice('sid='.length)
    const { rows } = await pool.query<{ token_hash: string }>('SELECT token_hash FROM sessions')
    assert.equal(rows.length, 1)
    assert.notEqual(rows[0]!.token_hash, token)
    assert.equal(rows[0]!.token_hash, hashToken(token))
  })

  test('密碼錯誤與帳號不存在回相同的 401', async () => {
    await createUser('alice')
    const wrong = await api('/auth/login', { method: 'POST', body: { username: 'alice', password: 'nope-nope' } })
    const missing = await api('/auth/login', { method: 'POST', body: { username: 'bob', password: PASSWORD } })
    assert.equal(wrong.status, 401)
    assert.equal(missing.status, 401)
    assert.deepEqual(await wrong.json(), await missing.json())
    assert.equal(sessionCookie(wrong), null)
  })

  test('沒有帳號或密碼回 400', async () => {
    for (const body of [{}, { username: 'alice' }, { password: PASSWORD }, { username: ' ', password: PASSWORD }]) {
      const res = await api('/auth/login', { method: 'POST', body })
      assert.equal(res.status, 400, JSON.stringify(body))
    }
  })

  test('停用的帳號：密碼正確才回 403，密碼錯誤仍回 401', async () => {
    await createUser('alice', 'editor', { disabled: true })
    const right = await api('/auth/login', { method: 'POST', body: { username: 'alice', password: PASSWORD } })
    assert.equal(right.status, 403)
    assert.equal(sessionCookie(right), null)
    const wrong = await api('/auth/login', { method: 'POST', body: { username: 'alice', password: 'nope-nope' } })
    assert.equal(wrong.status, 401)
  })
})

describe('session', () => {
  test('沒有登入時 /auth/me 回 null', async () => {
    assert.equal(await me(), null)
    assert.equal(await me('sid=not-a-real-token'), null)
  })

  test('過期的 session 視同未登入', async () => {
    const cookie = await loginAs('alice')
    await pool.query(`UPDATE sessions SET expires_at = now() - interval '1 second'`)
    assert.equal(await me(cookie), null)
  })

  test('帳號被停用後，既有的 session 立即失效', async () => {
    const cookie = await loginAs('alice')
    await pool.query(`UPDATE users SET disabled_at = now() WHERE username = 'alice'`)
    assert.equal(await me(cookie), null)
  })

  test('角色變更不必重新登入就生效', async () => {
    const cookie = await loginAs('alice', 'viewer')
    await pool.query(`UPDATE users SET role = 'admin' WHERE username = 'alice'`)
    assert.equal((await me(cookie))?.role, 'admin')
  })

  test('登出會刪除 session', async () => {
    const cookie = await loginAs('alice')
    const res = await api('/auth/logout', { method: 'POST', cookie })
    assert.equal(res.status, 204)
    assert.equal(await me(cookie), null)
    const { rowCount } = await pool.query('SELECT 1 FROM sessions')
    assert.equal(rowCount, 0)
  })
})

describe('POST /auth/password', () => {
  test('未登入回 401', async () => {
    const res = await api('/auth/password', {
      method: 'POST',
      body: { currentPassword: PASSWORD, newPassword: 'new password' },
    })
    assert.equal(res.status, 401)
  })

  test('目前的密碼錯誤回 400，密碼不變', async () => {
    const cookie = await loginAs('alice')
    const res = await api('/auth/password', {
      method: 'POST',
      cookie,
      body: { currentPassword: 'nope-nope', newPassword: 'new password' },
    })
    assert.equal(res.status, 400)
    await login('alice', PASSWORD)
  })

  test('新密碼太短回 400', async () => {
    const cookie = await loginAs('alice')
    const res = await api('/auth/password', {
      method: 'POST',
      cookie,
      body: { currentPassword: PASSWORD, newPassword: 'short' },
    })
    assert.equal(res.status, 400)
  })

  test('成功後只保留目前的 session，新密碼可以登入、舊密碼不行', async () => {
    await createUser('alice')
    const current = await login('alice')
    const other = await login('alice')

    const res = await api('/auth/password', {
      method: 'POST',
      cookie: current,
      body: { currentPassword: PASSWORD, newPassword: 'new password' },
    })
    assert.equal(res.status, 204)
    assert.equal((await me(current))?.name, 'alice')
    assert.equal(await me(other), null)

    await login('alice', 'new password')
    const old = await api('/auth/login', { method: 'POST', body: { username: 'alice', password: PASSWORD } })
    assert.equal(old.status, 401)
  })
})

import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { session, type Env } from './auth.js'
import { pool } from './db.js'
import { authRoutes } from './routes/auth.js'
import { uploadRoutes } from './routes/uploads.js'
import { wikiRoutes } from './routes/wiki.js'

// 所有路由都在 /api 底下
const app = new Hono<Env>().basePath('/api')

app.use(session)

app.get('/health', async (c) => {
  await pool.query('SELECT 1')
  return c.json({ ok: true })
})

app.route('/auth', authRoutes)
app.route('/uploads', uploadRoutes)
app.route('/', wikiRoutes)

app.notFound((c) => c.json({ error: 'Not Found' }, 404))
app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'Internal Server Error' }, 500)
})

serve({
  fetch: app.fetch,
  port: Number(process.env.PORT ?? 3001)
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})

import express from 'express'
import http from 'http'
import cors from 'cors'
import helmet from 'helmet'
import { config } from './config'
import apiRouter from './routes'
import { createWsServer } from './ws'
import { errorHandler, notFound } from './middleware/errorHandler'
import { checkDbConnection } from './db'
import { seedDemoData } from './seed'

async function bootstrap() {
  const app = express()

  // ── Security & parsing ─────────────────────────────────────────
  app.use(helmet())
  app.use(
    cors({
      origin: config.CORS_ORIGIN.split(',').map((o) => o.trim()),
      credentials: true,
    }),
  )
  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: false }))

  // ── Health check ───────────────────────────────────────────────
  app.get('/health', async (_req, res) => {
    const dbOk = config.SKIP_DB ? null : await checkDbConnection()
    res.json({
      status: 'ok',
      version: '0.1.0',
      env: config.NODE_ENV,
      db: config.SKIP_DB ? 'disabled' : dbOk ? 'connected' : 'unreachable',
      timestamp: new Date().toISOString(),
    })
  })

  // ── API routes ─────────────────────────────────────────────────
  app.use('/api', apiRouter)

  // ── 404 + error handlers ───────────────────────────────────────
  app.use(notFound)
  app.use(errorHandler)

  // ── HTTP + WebSocket server ────────────────────────────────────
  const server = http.createServer(app)
  createWsServer(server)

  server.listen(config.PORT, () => {
    console.log(`\n🚀 Aegis API running on http://localhost:${config.PORT}`)
    console.log(`🔌 WebSocket available at ws://localhost:${config.PORT}/ws`)
    console.log(`📊 Health: http://localhost:${config.PORT}/health`)
    console.log(`🗄️  Database: ${config.SKIP_DB ? 'DISABLED (in-memory mode)' : `${config.DB_HOST}:${config.DB_PORT}/${config.DB_NAME}`}`)
    console.log(`🌍 Environment: ${config.NODE_ENV}\n`)

    // Seed demo data when running in-memory mode
    if (config.SKIP_DB) seedDemoData()
  })

  // ── Graceful shutdown ──────────────────────────────────────────
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...')
    server.close(() => process.exit(0))
  })
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
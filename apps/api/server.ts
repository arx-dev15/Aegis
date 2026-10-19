import { approvalRuntime } from '../../src/runtime/approvalWorkflow'
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

export function createApp(): express.Application {
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
    const runs = approvalRuntime.listPersistedRuns(50)
    const activeRuns = runs.filter((r) =>
      ['developing', 'investigating', 'planning', 'testing', 'reviewing', 'paused'].includes(
        r.state?.status
      )
    )
    res.json({
      status: 'ok',
      version: '0.1.0',
      env: config.NODE_ENV,
      db: config.SKIP_DB ? 'disabled' : dbOk ? 'connected' : 'unreachable',
      gemini: {
        status: process.env.GEMINI_API_KEY ? 'online' : 'unconfigured',
        model: 'gemini-2.0-flash',
        configured: Boolean(process.env.GEMINI_API_KEY),
      },
      github: {
        status: process.env.GITHUB_PAT || process.env.GITHUB_TOKEN ? 'online' : 'offline',
        configured: Boolean(process.env.GITHUB_PAT || process.env.GITHUB_TOKEN),
      },
      runs: {
        total: runs.length,
        active: activeRuns.length,
      },
      timestamp: new Date().toISOString(),
    })
  })

  // ── API routes ─────────────────────────────────────────────────
  app.use('/api', apiRouter)

  // ── 404 + error handlers ───────────────────────────────────────
  app.use(notFound)
  app.use(errorHandler)

  return app
}

export function createServerInstance() {
  const app = createApp()
  const server = http.createServer(app)
  const wss = createWsServer(server)
  return { app, server, wss }
}

async function bootstrap() {
  const { server } = createServerInstance()

  server.listen(config.PORT, () => {
    console.log(`\n🚀 Aegis API running on http://localhost:${config.PORT}`)
    console.log(`🔌 WebSocket available at ws://localhost:${config.PORT}/ws`)
    console.log(`📊 Health: http://localhost:${config.PORT}/health`)
    console.log(`🗄️  Database: ${config.SKIP_DB ? 'DISABLED (in-memory mode)' : `${config.DB_HOST}:${config.DB_PORT}/${config.DB_NAME}`}`)
    console.log(`🌍 Environment: ${config.NODE_ENV}\n`)

    // Seed demo data only in non-production environments when explicitly enabled
    if (config.SKIP_DB && config.NODE_ENV !== 'production' && !process.env.AEGIS_DISABLE_DEMO && process.env.AEGIS_ENABLE_DEMO_SEED === 'true') {
      seedDemoData()
    }
  })

  // ── Graceful shutdown ──────────────────────────────────────────
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...')
    server.close(() => process.exit(0))
  })
}

// Auto-start server unless imported by test runner
if (process.env.NODE_ENV !== 'test' && !process.env.AEGIS_TEST_API) {
  bootstrap().catch((err) => {
    console.error('Failed to start server:', err)
    process.exit(1)
  })
}

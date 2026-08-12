import { Pool } from 'pg'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

// Load environment variables from the root .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

async function runMigration() {
  const databaseUrl = process.env.DATABASE_URL
  const host = process.env.DB_HOST || 'localhost'
  const port = Number(process.env.DB_PORT) || 5432
  const database = process.env.DB_NAME || 'aegis'
  const user = process.env.DB_USER || 'postgres'
  const password = process.env.DB_PASSWORD || ''

  console.log('🔄 Starting database migration...')
  console.log(`Connection settings: host=${host}, port=${port}, database=${database}, user=${user}`)

  const pool = databaseUrl
    ? new Pool({ connectionString: databaseUrl })
    : new Pool({
        host,
        port,
        database,
        user,
        password,
      })

  try {
    const migrationPath = path.resolve(__dirname, '../../database/migrations/001_initial.sql')
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration SQL file not found at: ${migrationPath}`)
    }

    const sql = fs.readFileSync(migrationPath, 'utf8')
    console.log(`📝 Loaded migration SQL from: ${migrationPath}`)

    const client = await pool.connect()
    try {
      console.log('🚀 Executing migration SQL...')
      await client.query(sql)
      console.log('✅ Migration applied successfully!')
    } finally {
      client.release()
    }
  } catch (err: any) {
    console.error('❌ Migration failed:', err.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

runMigration()

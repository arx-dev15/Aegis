import { Pool } from 'pg'
import { config } from './config'

let pool: Pool | null = null

export function getDb(): Pool {
  if (config.SKIP_DB) {
    throw new Error('Database is disabled (SKIP_DB=true). Use mock data instead.')
  }
  if (!pool) {
    pool = config.DATABASE_URL
      ? new Pool({ connectionString: config.DATABASE_URL })
      : new Pool({
          host: config.DB_HOST,
          port: config.DB_PORT,
          database: config.DB_NAME,
          user: config.DB_USER,
          password: config.DB_PASSWORD,
        })

    pool.on('error', (err) => {
      console.error('Unexpected database error:', err)
    })
  }
  return pool
}

export async function checkDbConnection(): Promise<boolean> {
  if (config.SKIP_DB) return false
  try {
    const db = getDb()
    await db.query('SELECT 1')
    return true
  } catch {
    return false
  }
}

// Helper for cleaner queries
export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  const db = getDb()
  const result = await db.query(sql, params)
  return result.rows as T[]
}

export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[],
): Promise<T | null> {
  const rows = await query<T>(sql, params)
  return rows[0] ?? null
}

import { z } from 'zod'
import dotenv from 'dotenv'
import path from 'path'

// Load .env from monorepo root
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  // Database
  DATABASE_URL: z.string().optional(),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().default(5432),
  DB_NAME: z.string().default('aegis'),
  DB_USER: z.string().default('postgres'),
  DB_PASSWORD: z.string().default(''),
  // Auth
  API_KEY: z.string().default('aegis-dev-key'),
  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3000,http://localhost:3001'),
  // Feature flags
  SKIP_DB: z.string().optional().transform((v) => v === 'true'),
})

function parseEnv() {
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    console.error('❌ Invalid environment variables:')
    console.error(result.error.flatten().fieldErrors)
    process.exit(1)
  }
  return result.data
}

export const config = parseEnv()

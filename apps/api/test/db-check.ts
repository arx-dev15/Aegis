import { Client } from 'pg'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

async function check() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'aegis',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  })

  try {
    await client.connect()
    console.log('Successfully connected to PostgreSQL database')
    const res = await client.query('SELECT version()')
    console.log('Version:', res.rows[0].version)
    await client.end()
  } catch (err: any) {
    console.error('Failed to connect to PostgreSQL database:', err.message)
  }
}

check()

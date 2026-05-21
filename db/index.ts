import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '@/lib/env'
import * as schema from './schema'

const url = env.DATABASE_URL
console.log('[db] connecting to:', url.replace(/:[^:@]+@/, ':***@'))

const client = postgres(url, {
  prepare: false,
  connect_timeout: 10,
  onnotice: () => {},
})

client`SELECT 1`.then(() => {
  console.log('[db] connection OK')
}).catch((err: unknown) => {
  console.error('[db] connection FAILED:', err)
})

export const db = drizzle(client, { schema })

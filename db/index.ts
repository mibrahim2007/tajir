import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '@/lib/env'
import * as schema from './schema'

type Db = ReturnType<typeof drizzle<typeof schema>>

let instance: Db | null = null

function getDb(): Db {
  if (!instance) {
    const client = postgres(env.DATABASE_URL, { prepare: false })
    instance = drizzle(client, { schema })
  }
  return instance
}

// Lazy: the connection string is parsed on first query, not at import.
// `next build` imports every route to collect page data, so an unparseable
// DATABASE_URL would otherwise fail the deploy of the whole app instead of
// only the requests that need Postgres (Vercel, 2026-09-17).
export const db: Db = new Proxy({} as Db, {
  get(_target, prop, _receiver) {
    const real = getDb()
    const value = Reflect.get(real, prop, real)
    return typeof value === 'function' ? value.bind(real) : value
  },
})

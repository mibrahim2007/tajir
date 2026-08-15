/**
 * Exports the applied migration history — `npm run db:export-history`.
 *
 * Reads `supabase_migrations.schema_migrations` (the database's own record of
 * what has run) and writes one file per migration into
 * `supabase/applied-history/`. See the README there for why that folder exists.
 *
 * Safe to re-run: it overwrites files it owns and never touches the database.
 * Files for migrations that no longer exist upstream are reported, not deleted,
 * so a bad connection can never quietly wipe the record.
 */
import { Client } from 'pg'
import fs from 'node:fs'
import path from 'node:path'

const OUT_DIR = path.join(process.cwd(), 'supabase', 'applied-history')

/**
 * Connection candidates, tried in order.
 *
 * DIRECT_URL (session pooler, port 5432) is the right one for a plain
 * long-lived query and is tried first. DATABASE_URL points at the transaction
 * pooler on 6543, which suits the serverless app but not this. The final
 * candidate coerces whatever DATABASE_URL holds into session mode, so the
 * script still works from an environment that predates DIRECT_URL.
 */
function candidates(): { label: string; url: string }[] {
  const list: { label: string; url: string }[] = []
  const direct = process.env.DIRECT_URL
  const raw = process.env.DATABASE_URL

  if (direct) list.push({ label: 'DIRECT_URL (session pooler)', url: direct })
  if (raw) {
    list.push({ label: 'DATABASE_URL as-is', url: raw })
    try {
      const c = new URL(raw)
      c.port = '5432'
      list.push({ label: 'DATABASE_URL coerced to session mode', url: c.toString() })
    } catch {
      /* not a URL; the as-is attempt will report the real error */
    }
  }
  return list
}

async function connect(): Promise<Client> {
  const list = candidates()
  if (list.length === 0) {
    throw new Error('Neither DIRECT_URL nor DATABASE_URL is set (run via `npm run db:export-history`, which loads .env.local)')
  }

  const failures: string[] = []
  for (const { label, url } of list) {
    const client = new Client({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10_000,
    })
    try {
      await client.connect()
      console.log(`connected via: ${label}`)
      return client
    } catch (e) {
      failures.push(`  ${label}: ${e instanceof Error ? e.message : String(e)}`)
      try { await client.end() } catch { /* already dead */ }
    }
  }
  throw new Error(`Could not connect to the database. Tried:\n${failures.join('\n')}`)
}

async function main() {
  const client = await connect()

  const { rows } = await client.query<{ version: string; name: string; statements: string[] | null }>(
    `select version, name, statements
       from supabase_migrations.schema_migrations
      order by version`,
  )
  await client.end()

  if (rows.length === 0) throw new Error('No migrations found — refusing to overwrite the export with nothing')

  fs.mkdirSync(OUT_DIR, { recursive: true })
  const before = new Set(fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.sql')))

  let written = 0
  let bytes = 0
  for (const r of rows) {
    // The stored name sometimes carries the local NNNN_ prefix (a migration
    // applied straight from a hand-numbered file); drop it so the version is
    // the only ordering key.
    const file = `${r.version}_${r.name.replace(/^\d{4}_/, '')}.sql`
    const sql = (r.statements ?? []).join('\n')
    fs.writeFileSync(path.join(OUT_DIR, file), sql, 'utf8')
    before.delete(file)
    written++
    bytes += Buffer.byteLength(sql)
  }

  console.log(`wrote ${written} migrations (${(bytes / 1024).toFixed(0)} KB) to supabase/applied-history/`)

  if (before.size > 0) {
    console.log(
      `\nNOTE: ${before.size} file(s) here no longer appear upstream. Left in place — ` +
        `delete by hand once you know why:\n` +
        [...before].map((f) => `  ${f}`).join('\n'),
    )
  }
}

main().catch((e) => {
  console.error(`\nFAILED: ${e instanceof Error ? e.message : e}`)
  process.exit(1)
})

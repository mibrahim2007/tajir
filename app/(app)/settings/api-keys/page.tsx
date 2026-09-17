import { redirect } from 'next/navigation'
import { and, desc, eq, gt, sql } from 'drizzle-orm'
import { db } from '@/db'
import { apiKeyRequests } from '@/db/schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { listApiKeys } from '@/lib/api-keys/keys'
import { formatPKTDateTime } from '@/lib/utils/dates'
import { ApiKeyForm } from './api-key-form'
import { ApiKeyTable } from './api-key-table'

export default async function ApiKeysPage() {
  const { role, tenantId } = await requireAuth()
  if (role !== 'owner') redirect('/dashboard')

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [keys, recent, usage] = await Promise.all([
    listApiKeys(tenantId),
    db
      .select({
        path: apiKeyRequests.path,
        status: apiKeyRequests.status,
        rowCount: apiKeyRequests.rowCount,
        apiKeyId: apiKeyRequests.apiKeyId,
        createdAt: apiKeyRequests.createdAt,
      })
      .from(apiKeyRequests)
      .where(eq(apiKeyRequests.tenantId, tenantId))
      .orderBy(desc(apiKeyRequests.createdAt))
      .limit(25),
    db
      .select({ apiKeyId: apiKeyRequests.apiKeyId, count: sql<number>`count(*)::int` })
      .from(apiKeyRequests)
      .where(and(eq(apiKeyRequests.tenantId, tenantId), gt(apiKeyRequests.createdAt, thirtyDaysAgo)))
      .groupBy(apiKeyRequests.apiKeyId),
  ])

  const usageByKey = new Map(usage.map((u) => [u.apiKeyId, u.count]))
  const keyNames = new Map(keys.map((k) => [k.id, k.name]))

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-extrabold tracking-tight">API Keys</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Let another application read this business&apos;s data. Each key is limited to the
        scopes you choose and can be switched off at any time.
      </p>

      <div className="mt-6">
        <ApiKeyForm />
      </div>

      <div className="mt-6">
        <ApiKeyTable
          keys={keys.map((k) => ({
            ...k,
            createdAt: k.createdAt.toISOString(),
            expiresAt: k.expiresAt?.toISOString() ?? null,
            lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
            revokedAt: k.revokedAt?.toISOString() ?? null,
            requests30d: usageByKey.get(k.id) ?? 0,
          }))}
        />
      </div>

      {recent.length > 0 && (
        <div className="mt-6 bg-card rounded-2xl border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b">
            <p className="font-medium">Recent requests</p>
            <p className="text-xs text-muted-foreground">Last 25 calls made with any key.</p>
          </div>
          <table className="w-full text-sm">
            <thead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2">When</th>
                <th className="text-left px-4 py-2">Key</th>
                <th className="text-left px-4 py-2">Path</th>
                <th className="text-right px-4 py-2">Status</th>
                <th className="text-right px-4 py-2">Rows</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r, i) => (
                <tr key={i} className="border-t">
                  <td className="px-4 py-2 whitespace-nowrap">{formatPKTDateTime(r.createdAt)}</td>
                  <td className="px-4 py-2">{keyNames.get(r.apiKeyId) ?? '—'}</td>
                  <td className="px-4 py-2 font-mono text-xs break-all">{r.path}</td>
                  <td className={`px-4 py-2 text-right ${r.status >= 400 ? 'text-destructive' : ''}`}>{r.status}</td>
                  <td className="px-4 py-2 text-right">{r.rowCount ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 rounded-lg border bg-muted/30 px-4 py-3 text-sm space-y-2">
        <p className="font-medium">How the other application uses a key</p>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li>
            It sends the key in the <code className="font-mono text-xs">Authorization: Bearer tjr_live_…</code> header
            on every call to <code className="font-mono text-xs">/api/v1/…</code>.
          </li>
          <li>Keys are read-only. Nothing can be created, changed or deleted through them.</li>
          <li>A key only ever sees this business — never anyone else&apos;s.</li>
          <li>Revoking a key stops it immediately. Every call is listed above, so you can see exactly what was pulled.</li>
        </ul>
      </div>
    </div>
  )
}

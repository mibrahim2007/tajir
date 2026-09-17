'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { revokeApiKeyAction } from '@/app/actions/api-keys'
import { formatPKTDate, formatPKTDateTime } from '@/lib/utils/dates'
import type { ApiScope } from '@/db/schema'

export type ApiKeyRow = {
  id: string
  name: string
  keyPrefix: string
  scopes: ApiScope[]
  createdAt: string
  expiresAt: string | null
  lastUsedAt: string | null
  revokedAt: string | null
  requests30d: number
}

function statusOf(k: ApiKeyRow): { label: string; className: string } {
  if (k.revokedAt) return { label: 'Revoked', className: 'text-muted-foreground' }
  if (k.expiresAt && new Date(k.expiresAt) < new Date()) return { label: 'Expired', className: 'text-amber-700 dark:text-amber-400' }
  return { label: 'Active', className: 'text-emerald-700 dark:text-emerald-400' }
}

export function ApiKeyTable({ keys }: { keys: ApiKeyRow[] }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  // Revoking cuts the integration off instantly, so it takes a second click.
  const [armed, setArmed] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const revoke = (keyId: string) => {
    startTransition(async () => {
      setError(null)
      const result = await revokeApiKeyAction({ keyId })
      if (!result.success) { setError(result.error); return }
      setArmed(null)
      router.refresh()
    })
  }

  if (keys.length === 0) {
    return (
      <div className="bg-card rounded-2xl border shadow-sm px-4 py-6 text-center text-sm text-muted-foreground">
        No keys yet. Create one above to connect another application.
      </div>
    )
  }

  return (
    <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b">
        <p className="font-medium">Your keys</p>
      </div>
      <ul className="divide-y">
        {keys.map((k) => {
          const status = statusOf(k)
          const live = status.label === 'Active'
          return (
            <li key={k.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-start gap-3">
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium">{k.name}</p>
                  <span className={`text-[11px] font-bold uppercase tracking-wider ${status.className}`}>{status.label}</span>
                </div>
                <p className="font-mono text-xs text-muted-foreground">{k.keyPrefix}…</p>
                <p className="text-xs text-muted-foreground">
                  {k.scopes.map((s) => s.replace(':read', '')).join(', ')}
                </p>
                <p className="text-xs text-muted-foreground">
                  Created {formatPKTDate(k.createdAt)}
                  {k.expiresAt && ` · Expires ${formatPKTDate(k.expiresAt)}`}
                  {k.lastUsedAt ? ` · Last used ${formatPKTDateTime(k.lastUsedAt)}` : ' · Never used'}
                  {` · ${k.requests30d} ${k.requests30d === 1 ? 'call' : 'calls'} in 30 days`}
                </p>
              </div>
              {live && (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[44px] shrink-0"
                  disabled={isPending}
                  onBlur={() => setArmed(null)}
                  onClick={() => (armed === k.id ? revoke(k.id) : setArmed(k.id))}
                >
                  {armed === k.id ? 'Confirm — cut off access?' : 'Revoke'}
                </Button>
              )}
            </li>
          )
        })}
      </ul>
      {error && <p className="px-4 py-3 text-sm text-destructive border-t">{error}</p>}
    </div>
  )
}

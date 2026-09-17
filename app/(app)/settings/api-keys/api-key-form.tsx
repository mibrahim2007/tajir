'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { createApiKeyAction } from '@/app/actions/api-keys'
import { apiScopeEnum, type ApiScope } from '@/db/schema'

// Plain-language labels; the scope ids themselves are what the API checks.
const SCOPE_LABELS: Record<ApiScope, string> = {
  'customers:read': 'Customers',
  'suppliers:read': 'Suppliers',
  'ledger:read':    'Party ledgers',
  'sales:read':     'Sales',
  'purchases:read': 'Purchases',
  'inventory:read': 'Stock',
  'reports:read':   'Reports',
}

export function ApiKeyForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [scopes, setScopes] = useState<Set<ApiScope>>(new Set())
  const [expiresAt, setExpiresAt] = useState('')
  const [error, setError] = useState<string | null>(null)
  // Shown once, then gone — the server never keeps the plaintext.
  const [revealed, setRevealed] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  const today = new Date().toISOString().split('T')[0]

  const toggle = (scope: ApiScope) => {
    setScopes((prev) => {
      const next = new Set(prev)
      if (next.has(scope)) next.delete(scope)
      else next.add(scope)
      return next
    })
    setError(null)
  }

  const submit = () => {
    startTransition(async () => {
      setError(null)
      const result = await createApiKeyAction({
        name,
        scopes: [...scopes],
        expiresAt: expiresAt || null,
      })
      if (!result.success) { setError(result.error); return }
      setRevealed(result.data.plaintext)
      setName('')
      setScopes(new Set())
      setExpiresAt('')
      router.refresh()
    })
  }

  const copy = async () => {
    if (!revealed) return
    try {
      await navigator.clipboard.writeText(revealed)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard can be blocked (http, permissions); the key is still visible to select.
    }
  }

  if (revealed) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 px-4 py-4 space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">New key — copy it now</p>
        <p className="text-sm">
          This is the only time the full key will be shown. Give it to the other application
          and keep it somewhere safe. If it is lost, revoke it and create a new one.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 min-w-0 break-all rounded-md bg-background border px-3 py-2 font-mono text-sm select-all">
            {revealed}
          </code>
          <Button type="button" variant="outline" className="min-h-[44px] shrink-0" onClick={copy}>
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <Button type="button" className="min-h-[44px]" onClick={() => setRevealed(null)}>
          Done — I have saved it
        </Button>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-2xl border shadow-sm px-4 py-4 space-y-4">
      <p className="font-medium">Create a key</p>

      <div className="space-y-2">
        <label className="text-sm font-medium leading-none">Name</label>
        <Input
          placeholder="e.g. Accountant sync, Power BI"
          value={name}
          maxLength={80}
          className="min-h-[44px]"
          onChange={(e) => { setName(e.target.value); setError(null) }}
        />
        <p className="text-xs text-muted-foreground">Who or what will use this key. Shown in the request log.</p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium leading-none">What it can read</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {apiScopeEnum.map((scope) => (
            <label key={scope} className="flex items-center gap-2 rounded-md border px-3 py-2 min-h-[44px] cursor-pointer">
              <Checkbox checked={scopes.has(scope)} onCheckedChange={() => toggle(scope)} />
              <span className="text-sm">{SCOPE_LABELS[scope]}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium leading-none">Expires on (optional)</label>
        <Input
          type="date"
          value={expiresAt}
          min={today}
          className="min-h-[44px] sm:max-w-xs"
          onChange={(e) => { setExpiresAt(e.target.value); setError(null) }}
        />
        <p className="text-xs text-muted-foreground">Leave blank for a key that works until you revoke it.</p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        type="button"
        className="min-h-[44px]"
        disabled={isPending || !name.trim() || scopes.size === 0}
        onClick={submit}
      >
        {isPending ? 'Creating…' : 'Create Key'}
      </Button>
    </div>
  )
}

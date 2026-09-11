'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Building2, BookOpen, Check, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateBusinessProfileAction } from '@/app/actions/update-business-profile'
import { seedChartOfAccountsAction } from '@/app/actions/seed-chart-of-accounts'
import { StepHeader, Why } from './wizard-ui'
import type { SetupData } from './setup-types'

/* ── 1. Business profile ─────────────────────────────────────────────────── */

export function BusinessStep({ data }: { data: SetupData }) {
  const router = useRouter()
  const [name, setName] = useState(data.tenant.name)
  const [ntn, setNtn] = useState(data.tenant.ntn)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const dirty = name !== data.tenant.name || ntn !== data.tenant.ntn

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      setError(null); setSaved(false)
      const res = await updateBusinessProfileAction({ name, ntn })
      if (!res.success) { setError(res.error); return }
      setSaved(true)
      router.refresh()
    })
  }

  return (
    <div>
      <StepHeader
        icon={Building2}
        title="Business Profile"
        description="How your business appears on every invoice, voucher and gatepass you print."
        href="/settings/business"
      />
      <Why>
        The name here is the header of every printout your customers and suppliers receive.
        The NTN is optional — leave it blank and it simply won&apos;t print.
      </Why>

      <form onSubmit={save} className="bg-card rounded-2xl border border-border shadow-sm p-5 space-y-4 max-w-xl">
        <div className="space-y-1">
          <Label>Business Name <span className="text-destructive">*</span></Label>
          <Input
            value={name}
            onChange={(e) => { setName(e.target.value); setSaved(false) }}
            className="min-h-[44px]"
            placeholder="e.g. A Rehman Traders"
            autoFocus
          />
        </div>
        <div className="space-y-1">
          <Label>NTN Number</Label>
          <Input
            value={ntn}
            onChange={(e) => { setNtn(e.target.value); setSaved(false) }}
            className="min-h-[44px] font-mono"
            placeholder="e.g. 1234567-8"
          />
          <p className="text-xs text-muted-foreground">National Tax Number, printed under the business name.</p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex items-center gap-3">
          <Button type="submit" className="min-h-[44px]" disabled={isPending || !name.trim() || !dirty}>
            {isPending ? 'Saving…' : 'Save Profile'}
          </Button>
          {saved && !dirty && (
            <span className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><Check className="h-4 w-4" /> Saved</span>
          )}
          {!saved && !dirty && data.tenant.name && (
            <span className="text-sm text-muted-foreground flex items-center gap-1"><Check className="h-4 w-4 text-emerald-500" /> Profile is set</span>
          )}
        </div>
      </form>
    </div>
  )
}

/* ── 2. Chart of accounts ────────────────────────────────────────────────── */

const SEEDED_GROUPS: { code: string; name: string; note: string }[] = [
  { code: '1xxx', name: 'Assets',      note: 'Cash, banks, receivables, inventory, post-dated cheques' },
  { code: '2xxx', name: 'Liabilities', note: 'Payables, agent commission, cheques issued' },
  { code: '3xxx', name: 'Equity',      note: 'Capital, drawings, opening-balance equity, retained profit' },
  { code: '4xxx', name: 'Revenue',     note: 'Sales, sale returns, other income' },
  { code: '5xxx', name: 'Expenses',    note: 'Cost of goods sold, salaries, freight, utilities…' },
]

export function AccountsStep({ data }: { data: SetupData }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [justSeeded, setJustSeeded] = useState<number | null>(null)
  const count = data.counts.accounts

  const seed = () => {
    startTransition(async () => {
      setError(null)
      const res = await seedChartOfAccountsAction()
      if (!res.success) { setError(res.error); return }
      setJustSeeded(res.data.count)
      router.refresh()
    })
  }

  return (
    <div>
      <StepHeader
        icon={BookOpen}
        title="Chart of Accounts"
        description="The ledger that every sale, purchase, receipt and payment posts to automatically."
        href="/accounts"
      />
      <Why>
        Tajir keeps double-entry books for you behind the scenes. It needs the standard accounts
        (Cash, Receivables, Sales, Cost of Goods Sold and so on) to exist before the first document
        is saved. One click loads a chart tuned for trading businesses in Pakistan; you can rename or
        add accounts later from the Accounts page.
      </Why>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-muted/40">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">What the standard chart includes</p>
          </div>
          <ul className="divide-y divide-border">
            {SEEDED_GROUPS.map((g) => (
              <li key={g.code} className="flex items-start gap-3 px-5 py-3">
                <span className="font-mono text-xs text-muted-foreground w-10 shrink-0 mt-0.5">{g.code}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{g.name}</p>
                  <p className="text-xs text-muted-foreground">{g.note}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm p-5 flex flex-col gap-4">
          {count > 0 ? (
            <>
              <div className="flex items-center gap-3">
                <span className="icon-chip icon-chip-lime h-10 w-10 rounded-xl"><ShieldCheck className="h-5 w-5" /></span>
                <div>
                  <p className="text-sm font-bold">Ledger ready</p>
                  <p className="text-xs text-muted-foreground">{count} accounts in your chart</p>
                </div>
              </div>
              {justSeeded !== null && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400">Standard chart loaded.</p>
              )}
              <p className="text-xs text-muted-foreground leading-relaxed">
                Need a custom account — a second cash drawer, a specific expense head? Add it from the
                Accounts page. Opening balances for cash and bank accounts are set in the final step.
              </p>
              <div className="flex flex-col gap-2 mt-auto">
                <Button asChild variant="outline" className="min-h-[44px]"><Link href="/accounts">Open Accounts</Link></Button>
                <Button type="button" variant="ghost" size="sm" onClick={seed} disabled={isPending} className="text-xs">
                  {isPending ? 'Checking…' : 'Add any missing standard accounts'}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-sm font-bold">No accounts yet</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Load the standard chart now. This is safe to run again later — existing accounts are never changed.
                </p>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="button" onClick={seed} disabled={isPending} className="min-h-[44px] mt-auto">
                {isPending ? 'Loading chart…' : 'Load Standard Chart of Accounts'}
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                Already have your own chart? <Link href="/accounts" className="text-primary hover:underline">Upload a CSV</Link> instead.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

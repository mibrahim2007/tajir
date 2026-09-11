'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Flag, Check, Circle, ArrowRight, Wallet, Lock, ShoppingBag, ShoppingCart, PartyPopper,
} from 'lucide-react'
import { StepHeader } from './wizard-ui'
import { STEPS, stepStatus, type SetupData, type StepKey } from './setup-types'

function countFor(key: StepKey, d: SetupData): string {
  const c = d.counts
  switch (key) {
    case 'business':   return d.tenant.name || '—'
    case 'accounts':   return `${c.accounts} accounts`
    case 'categories': return `${c.itemTypes} categories`
    case 'warehouses': return `${c.locations} warehouses`
    case 'items':      return `${c.items} items`
    case 'customers':  return `${c.customers} customers`
    case 'suppliers':  return `${c.suppliers} suppliers`
    case 'banks':      return `${c.banks} bank accounts`
    case 'people':     return `${c.owners} owners · ${c.employees} employees · ${c.agents} agents`
    case 'team':       return `${c.team} login${c.team === 1 ? '' : 's'}`
    case 'review':     return ''
  }
}

const NEXT: { href: string; label: string; note: string; icon: React.ElementType }[] = [
  { href: '/settings/opening-balances', label: 'Load opening balances', note: 'Stock on hand per warehouse, cash, and post-dated cheques already in hand', icon: Wallet },
  { href: '/settings/period-lock',      label: 'Lock the past',          note: 'Once openings are entered, close the books before your start date so nothing is back-dated', icon: Lock },
  { href: '/sales/new',                 label: 'Record your first sale',  note: 'Pick a customer and an item — the invoice prints with your business name', icon: ShoppingBag },
  { href: '/purchases/new',             label: 'Record a purchase',       note: 'Stock arrives, the supplier ledger updates, and the ledger posts itself', icon: ShoppingCart },
]

export function ReviewStep({ data, onJump }: { data: SetupData; onJump: (key: StepKey) => void }) {
  const rows = STEPS.filter((s) => s.key !== 'review').map((s) => ({ ...s, status: stepStatus(s.key, data) }))
  const missing = rows.filter((r) => r.status === 'todo')
  const ready = missing.length === 0

  return (
    <div>
      <StepHeader
        icon={ready ? PartyPopper : Flag}
        title={ready ? 'You are ready to trade' : 'Almost there'}
        description={
          ready
            ? 'All the master data a transaction needs is in place. Two more things make the books accurate from day one.'
            : `${missing.length} required step${missing.length === 1 ? ' is' : 's are'} still empty. You can go live without them, but the first document will ask for them.`
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/40">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Setup checklist</p>
          </div>
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.key} className="flex items-center gap-3 px-4 py-2.5">
                {r.status === 'done'
                  ? <span className="h-6 w-6 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0"><Check className="h-3.5 w-3.5" /></span>
                  : <span className={cn('h-6 w-6 rounded-full flex items-center justify-center shrink-0', r.status === 'todo' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-muted text-muted-foreground')}><Circle className="h-3 w-3" /></span>}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-tight">{r.label}{r.optional && <span className="ml-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">optional</span>}</p>
                  <p className="text-xs text-muted-foreground truncate">{countFor(r.key, data)}</p>
                </div>
                <button type="button" onClick={() => onJump(r.key)} className="text-xs font-semibold text-primary hover:underline shrink-0">
                  {r.status === 'done' ? 'Add more' : 'Fill in'}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1">What to do next</p>
          {NEXT.map((n, i) => (
            <Link
              key={n.href}
              href={n.href}
              className="group flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm hover:border-primary/50 hover:bg-secondary/60 transition-all"
            >
              <span className={cn('icon-chip h-9 w-9 rounded-xl shrink-0', ['icon-chip-lime', 'icon-chip-amber', 'icon-chip-cyan', 'icon-chip-violet'][i])}><n.icon className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{n.label}</p>
                <p className="text-xs text-muted-foreground leading-snug">{n.note}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary mt-1 shrink-0 transition-colors" />
            </Link>
          ))}
          <Button asChild className="min-h-[48px] mt-2 text-base">
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

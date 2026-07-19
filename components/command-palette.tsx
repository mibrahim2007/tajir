'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Banknote, BarChart2, BookOpen,
  ClipboardList, FileMinus, FilePlus, FileSearch, HandCoins, LayoutDashboard,
  Landmark, Layers, Lock, MapPin, Package, PenLine, Plus, Receipt, RefreshCcw, Search,
  PieChart, ShoppingBag, ShoppingCart, Tag, Truck, Undo2, UserCog, Users, UsersRound,
  Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

type CommandItem = {
  href: string
  label: string
  group: string
  icon: React.ElementType
  ownerOnly?: boolean
}

const ALL_COMMANDS: CommandItem[] = [
  // Quick Create — shown first so keyboard users can act fast
  { href: '/purchases/new',           label: 'New Purchase',        group: 'Quick Create', icon: Plus },
  { href: '/sales/new',               label: 'New Sale',            group: 'Quick Create', icon: Plus },
  { href: '/receipts/new',            label: 'New Receipt',         group: 'Quick Create', icon: Plus, ownerOnly: true },
  { href: '/payments/new',            label: 'New Payment',         group: 'Quick Create', icon: Plus, ownerOnly: true },
  { href: '/gatepasses/new',          label: 'New Gatepass',        group: 'Quick Create', icon: Plus },
  { href: '/expenses/new',            label: 'New Expense',         group: 'Quick Create', icon: Plus, ownerOnly: true },
  { href: '/vouchers/new',            label: 'New Voucher',         group: 'Quick Create', icon: Plus, ownerOnly: true },
  { href: '/purchase-returns/new',    label: 'New Purchase Return', group: 'Quick Create', icon: Plus },
  { href: '/sale-returns/new',        label: 'New Sale Return',     group: 'Quick Create', icon: Plus },
  { href: '/stock-transfers/new',     label: 'New Stock Transfer',  group: 'Quick Create', icon: Plus, ownerOnly: true },
  { href: '/credit-notes/new',        label: 'New Credit Note',     group: 'Quick Create', icon: Plus, ownerOnly: true },
  { href: '/debit-notes/new',         label: 'New Debit Note',      group: 'Quick Create', icon: Plus, ownerOnly: true },
  // Pages
  { href: '/dashboard',               label: 'Dashboard',           group: 'Pages', icon: LayoutDashboard },
  { href: '/inventory',               label: 'Inventory',           group: 'Pages', icon: Package },
  { href: '/purchases',               label: 'Purchases',           group: 'Pages', icon: ShoppingCart },
  { href: '/purchase-returns',        label: 'Purchase Returns',    group: 'Pages', icon: Undo2 },
  { href: '/sales',                   label: 'Sales',               group: 'Pages', icon: ShoppingBag },
  { href: '/sale-returns',            label: 'Sale Returns',        group: 'Pages', icon: RefreshCcw },
  { href: '/gatepasses',              label: 'Gatepasses',          group: 'Pages', icon: ClipboardList },
  { href: '/locations',               label: 'Locations',           group: 'Pages', icon: MapPin, ownerOnly: true },
  { href: '/stock-transfers',         label: 'Stock Transfers',     group: 'Pages', icon: ArrowLeftRight, ownerOnly: true },
  { href: '/customers',               label: 'Customers',           group: 'Pages', icon: Users, ownerOnly: true },
  { href: '/receipts',                label: 'Receipts',            group: 'Pages', icon: ArrowDownLeft, ownerOnly: true },
  { href: '/credit-notes',            label: 'Credit Notes',        group: 'Pages', icon: FileMinus, ownerOnly: true },
  { href: '/suppliers',               label: 'Suppliers',           group: 'Pages', icon: Truck, ownerOnly: true },
  { href: '/payments',                label: 'Payments',            group: 'Pages', icon: ArrowUpRight, ownerOnly: true },
  { href: '/debit-notes',             label: 'Debit Notes',         group: 'Pages', icon: FilePlus, ownerOnly: true },
  { href: '/pricing',                 label: 'Pricing',             group: 'Pages', icon: Tag, ownerOnly: true },
  { href: '/expenses',                label: 'Expenses',            group: 'Pages', icon: Receipt, ownerOnly: true },
  { href: '/employees',               label: 'Employees',           group: 'Pages', icon: HandCoins },
  { href: '/loans',                   label: 'Loans',               group: 'Pages', icon: Banknote },
  { href: '/owners',                  label: 'Owners',              group: 'Pages', icon: UserCog, ownerOnly: true },
  { href: '/owners/profit-allocation', label: 'Profit Allocation',  group: 'Pages', icon: PieChart, ownerOnly: true },
  { href: '/accounts',                label: 'Accounts',            group: 'Pages', icon: BookOpen, ownerOnly: true },
  { href: '/vouchers',                label: 'Vouchers',            group: 'Pages', icon: PenLine, ownerOnly: true },
  { href: '/reports',                 label: 'Reports',             group: 'Pages', icon: BarChart2, ownerOnly: true },
  // Settings
  { href: '/item-types',              label: 'Item Types',          group: 'Settings', icon: Layers, ownerOnly: true },
  { href: '/settings/team',           label: 'Team',                group: 'Settings', icon: UsersRound, ownerOnly: true },
  { href: '/settings/opening-balances', label: 'Opening Balances', group: 'Settings', icon: Wallet, ownerOnly: true },
  { href: '/settings/period-lock',    label: 'Close the Books',    group: 'Settings', icon: Lock, ownerOnly: true },
  { href: '/banks',                   label: 'Banks',               group: 'Settings', icon: Landmark, ownerOnly: true },
  { href: '/audit',                   label: 'Audit Log',           group: 'Settings', icon: FileSearch, ownerOnly: true },
]

function getResults(query: string, isOwner: boolean): CommandItem[] {
  const pool = isOwner ? ALL_COMMANDS : ALL_COMMANDS.filter(c => !c.ownerOnly)
  if (!query.trim()) return pool.slice(0, 9)
  const q = query.toLowerCase()
  return pool.filter(c =>
    c.label.toLowerCase().includes(q) ||
    c.group.toLowerCase().includes(q)
  )
}

/* ── Main palette dialog ─────────────────────────────────────────────── */

export function CommandPalette({ role }: { role: string }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef  = useRef<HTMLDivElement>(null)

  const isOwner = role === 'owner'
  const results = getResults(query, isOwner)

  const navigate = useCallback((href: string) => {
    setOpen(false)
    setQuery('')
    router.push(href)
  }, [router])

  /* Global Ctrl+K / Cmd+K */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /* Custom event from sidebar / header trigger buttons */
  useEffect(() => {
    const onEvent = () => setOpen(true)
    window.addEventListener('open-command-palette', onEvent)
    return () => window.removeEventListener('open-command-palette', onEvent)
  }, [])

  /* Focus + reset on open */
  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIdx(0)
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [open])

  /* Reset active when results change */
  useEffect(() => { setActiveIdx(0) }, [query])

  /* Scroll active item into view */
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${activeIdx}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && results[activeIdx]) navigate(results[activeIdx].href)
  }

  /* Group results for rendering */
  const grouped = results.reduce<{ group: string; items: { item: CommandItem; idx: number }[] }[]>(
    (acc, item, i) => {
      const g = acc.find(x => x.group === item.group)
      if (g) g.items.push({ item, idx: i })
      else   acc.push({ group: item.group, items: [{ item, idx: i }] })
      return acc
    }, []
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        className="p-0 gap-0 top-[15vh] translate-y-0 max-w-[560px] overflow-hidden"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">Quick Search</DialogTitle>

        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search pages and actions…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {!query && (
            <kbd className="hidden sm:block text-[10px] text-muted-foreground border rounded px-1.5 py-0.5 font-mono">
              ESC
            </kbd>
          )}
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Results */}
        <div ref={listRef} className="overflow-y-auto max-h-[340px] py-1.5">
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              No results for &ldquo;{query}&rdquo;
            </p>
          ) : (
            grouped.map(({ group, items }) => (
              <div key={group}>
                <p className="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                  {group}
                </p>
                {items.map(({ item, idx }) => {
                  const active = idx === activeIdx
                  return (
                    <button
                      key={item.href}
                      data-idx={idx}
                      onClick={() => navigate(item.href)}
                      onMouseEnter={() => setActiveIdx(idx)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors',
                        active
                          ? 'bg-accent text-foreground'
                          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                      )}
                    >
                      <item.icon className={cn(
                        'h-4 w-4 shrink-0',
                        active ? 'text-primary' : 'opacity-60'
                      )} />
                      <span className="flex-1 truncate font-medium">{item.label}</span>
                      {active && (
                        <kbd className="text-[10px] border rounded px-1 py-0.5 font-mono opacity-50">↵</kbd>
                      )}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-2 flex items-center gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="border rounded px-1 font-mono">↑↓</kbd> navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="border rounded px-1 font-mono">↵</kbd> open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="border rounded px-1 font-mono">Esc</kbd> close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ── Trigger button — rendered inside the sidebar ────────────────────── */

export function CommandPaletteTrigger() {
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12.5px] text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors border border-border/50 bg-muted/20 group"
    >
      <Search className="h-3.5 w-3.5 shrink-0 opacity-60 group-hover:opacity-100" />
      <span className="flex-1 text-left">Search…</span>
      <kbd className="hidden sm:block text-[10px] border rounded px-1.5 py-0.5 font-mono opacity-50">
        Ctrl K
      </kbd>
    </button>
  )
}

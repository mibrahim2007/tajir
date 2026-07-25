'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import {
  FlaskConical, Sparkles, User, ArrowUp, Trash2, KeyRound,
  CheckCircle2, Package, MapPin, Truck, Users, Boxes, CalendarDays,
} from 'lucide-react'
import { startWizard, advance, type BotMessage, type WizardState } from '@/lib/playground/engine'
import { generateDemoDataAction } from '@/app/actions/generate-demo-data'
import { removeDemoDataAction } from '@/app/actions/remove-demo-data'
import { listDemoBatchesAction } from '@/app/actions/list-demo-batches'
import type { DemoBatchInfo, DemoConfig, GenerateResult } from '@/lib/playground/types'

type ChatItem =
  | { role: 'user'; text: string }
  | { role: 'bot'; msg: BotMessage }
  | { role: 'result'; result: GenerateResult }

// Render **bold** spans; everything else is plain text.
function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <span className="whitespace-pre-wrap">
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**')
          ? <strong key={i} className="font-semibold text-foreground">{p.slice(2, -2)}</strong>
          : <span key={i}>{p}</span>,
      )}
    </span>
  )
}

function SummaryCard({ config }: { config: DemoConfig }) {
  const items = config.itemTypes.length * config.itemsPerType
  const stats: { icon: React.ElementType; label: string; value: string }[] = [
    { icon: Boxes, label: 'Item types', value: String(config.itemTypes.length) },
    { icon: Package, label: 'Items', value: `${items}` },
    { icon: MapPin, label: 'Locations', value: String(config.locations) },
    { icon: Truck, label: 'Suppliers', value: String(config.suppliers) },
    { icon: User, label: 'Customers', value: String(config.customers) },
    { icon: Users, label: 'Employees', value: String(config.employees) },
    { icon: KeyRound, label: 'Login users', value: String(config.users) },
    { icon: CalendarDays, label: 'Txn days', value: String(config.days) },
  ]
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {config.itemTypes.map((t) => (
          <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{t}</span>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border bg-card px-3 py-2">
            <s.icon className="h-3.5 w-3.5 text-muted-foreground mb-1" />
            <p className="text-[10.5px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <p className="text-[15px] font-bold tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function ResultView({ result }: { result: GenerateResult }) {
  const s = result.summary
  const rows: [string, number][] = [
    ['Item types', s.itemTypes], ['Items', s.items], ['Locations', s.locations],
    ['Suppliers', s.suppliers], ['Customers', s.customers], ['Employees', s.employees],
    ['Login users', s.users], ['Purchase invoices', s.purchaseInvoices], ['Sale invoices', s.saleInvoices],
  ]
  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 font-semibold text-[15px] text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-5 w-5" /> Demo data created
      </p>
      <div className="grid grid-cols-3 gap-2">
        {rows.filter(([, v]) => v > 0).map(([label, v]) => (
          <div key={label} className="rounded-lg border bg-card px-2.5 py-1.5">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="text-sm font-bold tabular-nums">{v}</p>
          </div>
        ))}
      </div>
      {result.credentials.length > 0 && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
            <KeyRound className="h-3.5 w-3.5" /> Login accounts — copy these now, passwords aren&apos;t shown again
          </p>
          <div className="space-y-1">
            {result.credentials.map((c) => (
              <div key={c.email} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] font-mono">
                <span className="text-foreground">{c.email}</span>
                <span className="text-muted-foreground">{c.tempPassword}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Explore it across the app. Remove it anytime from the cleanup panel above.</p>
    </div>
  )
}

export function PlaygroundChat({ initialBatches }: { initialBatches: DemoBatchInfo[] }) {
  const [items, setItems] = useState<ChatItem[]>([])
  const [state, setState] = useState<WizardState>(() => ({ index: 0, config: {}, awaitingConfirm: false, done: false }))
  const [batches, setBatches] = useState<DemoBatchInfo[]>(initialBatches)
  const [input, setInput] = useState('')
  const [pending, startTransition] = useTransition()
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Kick off the wizard on mount.
  useEffect(() => {
    const s = startWizard()
    setState(s.state)
    setItems(s.messages.map((msg) => ({ role: 'bot', msg })))
  }, [])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [items, pending])

  const refreshBatches = () => { listDemoBatchesAction().then(setBatches).catch(() => {}) }

  const runGenerate = (config: DemoConfig) => {
    startTransition(async () => {
      const res = await generateDemoDataAction(config)
      if (res.success) {
        setItems((it) => [...it, { role: 'result', result: res.data }])
        refreshBatches()
      } else {
        setItems((it) => [...it, { role: 'bot', msg: { kind: 'text', body: `⚠️ ${res.error}\n\nType **restart** to try again.` } }])
      }
      // Prepare for another round.
      const s = startWizard()
      setState(s.state)
      inputRef.current?.focus()
    })
  }

  const submit = (raw: string) => {
    const q = raw.trim()
    if (!q || pending) return
    setInput('')
    setItems((it) => [...it, { role: 'user', text: q }])
    const res = advance(state, q)
    setState(res.state)
    setItems((it) => [...it, ...res.messages.map((msg) => ({ role: 'bot' as const, msg }))])
    if (res.generate) runGenerate(res.generate)
    else inputRef.current?.focus()
  }

  const remove = (batch: DemoBatchInfo) => {
    if (pending) return
    startTransition(async () => {
      const res = await removeDemoDataAction({ batchId: batch.id })
      if (res.success) {
        setBatches((b) => b.filter((x) => x.id !== batch.id))
        setItems((it) => [...it, { role: 'bot', msg: { kind: 'text', body: `🧹 Removed ${res.data.removed} records from that batch.` } }])
      } else {
        setItems((it) => [...it, { role: 'bot', msg: { kind: 'text', body: `⚠️ ${res.error}` } }])
      }
    })
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] lg:h-screen max-w-3xl mx-auto">
      <div className="px-5 pt-6 pb-3 shrink-0">
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <FlaskConical className="h-6 w-6 text-primary" /> Demo Data Playground
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Answer a few questions and I&apos;ll generate realistic test data — items, parties, staff, logins and transactions — that you can explore and remove in one click.
        </p>
      </div>

      {/* Existing demo batches — cleanup panel */}
      {batches.length > 0 && (
        <div className="mx-5 mb-2 shrink-0 rounded-xl border bg-card p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Existing demo data ({batches.length} {batches.length === 1 ? 'batch' : 'batches'})</p>
          <div className="space-y-1.5">
            {batches.map((b) => {
              const s = b.summary
              return (
                <div key={b.id} className="flex items-center gap-3 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{new Date(b.createdAt).toLocaleString()}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {s.items ?? 0} items · {s.customers ?? 0} customers · {s.suppliers ?? 0} suppliers · {s.saleInvoices ?? 0} sales · {s.purchaseInvoices ?? 0} purchases · {s.users ?? 0} users
                    </p>
                  </div>
                  <button
                    onClick={() => remove(b)}
                    disabled={pending}
                    className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10 disabled:opacity-40 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 space-y-4 pb-4">
        {items.map((it, i) =>
          it.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <div className="flex items-start gap-2 max-w-[85%]">
                <div className="rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-3.5 py-2 text-sm">{it.text}</div>
                <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </div>
          ) : (
            <div key={i} className="flex items-start gap-2">
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div className="rounded-2xl rounded-tl-sm border bg-card px-4 py-3 max-w-full min-w-0 flex-1 text-sm leading-relaxed">
                {it.role === 'result'
                  ? <ResultView result={it.result} />
                  : it.msg.kind === 'summary'
                    ? <SummaryCard config={it.msg.config} />
                    : <Rich text={it.msg.body} />}
              </div>
            </div>
          ),
        )}

        {pending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 text-primary animate-pulse" />
            </div>
            Working on it…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="shrink-0 border-t bg-background px-5 py-3">
        <form onSubmit={(e) => { e.preventDefault(); submit(input) }} className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your answer, or ask a question…"
            className="flex-1 min-h-[44px] rounded-xl border bg-card px-4 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            type="submit"
            disabled={pending || !input.trim()}
            className="h-11 w-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 transition-opacity shrink-0"
            aria-label="Send"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        </form>
      </div>
    </div>
  )
}

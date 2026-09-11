'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Check, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { STEPS, stepStatus, type SetupData, type StepKey } from './setup-types'
import { BusinessStep, AccountsStep } from './steps-business'
import { CategoriesStep, WarehousesStep, ItemsStep } from './steps-stock'
import { CustomersStep, SuppliersStep, BanksStep } from './steps-parties'
import { PeopleStep, TeamStep } from './steps-people'
import { ReviewStep } from './steps-review'

const STORAGE_KEY = 'tajir.setup.step'

function readStoredStep(): StepKey | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return STEPS.some((s) => s.key === v) ? (v as StepKey) : null
  } catch { return null }
}

export function SetupWizard({ data }: { data: SetupData }) {
  // Start where the user left off; on a first visit, at the first empty step
  // so a half-finished tenant is not walked through what it already has.
  const firstTodo = STEPS.find((s) => stepStatus(s.key, data) === 'todo')?.key ?? 'review'
  const [current, setCurrent] = useState<StepKey>(firstTodo)
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    const stored = readStoredStep()
    if (stored) setCurrent(stored)
    setHydrated(true)
  }, [])
  useEffect(() => {
    if (!hydrated) return
    try { localStorage.setItem(STORAGE_KEY, current) } catch {}
    // Keep the active chip visible in the horizontal rail on phones.
    document.querySelector<HTMLElement>(`[data-step-chip="${current}"]`)
      ?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [current, hydrated])

  const index = STEPS.findIndex((s) => s.key === current)
  const step = STEPS[index]
  const prev = STEPS[index - 1]
  const next = STEPS[index + 1]

  const statuses = useMemo(() => new Map(STEPS.map((s) => [s.key, stepStatus(s.key, data)])), [data])
  const required = STEPS.filter((s) => !s.optional && s.key !== 'review')
  const doneCount = required.filter((s) => statuses.get(s.key) === 'done').length
  const pct = Math.round((doneCount / required.length) * 100)

  const go = (key: StepKey) => {
    setCurrent(key)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Master Data Setup
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Everything Tajir needs before the first invoice, in the order it needs it. Come back any time — nothing is created twice.
          </p>
        </div>
        <div className="sm:text-right shrink-0">
          <p className="text-xs font-semibold text-muted-foreground">{doneCount} of {required.length} required steps done</p>
          <div className="h-1.5 w-full sm:w-48 rounded-full bg-muted mt-1.5 overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      {/* ── Mobile rail ── */}
      <div className="lg:hidden -mx-4 px-4 mb-4 overflow-x-auto">
        <ol className="flex gap-1.5 w-max">
          {STEPS.map((s, i) => {
            const st = statuses.get(s.key)
            const active = s.key === current
            return (
              <li key={s.key}>
                <button
                  type="button"
                  data-step-chip={s.key}
                  onClick={() => go(s.key)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors',
                    active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground',
                  )}
                >
                  {st === 'done' && !active ? <Check className="h-3 w-3 text-emerald-500" /> : <span className="tabular-nums">{i + 1}</span>}
                  {s.label}
                </button>
              </li>
            )
          })}
        </ol>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* ── Desktop rail ── */}
        <aside className="hidden lg:block">
          <ol className="sticky top-6 bg-card rounded-2xl border border-border shadow-sm p-2">
            {STEPS.map((s, i) => {
              const st = statuses.get(s.key)
              const active = s.key === current
              return (
                <li key={s.key}>
                  <button
                    type="button"
                    onClick={() => go(s.key)}
                    className={cn(
                      'w-full flex items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                      active ? 'bg-primary/10' : 'hover:bg-secondary/60',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 border',
                        st === 'done'
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                          : active
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'bg-muted border-border text-muted-foreground',
                      )}
                    >
                      {st === 'done' ? <Check className="h-3.5 w-3.5" /> : i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className={cn('block text-[13px] font-semibold leading-tight', active ? 'text-foreground' : 'text-foreground/90')}>
                        {s.label}
                        {s.optional && <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">opt</span>}
                      </span>
                      <span className="block text-[11px] text-muted-foreground truncate">{s.hint}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </aside>

        {/* ── Step body ── */}
        <section className="min-w-0">
          <div className="bg-tile/40 rounded-2xl border border-border p-4 sm:p-6">
            {current === 'business'   && <BusinessStep data={data} />}
            {current === 'accounts'   && <AccountsStep data={data} />}
            {current === 'categories' && <CategoriesStep data={data} />}
            {current === 'warehouses' && <WarehousesStep data={data} />}
            {current === 'items'      && <ItemsStep data={data} />}
            {current === 'customers'  && <CustomersStep data={data} />}
            {current === 'suppliers'  && <SuppliersStep data={data} />}
            {current === 'banks'      && <BanksStep data={data} />}
            {current === 'people'     && <PeopleStep data={data} />}
            {current === 'team'       && <TeamStep data={data} />}
            {current === 'review'     && <ReviewStep data={data} onJump={go} />}
          </div>

          {/* ── Footer nav ── */}
          <div className="flex items-center justify-between gap-3 mt-4">
            <div>
              {prev && (
                <Button type="button" variant="outline" className="min-h-[44px]" onClick={() => go(prev.key)}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> {prev.label}
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline text-xs text-muted-foreground tabular-nums">Step {index + 1} of {STEPS.length}</span>
              {next ? (
                <Button type="button" className="min-h-[44px]" onClick={() => go(next.key)}>
                  {statuses.get(current) === 'done' || current === 'business' ? 'Next' : step.optional ? 'Skip for now' : 'Continue anyway'}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button asChild className="min-h-[44px]"><Link href="/dashboard">Finish</Link></Button>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

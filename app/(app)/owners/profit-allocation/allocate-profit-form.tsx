'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { formatPKR } from '@/lib/utils/currency'
import { previewProfitAllocationAction, type AllocationPreview } from '@/app/actions/preview-profit-allocation'
import { createProfitAllocationAction } from '@/app/actions/create-profit-allocation'

// Two-step: preview the split for a period, then commit it. The preview is
// server-computed from the same P&L helper the action posts from, so what the
// owner approves is exactly what posts.
export function AllocateProfitForm({ defaultFrom, defaultTo }: { defaultFrom: string; defaultTo: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(defaultTo)
  const [notes, setNotes] = useState('')
  const [preview, setPreview] = useState<AllocationPreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Any date edit invalidates a preview so a stale split can never be committed.
  const resetPreview = () => setPreview(null)

  const onPreview = () => {
    startTransition(async () => {
      setError(null)
      setPreview(null)
      const result = await previewProfitAllocationAction({ periodStart: from, periodEnd: to })
      if (!result.success) { setError(result.error); return }
      setPreview(result.data)
    })
  }

  const onCommit = () => {
    startTransition(async () => {
      setError(null)
      const result = await createProfitAllocationAction({ periodStart: from, periodEnd: to, notes })
      if (!result.success) { setError(result.error); return }
      setPreview(null)
      setNotes('')
      setOpen(false)
      router.refresh()
    })
  }

  const isProfit = (preview?.netProfit ?? 0) > 0
  const canCommit = !!preview && preview.sharesComplete && Math.abs(preview.netProfit) >= 0.01

  return (
    <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setPreview(null); setError(null) } }}>
      <SheetTrigger asChild>
        <Button className="min-h-[44px]">Allocate Profit</Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Allocate Profit to Owners</SheetTitle>
          <SheetDescription>
            Net profit is computed from the ledger for the period, then split by each owner&rsquo;s share %.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 mt-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">Period Start</label>
              <Input type="date" value={from} className="min-h-[44px]"
                onChange={(e) => { setFrom(e.target.value); resetPreview() }} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">Period End</label>
              <Input type="date" value={to} className="min-h-[44px]"
                onChange={(e) => { setTo(e.target.value); resetPreview() }} />
            </div>
          </div>

          <Button type="button" variant="outline" className="min-h-[44px]" onClick={onPreview} disabled={isPending}>
            {isPending && !preview ? 'Calculating…' : 'Calculate Split'}
          </Button>

          {preview && (
            <>
              <Separator />

              <div className={`rounded-lg border px-4 py-3 flex items-center justify-between font-semibold ${
                isProfit
                  ? 'bg-green-50 dark:bg-green-950/30 border-green-200 text-green-800 dark:text-green-300'
                  : 'bg-red-50 dark:bg-red-950/30 border-destructive text-destructive'
              }`}>
                <span>{isProfit ? 'Net Profit' : 'Net Loss'}</span>
                <span className="tabular-nums">{formatPKR(Math.abs(preview.netProfit))}</span>
              </div>

              {!preview.sharesComplete && (
                <p className="text-sm text-destructive">
                  Active owners&rsquo; shares total {preview.totalSharePct.toFixed(2)}%, not 100%.
                  Fix the shares on the Owners page before allocating.
                </p>
              )}

              {preview.rows.length > 0 && (
                <div className="bg-card rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="text-left px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Owner</th>
                        <th className="text-right px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Share</th>
                        <th className="text-right px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {preview.rows.map((r) => (
                        <tr key={r.ownerId}>
                          <td className="px-4 py-2">{r.name}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{r.sharePct.toFixed(2)}%</td>
                          <td className="px-4 py-2 text-right tabular-nums font-medium">{formatPKR(r.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {canCommit && (
                <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">Will post as</p>
                  <p>
                    {isProfit ? (
                      <>Dr <span className="font-medium">Retained Earnings (3200)</span> · Cr <span className="font-medium">Owner&rsquo;s Capital (3100)</span> per owner</>
                    ) : (
                      <>Dr <span className="font-medium">Owner&rsquo;s Capital (3100)</span> per owner · Cr <span className="font-medium">Retained Earnings (3200)</span></>
                    )}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">Note (optional)</label>
                <Input placeholder="e.g. FY 2026 allocation" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="button" className="w-full min-h-[44px]" onClick={onCommit} disabled={isPending || !canCommit}>
            {isPending && preview ? 'Posting…' : 'Post Allocation'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

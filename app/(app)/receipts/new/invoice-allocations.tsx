'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'

/** An invoice the customer still owes on (see lib/receivables/invoice-receivables.ts). */
export type OpenInvoice = {
  key:     string
  serial:  string | null
  poNo:    string | null
  date:    string
  dueDate: string | null
  amount:  number
  balance: number
}

type Props = {
  invoices:    OpenInvoice[]
  /** invoice key → PKR applied. */
  value:       Record<string, number>
  onChange:    (next: Record<string, number>) => void
  /** Receipt total in PKR — what there is to apply. */
  receiptPkr:  number
}

const r2 = (n: number) => Math.round(n * 100) / 100
const fmtDate = (d: string) => formatPKTDate(d + 'T00:00:00')

export function appliedTotal(value: Record<string, number>): number {
  return Object.values(value).reduce((s, n) => s + (Number(n) || 0), 0)
}

/**
 * Optional "receipt against sale invoice" picker. Whatever is not applied
 * here keeps settling the oldest open invoices first, so leaving it empty
 * behaves exactly like a plain receipt.
 */
export function InvoiceAllocations({ invoices, value, onChange, receiptPkr }: Props) {
  const applied   = appliedTotal(value)
  const unapplied = r2(receiptPkr - applied)
  const today     = new Date().toISOString().split('T')[0]

  const setOne = (key: string, amount: number) => {
    const next = { ...value }
    if (amount > 0) next[key] = amount
    else delete next[key]
    onChange(next)
  }

  // Oldest first, as far as the receipt goes.
  const autoFill = () => {
    let left = receiptPkr
    const next: Record<string, number> = {}
    for (const inv of invoices) {
      if (left <= 0.005) break
      const take = r2(Math.min(left, inv.balance))
      if (take > 0) next[inv.key] = take
      left -= take
    }
    onChange(next)
  }

  if (invoices.length === 0) {
    return <p className="text-xs text-muted-foreground">This customer has no open sale invoices.</p>
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                <th className="w-10 px-3 py-2" />
                <th className="text-left px-3 py-2 font-medium">Invoice</th>
                <th className="text-left px-3 py-2 font-medium">Date</th>
                <th className="text-left px-3 py-2 font-medium">Due</th>
                <th className="text-right px-3 py-2 font-medium">Amount</th>
                <th className="text-right px-3 py-2 font-medium">Balance</th>
                <th className="text-right px-3 py-2 font-medium w-40">Apply (PKR)</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {invoices.map((inv) => {
                const current = value[inv.key] ?? 0
                const checked = current > 0
                const overdue = !!inv.dueDate && inv.dueDate < today
                const over    = current > inv.balance + 0.01
                return (
                  <tr key={inv.key} className={checked ? 'bg-green-50/60 dark:bg-green-950/20' : undefined}>
                    <td className="px-3 py-2">
                      <Checkbox
                        checked={checked}
                        aria-label={`Apply to invoice ${inv.serial ?? ''}`}
                        onCheckedChange={(on) => {
                          if (!on) return setOne(inv.key, 0)
                          // Fill what is left of the receipt, up to the balance.
                          const room = r2(receiptPkr - applied)
                          setOne(inv.key, r2(Math.min(inv.balance, room > 0 ? room : inv.balance)))
                        }}
                      />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="font-mono">{inv.serial ?? '—'}</span>
                      {inv.poNo && <span className="block text-xs text-muted-foreground">PO {inv.poNo}</span>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{fmtDate(inv.date)}</td>
                    <td className={`px-3 py-2 whitespace-nowrap ${overdue ? 'text-destructive font-medium' : ''}`}>
                      {inv.dueDate ? fmtDate(inv.dueDate) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{formatPKR(inv.amount)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-amber-600 dark:text-amber-400">{formatPKR(inv.balance)}</td>
                    <td className="px-3 py-2">
                      <Input
                        type="number" inputMode="decimal" step="0.01" min="0"
                        aria-label={`Amount applied to invoice ${inv.serial ?? ''}`}
                        value={current || ''}
                        placeholder="0"
                        onChange={(e) => setOne(inv.key, Number(e.target.value) || 0)}
                        className={`min-h-[40px] text-right tabular-nums ${over ? 'border-destructive' : ''}`}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={autoFill} disabled={receiptPkr <= 0}>
            Auto-apply oldest first
          </Button>
          {applied > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange({})}>Clear</Button>
          )}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 tabular-nums">
          <span>Applied <strong>{formatPKR(applied)}</strong></span>
          <span className={unapplied < -0.01 ? 'text-destructive font-semibold' : 'text-muted-foreground'}>
            {unapplied < -0.01 ? `Over by ${formatPKR(-unapplied)}` : `On account ${formatPKR(Math.max(unapplied, 0))}`}
          </span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Any amount not applied here settles this customer&apos;s oldest open invoices first.
      </p>
    </div>
  )
}

import { Card, CardContent } from '@/components/ui/card'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'

export type TxnHistoryItem = {
  id:        string
  date:      string
  type:      string
  amount:    number
  // 'up' increases the party's balance (a sale / purchase); 'down' settles it
  // (a receipt / payment / return).
  direction: 'up' | 'down'
}

const TYPE_BADGE: Record<string, string> = {
  Sale:     'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900',
  Purchase: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900',
  Receipt:  'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
  Payment:  'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
  Return:   'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
}

// Compact, scrollable list of a party's recent transactions. Shown above the
// Receipt/Payment Summary while recording a receipt or payment.
export function PartyTransactionHistory({ items }: { items: TxnHistoryItem[] }) {
  return (
    <Card>
      <CardContent className="px-5 pt-5 pb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="font-extrabold text-[15px] tracking-tight">Transaction History</p>
          <span className="text-xs text-muted-foreground">{items.length} recent</span>
        </div>

        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">No transactions yet.</p>
        ) : (
          <div className="max-h-64 overflow-y-auto -mx-1 px-1 divide-y divide-border/70">
            {items.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`text-[9px] font-semibold uppercase tracking-wide rounded border px-1 py-0.5 shrink-0 ${TYPE_BADGE[t.type] ?? 'bg-muted text-muted-foreground'}`}>
                    {t.type}
                  </span>
                  <span className="text-[11px] text-muted-foreground truncate">
                    {/* Drop the year — these are recent transactions, so day+month
                        is enough and leaves room for large amounts. */}
                    {formatPKTDate(t.date + 'T00:00:00').replace(/\s+\d{4}$/, '')}
                  </span>
                </div>
                <span className={`text-sm tabular-nums font-medium whitespace-nowrap shrink-0 pl-2 ${t.direction === 'down' ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
                  {/* Drop trailing .00 to save width for the date on large amounts */}
                  {t.direction === 'down' ? '− ' : ''}{formatPKR(t.amount).replace(/\.00$/, '')}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

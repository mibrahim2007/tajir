import Link from 'next/link'
import { Package, TrendingDown, TrendingUp, ArrowLeftRight, Scale, BookOpen } from 'lucide-react'
import { requireAuth } from '@/lib/auth/require-auth'

const reports = [
  { href: '/reports/purchases-sales', label: 'Purchase & Sales', description: 'Date-range report of all purchases and sales with totals and gross profit. Printable and exportable.', icon: ArrowLeftRight },
  { href: '/reports/stock-summary', label: 'Stock Summary', description: 'All stock items with current quantities. Filterable and exportable.', icon: Package },
  { href: '/reports/receivables-aging', label: 'Receivables Aging', description: 'Outstanding customer balances by 0–30, 31–60, 61–90, 90+ day buckets.', icon: TrendingUp },
  { href: '/reports/payables-aging', label: 'Payables Aging', description: 'Outstanding supplier balances by aging bucket.', icon: TrendingDown },
  { href: '/reports/trial-balance', label: 'Trial Balance', description: 'All GL account balances as of a given date. Verifies that total debits equal total credits.', icon: Scale },
  { href: '/reports/general-ledger', label: 'General Ledger', description: 'Full double-entry ledger with date range and account filters. Shows running balance per account.', icon: BookOpen },
]

export default async function ReportsPage() {
  await requireAuth()

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-1">Reports</h1>
      <p className="text-sm text-muted-foreground mb-6">Generate and export business reports.</p>

      <div className="grid gap-4">
        {reports.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="flex items-start gap-4 p-5 rounded-lg border hover:bg-accent transition-colors"
          >
            <r.icon className="h-5 w-5 mt-0.5 text-muted-foreground shrink-0" />
            <div>
              <p className="font-medium">{r.label}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{r.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

import Link from 'next/link'
import { Package, TrendingDown, TrendingUp, ArrowLeftRight, Scale, BookOpen, BarChart2, Landmark, Wallet, MapPin, ClipboardList, BookMarked, DollarSign, PieChart, Link2, HandCoins, Receipt } from 'lucide-react'
import { requireAuth } from '@/lib/auth/require-auth'
import { ReportsGuide } from './reports-guide'

const reports = [
  { href: '/reports/pending-balance', label: 'Pending Balance', description: 'Purchase and sale orders not yet fully received or dispatched via gatepass. Shows order qty, received qty, and remaining balance.', icon: ClipboardList },
  { href: '/reports/item-ledger', label: 'Item Ledger', description: 'All movements (purchases, sales, returns) for a selected stock item between dates, with running balance.', icon: BookMarked },
  { href: '/reports/item-profit-loss', label: 'Item Profit & Loss', description: 'Revenue, cost, and gross profit for a single stock item over a date range. Shows per-transaction breakdown with rates.', icon: PieChart },
  { href: '/reports/customer-profit-loss', label: 'Customer Profit & Loss', description: 'Gross profit per customer based on sales vs. purchase cost. Summary of all customers or drill into a single customer with full invoice detail.', icon: TrendingUp },
  { href: '/reports/purchase-detail', label: 'Purchase Detail', description: 'Every purchase invoice in a date range with its voucher number, supplier invoice number, and amount. Filter by supplier or search a bill number.', icon: Receipt },
  { href: '/reports/sale-detail', label: 'Sale Detail', description: 'Every sale invoice in a date range with its voucher number, PO number, DC number, and amount. Filter by customer or search a PO / DC number.', icon: Receipt },
  { href: '/reports/purchases-sales', label: 'Purchase & Sales', description: 'Date-range report of all purchases and sales with totals and gross profit. Printable and exportable.', icon: ArrowLeftRight },
  { href: '/reports/stock-summary', label: 'Stock Summary', description: 'All stock items with current quantities. Filterable and exportable.', icon: Package },
  { href: '/reports/stock-valuation', label: 'Stock Valuation', description: 'Current stock with rate (from latest purchase or opening rate) and total value in PKR. Printable.', icon: DollarSign },
  { href: '/reports/location-stock', label: 'Location-wise Stock', description: 'Stock quantities per location, computed from purchases, sales, returns, and transfers. Filterable and printable.', icon: MapPin },
  { href: '/reports/receivables-aging', label: 'Receivables Aging', description: 'Outstanding customer balances by 0–30, 31–60, 61–90, 90+ day buckets.', icon: TrendingUp },
  { href: '/reports/payables-aging', label: 'Payables Aging', description: 'Outstanding supplier balances by aging bucket.', icon: TrendingDown },
  { href: '/reports/employee-loans', label: 'Employee Loans', description: 'Outstanding loan balances and overdue installment amounts per employee, across all staff loans and advances.', icon: HandCoins },
  { href: '/reports/profit-loss', label: 'Profit & Loss', description: 'Revenue, cost of sales, operating expenses, and net profit for a date range.', icon: BarChart2 },
  { href: '/reports/balance-sheet', label: 'Balance Sheet', description: 'Assets, liabilities, and equity as of a given date. Verifies the accounting equation.', icon: Landmark },
  { href: '/reports/trial-balance', label: 'Trial Balance', description: 'All GL account balances as of a given date. Verifies that total debits equal total credits.', icon: Scale },
  { href: '/reports/general-ledger', label: 'General Ledger', description: 'Full double-entry ledger with date range and account filters. Shows running balance per account.', icon: BookOpen },
  { href: '/reports/consolidated-ledger', label: 'Consolidated Ledger', description: 'Map a customer to its supplier counterpart and view one net statement combining receivables and payables for the same party.', icon: Link2 },
  { href: '/reports/cashbook', label: 'Daily Cashbook', description: 'Cash in, cash out, and running balance across cash & bank accounts for a single day, with opening and closing balances.', icon: Wallet },
  { href: '/reports/bank-statement', label: 'Bank Statement', description: 'All deposits, withdrawals and running balance for a selected bank account over a date range. Printable.', icon: Landmark },
]

export default async function ReportsPage() {
  await requireAuth()

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">Generate and export business reports.</p>
        </div>
        <ReportsGuide />
      </div>

      <div className="grid gap-3">
        {reports.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="flex items-center gap-4 p-5 bg-card rounded-2xl border border-border shadow-sm hover:border-primary/40 hover:bg-secondary/50 transition-all group"
          >
            <span className="h-10 w-10 rounded-xl bg-accent text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <r.icon className="h-5 w-5" />
            </span>
            <div>
              <p className="font-bold text-foreground">{r.label}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{r.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

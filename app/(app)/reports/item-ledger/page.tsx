import Link from 'next/link'
import { Suspense } from 'react'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatPKTDate } from '@/lib/utils/dates'
import { ItemLedgerFilters } from './item-ledger-filters'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function ItemLedgerPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const itemId  = typeof params.item === 'string' ? params.item : undefined
  const today   = new Date().toISOString().split('T')[0]
  const firstOfMonth = today.slice(0, 8) + '01'
  const fromDate = typeof params.from === 'string' ? params.from : firstOfMonth
  const toDate   = typeof params.to   === 'string' ? params.to   : today

  const { tenantId } = await requireAuth()
  const admin = createAdminClient()

  const { data: rawLots } = await admin
    .from('inventory_lots').select('id, name, unit_of_measure').eq('tenant_id', tenantId).order('name')
  const lots = rawLots ?? []
  const lotMap = new Map(lots.map(l => [l.id, l.name]))

  if (!itemId) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <Link href="/reports" className="text-sm text-muted-foreground hover:text-foreground">← Reports</Link>
          <h1 className="text-2xl font-extrabold tracking-tight mt-1">Item Ledger</h1>
          <p className="text-sm text-muted-foreground mt-1">All movements for a stock item within a date range.</p>
        </div>
        <Suspense>
          <ItemLedgerFilters lots={lots} />
        </Suspense>
        <div className="bg-card rounded-2xl border border-dashed py-16 text-center shadow-sm mt-4">
          <p className="text-muted-foreground text-sm">Select a stock item to view its ledger.</p>
        </div>
      </div>
    )
  }

  const itemName = lotMap.get(itemId) ?? itemId
  const uom = lots.find(l => l.id === itemId)?.unit_of_measure ?? null

  /* Fetch supplier/customer maps */
  const [{ data: rawSuppliers }, { data: rawCustomers }] = await Promise.all([
    admin.from('suppliers').select('id, name').eq('tenant_id', tenantId),
    admin.from('tajir_customers').select('id, name').eq('tenant_id', tenantId),
  ])
  const supplierMap = new Map((rawSuppliers ?? []).map(s => [s.id, s.name]))
  const customerMap = new Map((rawCustomers ?? []).map(c => [c.id, c.name]))

  /* Fetch all movements for opening balance (before fromDate) */
  const [
    { data: poOpen }, { data: soOpen }, { data: prOpen }, { data: srOpen }
  ] = await Promise.all([
    admin.from('purchase_orders').select('quantity').eq('tenant_id', tenantId).eq('stock_item_id', itemId).lt('date', fromDate),
    admin.from('sales_orders').select('quantity').eq('tenant_id', tenantId).eq('stock_item_id', itemId).lt('date', fromDate),
    admin.from('purchase_returns').select('quantity').eq('tenant_id', tenantId).eq('stock_item_id', itemId).lt('date', fromDate),
    admin.from('sale_returns').select('quantity').eq('tenant_id', tenantId).eq('stock_item_id', itemId).lt('date', fromDate),
  ])

  const sumQty = (arr: { quantity: string | number }[] | null) =>
    (arr ?? []).reduce((s, r) => s + Number(r.quantity), 0)

  const openingBalance =
    sumQty(poOpen) + sumQty(srOpen) - sumQty(soOpen) - sumQty(prOpen)

  /* Fetch movements within date range */
  const [
    { data: purchases },
    { data: sales },
    { data: purchaseReturns },
    { data: saleReturns },
  ] = await Promise.all([
    admin.from('purchase_orders').select('id, date, created_at, quantity, supplier_id').eq('tenant_id', tenantId).eq('stock_item_id', itemId).gte('date', fromDate).lte('date', toDate),
    admin.from('sales_orders').select('id, date, created_at, quantity, customer_id').eq('tenant_id', tenantId).eq('stock_item_id', itemId).gte('date', fromDate).lte('date', toDate),
    admin.from('purchase_returns').select('id, date, created_at, quantity, supplier_id').eq('tenant_id', tenantId).eq('stock_item_id', itemId).gte('date', fromDate).lte('date', toDate),
    admin.from('sale_returns').select('id, date, created_at, quantity, customer_id').eq('tenant_id', tenantId).eq('stock_item_id', itemId).gte('date', fromDate).lte('date', toDate),
  ])

  type LedgerRow = { date: string; sortKey: string; type: string; party: string; qtyIn: number; qtyOut: number }

  const ledgerRows: LedgerRow[] = [
    ...(purchases ?? []).map(r => ({
      date: r.date, sortKey: r.date + '|' + (r.created_at ?? '') + '|' + r.id,
      type: 'Purchase', party: supplierMap.get(r.supplier_id) ?? '—',
      qtyIn: Number(r.quantity), qtyOut: 0,
    })),
    ...(sales ?? []).map(r => ({
      date: r.date, sortKey: r.date + '|' + (r.created_at ?? '') + '|' + r.id,
      type: 'Sale', party: customerMap.get(r.customer_id) ?? '—',
      qtyIn: 0, qtyOut: Number(r.quantity),
    })),
    ...(purchaseReturns ?? []).map(r => ({
      date: r.date, sortKey: r.date + '|' + (r.created_at ?? '') + '|' + r.id,
      type: 'Purchase Return', party: supplierMap.get(r.supplier_id) ?? '—',
      qtyIn: 0, qtyOut: Number(r.quantity),
    })),
    ...(saleReturns ?? []).map(r => ({
      date: r.date, sortKey: r.date + '|' + (r.created_at ?? '') + '|' + r.id,
      type: 'Sale Return', party: customerMap.get(r.customer_id) ?? '—',
      qtyIn: Number(r.quantity), qtyOut: 0,
    })),
  ].sort((a, b) => a.sortKey.localeCompare(b.sortKey))

  const totalIn  = ledgerRows.reduce((s, r) => s + r.qtyIn, 0)
  const totalOut = ledgerRows.reduce((s, r) => s + r.qtyOut, 0)
  const closingBalance = openingBalance + totalIn - totalOut

  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 3 })

  const typeColor = (type: string) => {
    if (type === 'Purchase')        return 'text-blue-600 dark:text-blue-400'
    if (type === 'Sale')            return 'text-green-600 dark:text-green-400'
    if (type === 'Purchase Return') return 'text-orange-600 dark:text-orange-400'
    if (type === 'Sale Return')     return 'text-purple-600 dark:text-purple-400'
    return ''
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-4">
        <Link href="/reports" className="text-sm text-muted-foreground hover:text-foreground">← Reports</Link>
        <h1 className="text-2xl font-extrabold tracking-tight mt-1">Item Ledger</h1>
        <p className="text-sm text-muted-foreground mt-1">
          <span className="font-semibold text-foreground">{itemName}</span>
          {' · '}{fromDate} to {toDate}
        </p>
      </div>

      <Suspense>
        <ItemLedgerFilters lots={lots} />
      </Suspense>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 mb-5">
        {[
          { label: 'Opening Balance', value: fmt(openingBalance), color: 'text-foreground' },
          { label: 'Total In',        value: fmt(totalIn),        color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Total Out',       value: fmt(totalOut),       color: 'text-green-600 dark:text-green-400' },
          { label: 'Closing Balance', value: fmt(closingBalance), color: closingBalance >= 0 ? 'text-foreground' : 'text-destructive' },
        ].map(c => (
          <div key={c.label} className="bg-card border rounded-xl p-4 shadow-sm">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">{c.label}</p>
            <p className={`text-xl font-extrabold tabular-nums ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {ledgerRows.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed py-12 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">No movements for this item in the selected date range.</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Type</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Party</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Qty In{uom && <span className="ml-1 font-normal normal-case text-muted-foreground">({uom})</span>}</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-green-600 dark:text-green-400">Qty Out{uom && <span className="ml-1 font-normal normal-case text-muted-foreground">({uom})</span>}</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Balance{uom && <span className="ml-1 font-normal normal-case">({uom})</span>}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {/* Opening balance row */}
                <tr className="bg-muted/20">
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{fromDate}</td>
                  <td colSpan={2} className="px-4 py-2.5 text-xs font-medium text-muted-foreground italic">Opening Balance</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">—</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">—</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{fmt(openingBalance)}</td>
                </tr>

                {/* Ledger rows with running balance */}
                {(() => {
                  let running = openingBalance
                  return ledgerRows.map((row, i) => {
                    running += row.qtyIn - row.qtyOut
                    return (
                      <tr key={i} className="hover:bg-secondary/50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">{formatPKTDate(new Date(row.date))}</td>
                        <td className={`px-4 py-3 font-medium ${typeColor(row.type)}`}>{row.type}</td>
                        <td className="px-4 py-3 text-muted-foreground">{row.party}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-blue-600 dark:text-blue-400">
                          {row.qtyIn > 0 ? fmt(row.qtyIn) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-green-600 dark:text-green-400">
                          {row.qtyOut > 0 ? fmt(row.qtyOut) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold">{fmt(running)}</td>
                      </tr>
                    )
                  })
                })()}
              </tbody>
              <tfoot className="border-t-2 bg-muted/30">
                <tr>
                  <td colSpan={3} className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Closing Balance</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-bold text-blue-600 dark:text-blue-400">{fmt(totalIn)}{uom && <span className="ml-1 text-xs font-normal text-muted-foreground">{uom}</span>}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-bold text-green-600 dark:text-green-400">{fmt(totalOut)}{uom && <span className="ml-1 text-xs font-normal text-muted-foreground">{uom}</span>}</td>
                  <td className={`px-4 py-2.5 text-right tabular-nums font-bold ${closingBalance >= 0 ? '' : 'text-destructive'}`}>{fmt(closingBalance)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

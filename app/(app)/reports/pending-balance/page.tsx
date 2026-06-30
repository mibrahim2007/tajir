import Link from 'next/link'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatPKTDate } from '@/lib/utils/dates'

type SearchParams = Promise<{ type?: string }>

export default async function PendingBalancePage({ searchParams }: { searchParams: SearchParams }) {
  const { type } = await searchParams
  const tab = type === 'sale' ? 'sale' : 'purchase'

  const { tenantId } = await requireAuth()
  const admin = createAdminClient()

  const [
    { data: rawSuppliers },
    { data: rawCustomers },
    { data: rawLots },
  ] = await Promise.all([
    admin.from('suppliers').select('id, name').eq('tenant_id', tenantId),
    admin.from('tajir_customers').select('id, name').eq('tenant_id', tenantId),
    admin.from('inventory_lots').select('id, name, unit_of_measure').eq('tenant_id', tenantId),
  ])

  const supplierMap = new Map((rawSuppliers ?? []).map(s => [s.id, s.name]))
  const customerMap = new Map((rawCustomers ?? []).map(c => [c.id, c.name]))
  const lotMap      = new Map((rawLots      ?? []).map(l => [l.id, l.name]))
  const uomMap      = new Map((rawLots      ?? []).map(l => [l.id, l.unit_of_measure ?? null]))

  let rows: { id: string; date: string; partyName: string; stockItemName: string; uom: string | null; orderQty: number; received: number; balance: number }[] = []

  if (tab === 'purchase') {
    const [{ data: orders }, { data: gpItems }] = await Promise.all([
      admin.from('purchase_orders')
        .select('id, date, quantity, supplier_id, stock_item_id')
        .eq('tenant_id', tenantId)
        .order('date', { ascending: false }),
      admin.from('gatepass_items')
        .select('purchase_order_id, quantity')
        .not('purchase_order_id', 'is', null),
    ])

    const receivedMap = new Map<string, number>()
    for (const r of gpItems ?? []) {
      if (r.purchase_order_id)
        receivedMap.set(r.purchase_order_id, (receivedMap.get(r.purchase_order_id) ?? 0) + Number(r.quantity ?? 0))
    }

    rows = (orders ?? [])
      .map(o => ({
        id:            o.id,
        date:          o.date,
        partyName:     supplierMap.get(o.supplier_id) ?? '—',
        stockItemName: lotMap.get(o.stock_item_id) ?? '—',
        uom:           uomMap.get(o.stock_item_id) ?? null,
        orderQty:      Number(o.quantity),
        received:      receivedMap.get(o.id) ?? 0,
        balance:       Number(o.quantity) - (receivedMap.get(o.id) ?? 0),
      }))
      .filter(o => o.balance > 0)

  } else {
    const [{ data: orders }, { data: gpItems }] = await Promise.all([
      admin.from('sales_orders')
        .select('id, date, quantity, customer_id, stock_item_id')
        .eq('tenant_id', tenantId)
        .order('date', { ascending: false }),
      admin.from('gatepass_items')
        .select('sales_order_id, quantity')
        .not('sales_order_id', 'is', null),
    ])

    const dispatchedMap = new Map<string, number>()
    for (const r of gpItems ?? []) {
      if (r.sales_order_id)
        dispatchedMap.set(r.sales_order_id, (dispatchedMap.get(r.sales_order_id) ?? 0) + Number(r.quantity ?? 0))
    }

    rows = (orders ?? [])
      .map(o => ({
        id:            o.id,
        date:          o.date,
        partyName:     customerMap.get(o.customer_id) ?? '—',
        stockItemName: lotMap.get(o.stock_item_id) ?? '—',
        uom:           uomMap.get(o.stock_item_id) ?? null,
        orderQty:      Number(o.quantity),
        received:      dispatchedMap.get(o.id) ?? 0,
        balance:       Number(o.quantity) - (dispatchedMap.get(o.id) ?? 0),
      }))
      .filter(o => o.balance > 0)
  }

  const totalOrderQty  = rows.reduce((s, r) => s + r.orderQty, 0)
  const totalReceived  = rows.reduce((s, r) => s + r.received, 0)
  const totalBalance   = rows.reduce((s, r) => s + r.balance, 0)

  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 3 })

  const tabs = [
    { label: 'Purchase Pending', href: '/reports/pending-balance?type=purchase', active: tab === 'purchase' },
    { label: 'Sale Pending',     href: '/reports/pending-balance?type=sale',     active: tab === 'sale' },
  ]

  const partyLabel    = tab === 'purchase' ? 'Supplier' : 'Customer'
  const receivedLabel = tab === 'purchase' ? 'Received' : 'Dispatched'

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <Link href="/reports" className="text-sm text-muted-foreground hover:text-foreground">← Reports</Link>
        <h1 className="text-2xl font-extrabold tracking-tight mt-1">Pending Balance</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Orders not yet fully {tab === 'purchase' ? 'received' : 'dispatched'} via gatepass.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b">
        {tabs.map(t => (
          <Link key={t.label} href={t.href}>
            <span className={`inline-block px-4 py-2 text-sm font-medium rounded-t-md cursor-pointer transition-colors
              ${t.active ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              {t.label}
            </span>
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed py-16 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">
            All {tab} orders have been fully {tab === 'purchase' ? 'received' : 'dispatched'}.
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{partyLabel}</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Stock Item</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Order Qty</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{receivedLabel}</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Pending Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-secondary/50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">{formatPKTDate(new Date(r.date))}</td>
                    <td className="px-4 py-3 font-medium">{r.partyName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.stockItemName}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmt(r.orderQty)}{r.uom && <span className="ml-1 text-muted-foreground text-xs">{r.uom}</span>}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{r.received > 0 ? <>{fmt(r.received)}{r.uom && <span className="ml-1 text-xs">{r.uom}</span>}</> : '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-amber-600 dark:text-amber-400">{fmt(r.balance)}{r.uom && <span className="ml-1 text-xs font-normal">{r.uom}</span>}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 bg-muted/30">
                <tr>
                  <td colSpan={3} className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Total ({rows.length} order{rows.length !== 1 ? 's' : ''})
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-bold">{fmt(totalOrderQty)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-bold text-muted-foreground">{fmt(totalReceived)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-bold text-amber-600 dark:text-amber-400">{fmt(totalBalance)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

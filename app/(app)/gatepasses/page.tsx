import Link from 'next/link'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'
import { formatPKTDate } from '@/lib/utils/dates'
import { Pencil } from 'lucide-react'

export default async function GatepassesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const { type } = await searchParams
  const typeFilter = type === 'purchase' || type === 'sale' ? type : undefined

  const { tenantId } = await requireAuth()
  const admin = createAdminClient()

  let query = admin
    .from('gatepasses')
    .select('id, gatepass_number, type, date, vehicle_number, driver_name, remarks')
    .eq('tenant_id', tenantId)
    .order('date', { ascending: false })
    .limit(200)

  if (typeFilter) query = query.eq('type', typeFilter)

  const { data: rawGatepasses } = await query
  const gatepasses = rawGatepasses ?? []
  const gpIds      = gatepasses.map(g => g.id)

  /* Item count + total qty + party resolution per gatepass */
  const itemCountMap = new Map<string, number>()
  const totalQtyMap  = new Map<string, number>()
  const partyMap     = new Map<string, string>() // gatepass_id → party name(s)

  if (gpIds.length > 0) {
    const { data: itemRows } = await admin
      .from('gatepass_items')
      .select('gatepass_id, quantity, purchase_order_id, sales_order_id')
      .in('gatepass_id', gpIds)

    const purchaseOrderIds = [...new Set((itemRows ?? []).map(r => r.purchase_order_id).filter(Boolean))] as string[]
    const salesOrderIds    = [...new Set((itemRows ?? []).map(r => r.sales_order_id).filter(Boolean))]    as string[]

    const [
      { data: rawPOs },
      { data: rawSOs },
      { data: rawSuppliers },
      { data: rawCustomers },
    ] = await Promise.all([
      purchaseOrderIds.length > 0
        ? admin.from('purchase_orders').select('id, supplier_id').in('id', purchaseOrderIds)
        : Promise.resolve({ data: [] }),
      salesOrderIds.length > 0
        ? admin.from('sales_orders').select('id, customer_id').in('id', salesOrderIds)
        : Promise.resolve({ data: [] }),
      admin.from('suppliers').select('id, name').eq('tenant_id', tenantId),
      admin.from('tajir_customers').select('id, name').eq('tenant_id', tenantId),
    ])

    const supplierMap  = new Map((rawSuppliers  ?? []).map(s => [s.id, s.name]))
    const customerMap  = new Map((rawCustomers  ?? []).map(c => [c.id, c.name]))
    const poPartyMap   = new Map((rawPOs        ?? []).map(o => [o.id, supplierMap.get(o.supplier_id) ?? '']))
    const soPartyMap   = new Map((rawSOs        ?? []).map(o => [o.id, customerMap.get(o.customer_id) ?? '']))

    for (const r of itemRows ?? []) {
      itemCountMap.set(r.gatepass_id, (itemCountMap.get(r.gatepass_id) ?? 0) + 1)
      totalQtyMap.set(r.gatepass_id, (totalQtyMap.get(r.gatepass_id) ?? 0) + Number(r.quantity ?? 0))

      const partyName = r.purchase_order_id
        ? poPartyMap.get(r.purchase_order_id)
        : r.sales_order_id
          ? soPartyMap.get(r.sales_order_id)
          : undefined

      if (partyName) {
        const existing = partyMap.get(r.gatepass_id)
        if (!existing) {
          partyMap.set(r.gatepass_id, partyName)
        } else if (!existing.includes(partyName)) {
          partyMap.set(r.gatepass_id, existing + ', ' + partyName)
        }
      }
    }
  }

  const tabs = [
    { label: 'All',      href: '/gatepasses',                active: !typeFilter },
    { label: 'Purchase', href: '/gatepasses?type=purchase',  active: typeFilter === 'purchase' },
    { label: 'Sale',     href: '/gatepasses?type=sale',      active: typeFilter === 'sale' },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Gatepasses</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {gatepasses.length} record{gatepasses.length !== 1 ? 's' : ''}
            {typeFilter ? ` · ${typeFilter}` : ''}
          </p>
        </div>
        <Link href="/gatepasses/new">
          <Button className="min-h-[44px]">New Gatepass</Button>
        </Link>
      </div>

      {/* Type tabs */}
      <div className="flex gap-1 mb-5 border-b">
        {tabs.map(t => (
          <Link key={t.label} href={t.href}>
            <span className={`inline-block px-4 py-2 text-sm font-medium rounded-t-md transition-colors cursor-pointer
              ${t.active
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
              }`}>
              {t.label}
            </span>
          </Link>
        ))}
      </div>

      {gatepasses.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed py-16 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">
            No {typeFilter ?? ''} gatepasses found.
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">GP No.</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Type</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Party</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Items</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total Qty</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Vehicle</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Driver</th>
                  <th className="px-4 py-3 w-28" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {gatepasses.map((g) => (
                  <tr key={g.id} className="hover:bg-secondary/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold">{g.gatepass_number || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatPKTDate(new Date(g.date))}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        g.type === 'purchase'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      }`}>
                        {g.type === 'purchase' ? 'Purchase' : 'Sale'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium max-w-[160px] truncate" title={partyMap.get(g.id) ?? '—'}>
                      {partyMap.get(g.id) ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">{itemCountMap.get(g.id) ?? 0}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">
                      {(totalQtyMap.get(g.id) ?? 0).toLocaleString(undefined, { maximumFractionDigits: 3 })}
                    </td>
                    <td className="px-4 py-3">{g.vehicle_number ?? '—'}</td>
                    <td className="px-4 py-3">{g.driver_name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Link href={`/gatepasses/${g.id}/edit`}>
                          <Button variant="ghost" size="sm" className="min-h-[36px]">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Link href={`/gatepasses/${g.id}/print`}>
                          <Button variant="ghost" size="sm" className="min-h-[36px]">Print</Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

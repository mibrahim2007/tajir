import Link from 'next/link'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { PageHeader } from '@/components/page-header'
import { TableCard, Th, Td, EmptyState } from '@/components/table-card'
import { Button } from '@/components/ui/button'

type LocationStock = {
  locationId:   string
  locationName: string
  itemId:       string
  itemName:     string
  quantity:     number
}

export default async function LocationStockPage() {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()

  const [
    { data: locs },
    { data: items },
    { data: purchases },
    { data: sales },
    { data: saleReturns },
    { data: purchaseReturns },
    { data: transfersIn },
    { data: transfersOut },
  ] = await Promise.all([
    admin.from('locations').select('id, name').eq('tenant_id', tenantId).order('name'),
    admin.from('inventory_lots').select('id, name').eq('tenant_id', tenantId).order('name'),
    admin.from('purchase_orders').select('location_id, stock_item_id, quantity').eq('tenant_id', tenantId).not('location_id', 'is', null),
    admin.from('sales_orders').select('location_id, stock_item_id, quantity').eq('tenant_id', tenantId).not('location_id', 'is', null),
    admin.from('sale_returns').select('location_id, stock_item_id, quantity').eq('tenant_id', tenantId).not('location_id', 'is', null),
    admin.from('purchase_returns').select('location_id, stock_item_id, quantity').eq('tenant_id', tenantId).not('location_id', 'is', null),
    admin.from('stock_transfers').select('to_location_id, stock_item_id, quantity').eq('tenant_id', tenantId),
    admin.from('stock_transfers').select('from_location_id, stock_item_id, quantity').eq('tenant_id', tenantId),
  ])

  const parse = (v: unknown) => parseFloat((v as string) || '0') || 0

  const stockMap = new Map<string, Map<string, number>>()

  const ensureEntry = (locId: string, itemId: string) => {
    if (!stockMap.has(locId)) stockMap.set(locId, new Map())
    if (!stockMap.get(locId)!.has(itemId)) stockMap.get(locId)!.set(itemId, 0)
  }

  const add = (locId: string | null | undefined, itemId: string | null | undefined, delta: number) => {
    if (!locId || !itemId) return
    ensureEntry(locId, itemId)
    stockMap.get(locId)!.set(itemId, stockMap.get(locId)!.get(itemId)! + delta)
  }

  ;(purchases      ?? []).forEach(r => add(r.location_id,      r.stock_item_id,  parse(r.quantity)))
  ;(sales          ?? []).forEach(r => add(r.location_id,      r.stock_item_id, -parse(r.quantity)))
  ;(saleReturns    ?? []).forEach(r => add(r.location_id,      r.stock_item_id,  parse(r.quantity)))
  ;(purchaseReturns ?? []).forEach(r => add(r.location_id,     r.stock_item_id, -parse(r.quantity)))
  ;(transfersIn    ?? []).forEach(r => add(r.to_location_id,   r.stock_item_id,  parse(r.quantity)))
  ;(transfersOut   ?? []).forEach(r => add(r.from_location_id, r.stock_item_id, -parse(r.quantity)))

  const itemMap = new Map((items ?? []).map(i => [i.id, i.name]))
  const locMap  = new Map((locs  ?? []).map(l => [l.id, l.name]))

  const rows: LocationStock[] = []
  for (const [locId, itemQtys] of stockMap.entries()) {
    for (const [itemId, qty] of itemQtys.entries()) {
      if (qty !== 0) {
        rows.push({
          locationId:   locId,
          locationName: locMap.get(locId) ?? locId,
          itemId,
          itemName:     itemMap.get(itemId) ?? itemId,
          quantity:     qty,
        })
      }
    }
  }
  rows.sort((a, b) => a.locationName.localeCompare(b.locationName) || a.itemName.localeCompare(b.itemName))

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Location-wise Stock"
        subtitle="Stock balances per warehouse / location"
        action={
          <Link href="/stock-transfers/new">
            <Button size="sm" className="min-h-[36px]">Transfer Stock</Button>
          </Link>
        }
      />
      <TableCard>
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <Th>Location</Th>
              <Th>Item</Th>
              <Th right>Quantity</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3}>
                  <EmptyState message="No location-assigned stock yet. Tag purchases or sales with a location." />
                </td>
              </tr>
            ) : rows.map((r) => (
              <tr key={`${r.locationId}-${r.itemId}`} className="hover:bg-secondary/50 transition-colors">
                <Td strong>{r.locationName}</Td>
                <Td>{r.itemName}</Td>
                <Td right mono className={r.quantity < 0 ? 'text-destructive' : ''}>
                  {r.quantity.toLocaleString('en-PK', { maximumFractionDigits: 3 })}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
    </div>
  )
}

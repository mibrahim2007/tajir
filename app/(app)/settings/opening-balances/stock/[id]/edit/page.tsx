import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { StockOpeningForm } from '../../../stock-opening-form'
import type { OpeningLot } from '../../../stock-balance-table'

export default async function EditStockOpeningPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tenantId, role } = await requireAuth()
  if (role !== 'owner') {
    return <div className="p-6"><p className="text-muted-foreground">Access denied.</p></div>
  }

  const admin = createAdminClient()
  const [{ data: rawLot }, { data: rawLocations }, { data: rawOpeningStock }] = await Promise.all([
    admin.from('inventory_lots').select('id, name').eq('id', id).eq('tenant_id', tenantId).maybeSingle(),
    admin.from('locations').select('id, name').eq('tenant_id', tenantId),
    admin.from('stock_opening_balances').select('location_id, quantity, rate').eq('tenant_id', tenantId).eq('stock_item_id', id),
  ])

  if (!rawLot) notFound()

  const locations = (rawLocations ?? []).map((l) => ({ id: l.id, name: l.name }))
  const locationNames = new Map(locations.map((l) => [l.id, l.name]))
  const num = (v: unknown) => parseFloat(String(v ?? '0')) || 0

  // Opening stock is per (item, location) — one line per warehouse.
  const lot: OpeningLot = {
    id: rawLot.id,
    name: rawLot.name,
    lines: (rawOpeningStock ?? [])
      .map((row) => ({
        locationId:   row.location_id,
        locationName: locationNames.get(row.location_id) ?? '—',
        quantity:     num(row.quantity),
        rate:         num(row.rate),
      }))
      .sort((a, b) => a.locationName.localeCompare(b.locationName)),
  }

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Opening Stock — {lot.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          List every warehouse that held this item on day one. Add a line per location; the quantities are loaded at all of them together.
        </p>
      </div>
      <StockOpeningForm lot={lot} locations={locations} />
    </div>
  )
}

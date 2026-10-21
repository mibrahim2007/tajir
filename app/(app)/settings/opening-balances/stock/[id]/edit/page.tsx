import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadProfilesFor, profileOf } from '@/lib/inventory/item-profiles'
import { StockOpeningForm } from '../../../stock-opening-form'
import type { OpeningLot } from '../../../stock-balance-table'

export default async function EditStockOpeningPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tenantId, role } = await requireAuth()
  if (role !== 'owner') {
    return <div className="p-6"><p className="text-muted-foreground">Access denied.</p></div>
  }

  const admin = createAdminClient()
  const [{ data: rawLot }, { data: rawLocations }, { data: rawOpeningStock }, { data: rawGrades }, profiles] = await Promise.all([
    admin.from('inventory_lots').select('id, name').eq('id', id).eq('tenant_id', tenantId).maybeSingle(),
    admin.from('locations').select('id, name').eq('tenant_id', tenantId),
    admin.from('stock_opening_balances')
      .select('location_id, quantity, rate, grade_id, lot_no, nos_carton, weight_per_carton')
      .eq('tenant_id', tenantId).eq('stock_item_id', id),
    admin.from('grades').select('id, name').eq('tenant_id', tenantId).order('sort_order').order('name'),
    loadProfilesFor(admin, tenantId, [id]),
  ])

  if (!rawLot) notFound()

  const locations = (rawLocations ?? []).map((l) => ({ id: l.id, name: l.name }))
  const locationNames = new Map(locations.map((l) => [l.id, l.name]))
  const grades = rawGrades ?? []
  const gradeNames = new Map(grades.map((g) => [g.id, g.name]))
  const num = (v: unknown) => parseFloat(String(v ?? '0')) || 0

  // Opening stock is per (item, location, grade, lot).
  const lot: OpeningLot = {
    id: rawLot.id,
    name: rawLot.name,
    lines: (rawOpeningStock ?? [])
      .map((row) => ({
        locationId:      row.location_id,
        locationName:    locationNames.get(row.location_id) ?? '—',
        quantity:        num(row.quantity),
        rate:            num(row.rate),
        gradeId:         row.grade_id,
        gradeName:       row.grade_id ? gradeNames.get(row.grade_id) ?? null : null,
        lotNo:           row.lot_no,
        nosCarton:       row.nos_carton == null ? null : num(row.nos_carton),
        weightPerCarton: row.weight_per_carton == null ? null : num(row.weight_per_carton),
      }))
      .sort((a, b) => a.locationName.localeCompare(b.locationName) || (a.lotNo ?? '').localeCompare(b.lotNo ?? '')),
  }

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Opening Stock — {lot.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          List every warehouse that held this item on day one — one line per location, and per grade / lot where the item tracks them.
        </p>
      </div>
      <StockOpeningForm lot={lot} locations={locations} grades={grades} profile={profileOf(profiles, id)} />
    </div>
  )
}

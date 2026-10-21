import type { SupabaseClient } from '@supabase/supabase-js'
import type { PositionShortfall } from './line-tracking'

const fmt = (n: number) => n.toLocaleString('en-PK', { maximumFractionDigits: 3 })

// "Not enough stock: Polyester 150/144 · AA-Even · lot PI-2026-0012/1 at New
// Godown — 1,200 available, 1,500 requested." One clause per shortfall.
export async function describeShortfalls(
  admin: SupabaseClient,
  tenantId: string,
  shortfalls: PositionShortfall[],
): Promise<string> {
  const itemIds = [...new Set(shortfalls.map((s) => s.stockItemId))]
  const gradeIds = [...new Set(shortfalls.map((s) => s.gradeId).filter(Boolean) as string[])]
  const locationIds = [...new Set(shortfalls.map((s) => s.locationId))]
  const [{ data: items }, { data: grades }, { data: locations }] = await Promise.all([
    admin.from('inventory_lots').select('id, name').eq('tenant_id', tenantId).in('id', itemIds),
    gradeIds.length
      ? admin.from('grades').select('id, name').eq('tenant_id', tenantId).in('id', gradeIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    admin.from('locations').select('id, name').eq('tenant_id', tenantId).in('id', locationIds),
  ])
  const name = (rows: { id: string; name: string }[] | null, id: string | null) =>
    (id && rows?.find((r) => r.id === id)?.name) || null

  const parts = shortfalls.map((s) => {
    const what = [name(items, s.stockItemId) ?? 'Item', name(grades, s.gradeId), s.lotNo ? `lot ${s.lotNo}` : null]
      .filter(Boolean).join(' · ')
    const where = name(locations, s.locationId)
    return `${what}${where ? ` at ${where}` : ''} — ${fmt(s.available)} available, ${fmt(s.requested)} requested`
  })
  return `Not enough stock: ${parts.join('; ')}.`
}

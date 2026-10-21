import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeFormula, tracksGradeLot, type ItemFormula } from '@/lib/item-formula'

// Defaults for an item's lines. Since 0074 the rate basis is chosen on each
// line; this only supplies what a NEW line starts with: the basis last used on
// that item's purchase / sale lines, else its item type's stored formula, else
// Qty × Rate. Grade / lot are tracked whenever the basis is not Qty × Rate.
export type ItemProfile = {
  /** Default rate basis for a new line of this item. */
  formula:       ItemFormula
  stockUnit:     string | null
  packUnit:      string | null
  stdPackWeight: number | null
  /** Grade / lot are required at this basis (0072 / 0074). */
  trackGrade:    boolean
  trackLot:      boolean
}

export const STANDARD_PROFILE: ItemProfile = { formula: 'standard', stockUnit: null, packUnit: null, stdPackWeight: null, trackGrade: false, trackLot: false }

type TypeRow = {
  formula: string | null; stock_unit: string | null; pack_unit: string | null; std_pack_weight: number | string | null
}

function toProfile(t: TypeRow | null | undefined, lastBasis?: string | null): ItemProfile {
  const formula = normalizeFormula(lastBasis ?? t?.formula)
  return {
    formula,
    stockUnit:     t?.stock_unit ?? null,
    packUnit:      t?.pack_unit ?? null,
    stdPackWeight: t?.std_pack_weight == null ? null : Number(t.std_pack_weight),
    trackGrade:    tracksGradeLot(formula),
    trackLot:      tracksGradeLot(formula),
  }
}

// The profile for a given basis: grade / lot follow the basis, units follow the item.
export function profileAt(profile: ItemProfile, basis: ItemFormula): ItemProfile {
  return { ...profile, formula: basis, trackGrade: tracksGradeLot(basis), trackLot: tracksGradeLot(basis) }
}

const TYPE_COLS = 'formula, stock_unit, pack_unit, std_pack_weight'

// Most recent rate basis per item, from its purchase and sale lines.
async function lastBasisByItem(admin: SupabaseClient, tenantId: string, ids?: string[]): Promise<Map<string, string>> {
  const pick = (table: 'purchase_orders' | 'sales_orders') => {
    let q = admin.from(table).select('stock_item_id, rate_basis, created_at').eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }).limit(5000)
    if (ids) q = q.in('stock_item_id', ids)
    return q
  }
  const [{ data: p }, { data: s }] = await Promise.all([pick('purchase_orders'), pick('sales_orders')])
  const rows = [...(p ?? []), ...(s ?? [])] as { stock_item_id: string; rate_basis: string | null; created_at: string }[]
  rows.sort((a, b) => b.created_at.localeCompare(a.created_at))
  const map = new Map<string, string>()
  for (const r of rows) if (r.rate_basis && !map.has(r.stock_item_id)) map.set(r.stock_item_id, r.rate_basis)
  return map
}

async function load(admin: SupabaseClient, tenantId: string, ids?: string[]): Promise<Map<string, ItemProfile>> {
  let q = admin.from('inventory_lots').select(`id, item_types(${TYPE_COLS})`).eq('tenant_id', tenantId)
  if (ids) q = q.in('id', ids)
  const [{ data }, last] = await Promise.all([q, lastBasisByItem(admin, tenantId, ids)])
  const map = new Map<string, ItemProfile>()
  for (const row of (data ?? []) as { id: string; item_types: TypeRow | TypeRow[] | null }[]) {
    const t = Array.isArray(row.item_types) ? row.item_types[0] : row.item_types
    map.set(row.id, toProfile(t, last.get(row.id)))
  }
  return map
}

// Profile of every stock item of the tenant, keyed by inventory-lot id. Used by
// the trading-form loaders.
export async function loadItemProfiles(admin: SupabaseClient, tenantId: string): Promise<Map<string, ItemProfile>> {
  return load(admin, tenantId)
}

// Profiles for just the given items (units and defaults; the line's own
// rate basis decides the maths).
export async function loadProfilesFor(
  admin: SupabaseClient,
  tenantId: string,
  lotIds: string[],
): Promise<Map<string, ItemProfile>> {
  const ids = [...new Set(lotIds.filter(Boolean))]
  if (ids.length === 0) return new Map()
  return load(admin, tenantId, ids)
}

export function profileOf(map: Map<string, ItemProfile>, lotId: string | null | undefined): ItemProfile {
  return (lotId && map.get(lotId)) || STANDARD_PROFILE
}

// A line's effective profile: its own rate basis (0074), falling back to the
// item's default when the caller didn't send one.
export function lineProfileOf(
  map: Map<string, ItemProfile>,
  line: { stockItemId: string; rateBasis?: string | null },
): ItemProfile {
  const base = profileOf(map, line.stockItemId)
  return profileAt(base, line.rateBasis ? normalizeFormula(line.rateBasis) : base.formula)
}

import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeFormula, type ItemFormula } from '@/lib/item-formula'

// How an item's trading lines behave, taken from its Item Type (migration 0071).
export type ItemProfile = {
  formula:       ItemFormula
  stockUnit:     string | null
  packUnit:      string | null
  stdPackWeight: number | null
  /** Lines must carry a grade (0072). */
  trackGrade:    boolean
  /** Lines carry a lot number; purchases get one generated when left blank. */
  trackLot:      boolean
}

export const STANDARD_PROFILE: ItemProfile = { formula: 'standard', stockUnit: null, packUnit: null, stdPackWeight: null, trackGrade: false, trackLot: false }

type TypeRow = {
  formula: string | null; stock_unit: string | null; pack_unit: string | null; std_pack_weight: number | string | null
  track_grade: boolean | null; track_lot: boolean | null
}

function toProfile(t: TypeRow | null | undefined): ItemProfile {
  if (!t) return STANDARD_PROFILE
  return {
    formula:       normalizeFormula(t.formula),
    stockUnit:     t.stock_unit,
    packUnit:      t.pack_unit,
    stdPackWeight: t.std_pack_weight == null ? null : Number(t.std_pack_weight),
    trackGrade:    !!t.track_grade,
    trackLot:      !!t.track_lot,
  }
}

const TYPE_COLS = 'formula, stock_unit, pack_unit, std_pack_weight, track_grade, track_lot'

// Profile of every stock item of the tenant, keyed by inventory-lot id. Used by
// the trading-form loaders.
export async function loadItemProfiles(admin: SupabaseClient, tenantId: string): Promise<Map<string, ItemProfile>> {
  const { data } = await admin
    .from('inventory_lots')
    .select(`id, item_types(${TYPE_COLS})`)
    .eq('tenant_id', tenantId)
  const map = new Map<string, ItemProfile>()
  for (const row of (data ?? []) as { id: string; item_types: TypeRow | TypeRow[] | null }[]) {
    const t = Array.isArray(row.item_types) ? row.item_types[0] : row.item_types
    map.set(row.id, toProfile(t))
  }
  return map
}

// Profiles for just the given items. Used by the server actions, which must
// recompute amounts from the type rather than trust the client.
export async function loadProfilesFor(
  admin: SupabaseClient,
  tenantId: string,
  lotIds: string[],
): Promise<Map<string, ItemProfile>> {
  const ids = [...new Set(lotIds.filter(Boolean))]
  const map = new Map<string, ItemProfile>()
  if (ids.length === 0) return map
  const { data } = await admin
    .from('inventory_lots')
    .select(`id, item_types(${TYPE_COLS})`)
    .eq('tenant_id', tenantId)
    .in('id', ids)
  for (const row of (data ?? []) as { id: string; item_types: TypeRow | TypeRow[] | null }[]) {
    const t = Array.isArray(row.item_types) ? row.item_types[0] : row.item_types
    map.set(row.id, toProfile(t))
  }
  return map
}

export function profileOf(map: Map<string, ItemProfile>, lotId: string | null | undefined): ItemProfile {
  return (lotId && map.get(lotId)) || STANDARD_PROFILE
}

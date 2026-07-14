import type { SupabaseClient } from '@supabase/supabase-js'

// Returns the set of inventory-lot ids whose Item Type is named "Yarn" (the
// items that expose the per-line yarn fields). Used by the trading-form loaders.
export async function loadYarnLotIds(admin: SupabaseClient, tenantId: string): Promise<Set<string>> {
  const { data: yarnTypes } = await admin
    .from('item_types').select('id').eq('tenant_id', tenantId).ilike('name', 'yarn')
  const typeIds = (yarnTypes ?? []).map((t) => t.id)
  if (typeIds.length === 0) return new Set()

  const { data: lots } = await admin
    .from('inventory_lots').select('id').eq('tenant_id', tenantId).in('item_type_id', typeIds)
  return new Set((lots ?? []).map((l) => l.id))
}

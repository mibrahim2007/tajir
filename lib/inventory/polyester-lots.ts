import type { SupabaseClient } from '@supabase/supabase-js'

// Returns the set of inventory-lot ids whose Item Type name contains "Polyester"
// (the items that expose the per-line Nos_Carton / Weight / QTY LBS fields).
// Used by the trading-form loaders and server actions.
export async function loadPolyesterLotIds(admin: SupabaseClient, tenantId: string): Promise<Set<string>> {
  // Match "polyester" or the common "ployester" misspelling (either spelling works).
  const { data: polyTypes } = await admin
    .from('item_types').select('id').eq('tenant_id', tenantId)
    .or('name.ilike.%polyester%,name.ilike.%ployester%')
  const typeIds = (polyTypes ?? []).map((t) => t.id)
  if (typeIds.length === 0) return new Set()

  const { data: lots } = await admin
    .from('inventory_lots').select('id').eq('tenant_id', tenantId).in('item_type_id', typeIds)
  return new Set((lots ?? []).map((l) => l.id))
}

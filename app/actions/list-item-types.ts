'use server'

import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeFormula } from '@/lib/item-formula'
import type { ItemProfile } from '@/lib/inventory/item-profiles'
import type { ActionResult } from '@/lib/types'

export type ItemTypeWithProfile = { id: string; name: string; parentId: string | null; profile: ItemProfile }

// The tenant's item types with their formula profile. Used by the quick
// "New Stock Item" form inside the trading screens, which has no page loader.
export async function listItemTypesAction(): Promise<ActionResult<ItemTypeWithProfile[]>> {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('item_types')
    .select('id, name, parent_id, formula, stock_unit, pack_unit, std_pack_weight, track_grade, track_lot')
    .eq('tenant_id', tenantId)
    .order('name')
  if (error) return { success: false, error: 'Failed to load item types', code: 'INTERNAL_ERROR' }
  return {
    success: true,
    data: (data ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      parentId: t.parent_id,
      profile: {
        formula:       normalizeFormula(t.formula),
        stockUnit:     t.stock_unit,
        packUnit:      t.pack_unit,
        stdPackWeight: t.std_pack_weight == null ? null : Number(t.std_pack_weight),
        trackGrade:    t.track_grade,
        trackLot:      t.track_lot,
      },
    })),
  }
}

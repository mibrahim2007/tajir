'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult } from '@/lib/types'
import { suggestFormula, FORMULA_DEFAULTS } from '@/lib/item-formula'

const schema = z.object({ name: z.string().min(1, 'Name is required').max(100) })

// Find-or-create an item type for the current tenant. Used by the "create items
// by type" flow: picking a generic preset (Yarn, Fabric, …) or typing a custom
// category resolves to a concrete item_types row without the user having to
// pre-define it under Settings → Item Types.
export async function ensureItemTypeAction(
  input: unknown,
): Promise<ActionResult<{ id: string; name: string }>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const name = parsed.data.name.trim()
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()

  // Case-insensitive lookup first so "yarn" and "Yarn" don't create duplicates.
  const { data: existing } = await admin
    .from('item_types')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .ilike('name', name)
    .limit(1)
    .maybeSingle()

  if (existing) return { success: true, data: existing }

  // A new type starts on the formula its name suggests (Yarn → yarn,
  // "…Polyester…" → per lb, else Qty × Rate); the owner can change it under
  // Item Types until its items are traded.
  const formula = suggestFormula(name)
  const { data, error } = await admin
    .from('item_types')
    .insert({ tenant_id: tenantId, name, formula, stock_unit: FORMULA_DEFAULTS[formula].stockUnit, pack_unit: FORMULA_DEFAULTS[formula].packUnit })
    .select('id, name')
    .single()

  if (error || !data) {
    // Lost a race with a concurrent insert — fetch the winner.
    if (error?.code === '23505') {
      const { data: raced } = await admin
        .from('item_types')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .ilike('name', name)
        .limit(1)
        .maybeSingle()
      if (raced) return { success: true, data: raced }
    }
    return { success: false, error: 'Failed to create item type', code: 'INTERNAL_ERROR' }
  }

  return { success: true, data }
}

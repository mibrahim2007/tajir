'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeProfitAndLoss } from '@/lib/reports/profit-loss'
import { allocateProfit, sharesAreComplete, totalShare, type OwnerShare } from '@/lib/owners/allocation'
import { round2 } from '@/lib/loans/amortization'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid start date'),
  periodEnd:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid end date'),
})

export type AllocationPreview = {
  netProfit: number
  totalSharePct: number
  sharesComplete: boolean
  rows: { ownerId: string; name: string; sharePct: number; amount: number }[]
  /** Expense accounts outside codes 5/6/7, which net profit silently excludes. */
  unclassified: { code: string; name: string; amount: number }[]
}

// Read-only companion to createProfitAllocationAction: computes the same net
// profit and split so the form can show exactly what will post, without
// writing anything.
export async function previewProfitAllocationAction(input: unknown): Promise<ActionResult<AllocationPreview>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }

  const { periodStart, periodEnd } = parsed.data
  if (periodEnd < periodStart) {
    return { success: false, error: 'End date must be on or after the start date', code: 'VALIDATION_ERROR' }
  }

  const admin = createAdminClient()

  const { data: rawOwners } = await admin
    .from('owners')
    .select('id, name, profit_share_pct')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('created_at')

  const owners: OwnerShare[] = (rawOwners ?? []).map((o) => ({
    ownerId: o.id,
    name: o.name,
    sharePct: Number(o.profit_share_pct),
  }))

  const pl = await computeProfitAndLoss({ admin, tenantId, from: periodStart, to: periodEnd })
  const netProfit = round2(pl.netProfit)
  const complete = sharesAreComplete(owners)

  return {
    success: true,
    data: {
      netProfit,
      totalSharePct: totalShare(owners),
      sharesComplete: complete,
      // Only meaningful when shares are complete; otherwise the split would be
      // misleading, so send an empty list and let the UI show the warning.
      rows: complete ? allocateProfit(netProfit, owners) : [],
      unclassified: pl.unclassified,
    },
  }
}

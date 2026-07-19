'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { postJournalEntry } from '@/lib/accounting/post-journal-entry'
import { nextDocumentSerial } from '@/lib/serials/next-serial'
import { computeProfitAndLoss } from '@/lib/reports/profit-loss'
import { allocateProfit, sharesAreComplete, totalShare, type OwnerShare } from '@/lib/owners/allocation'
import { round2 } from '@/lib/loans/amortization'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid start date'),
  periodEnd:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid end date'),
  notes:       z.string().trim().optional(),
})

// Allocates a period's net profit (or loss) to owners by their share % (owner-only).
//   Profit: DR Retained Earnings (3200) / CR Owner's Capital (3100) per owner
//   Loss:   DR Owner's Capital (3100) per owner / CR Retained Earnings (3200)
//
// The net profit is NOT taken from the caller — it is recomputed server-side
// from the shared P&L helper, so the posted figure always matches the report
// and cannot be tampered with from the client.
export async function createProfitAllocationAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Only owners can allocate profit', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') {
    return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }
  }

  const { periodStart, periodEnd, notes } = parsed.data
  if (periodEnd < periodStart) {
    return { success: false, error: 'End date must be on or after the start date', code: 'VALIDATION_ERROR' }
  }

  const admin = createAdminClient()

  // Reject an overlapping period — allocating the same profit twice would
  // double-credit every partner's capital.
  const { data: overlapping } = await admin
    .from('profit_allocations')
    .select('id, serial_number, period_start, period_end')
    .eq('tenant_id', tenantId)
    .lte('period_start', periodEnd)
    .gte('period_end', periodStart)
    .limit(1)

  if (overlapping && overlapping.length > 0) {
    const o = overlapping[0]
    return {
      success: false,
      error: `Period overlaps an existing allocation (${o.serial_number ?? 'unnumbered'}: ${o.period_start} → ${o.period_end}). Delete it first to re-allocate.`,
      code: 'PERIOD_OVERLAP',
    }
  }

  // Active owners only — an inactive partner should not receive a new share.
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

  if (owners.length === 0) {
    return { success: false, error: 'No active owners to allocate to', code: 'NO_OWNERS' }
  }
  if (!sharesAreComplete(owners)) {
    return {
      success: false,
      error: `Active owners' profit shares total ${totalShare(owners).toFixed(2)}%, not 100%. Fix the shares before allocating.`,
      code: 'SHARES_INCOMPLETE',
    }
  }

  const pl = await computeProfitAndLoss({ admin, tenantId, from: periodStart, to: periodEnd })
  const netProfit = round2(pl.netProfit)

  if (Math.abs(netProfit) < 0.01) {
    return { success: false, error: 'Net profit for this period is zero — nothing to allocate', code: 'NOTHING_TO_ALLOCATE' }
  }

  const rows = allocateProfit(netProfit, owners)
  // Belt and braces: the allocation must reconstitute the net profit exactly.
  const allocatedTotal = round2(rows.reduce((s, r) => s + r.amount, 0))
  if (allocatedTotal !== netProfit) {
    return { success: false, error: 'Allocation did not balance — no changes were made', code: 'INTERNAL_ERROR' }
  }

  const serialNumber = await nextDocumentSerial(admin, tenantId, 'profit_allocation', periodEnd)

  const { data: alloc, error } = await admin
    .from('profit_allocations')
    .insert({
      tenant_id:     tenantId,
      serial_number: serialNumber,
      period_start:  periodStart,
      period_end:    periodEnd,
      net_profit:    netProfit,
      notes:         notes || null,
    })
    .select('id')
    .single()

  if (error || !alloc) {
    return { success: false, error: 'Failed to record allocation', code: 'INTERNAL_ERROR' }
  }

  const { error: linesError } = await admin.from('profit_allocation_lines').insert(
    rows.map((r) => ({
      tenant_id:     tenantId,
      allocation_id: alloc.id,
      owner_id:      r.ownerId,
      share_pct:     r.sharePct,
      amount:        r.amount,
    })),
  )
  if (linesError) {
    await admin.from('profit_allocations').delete().eq('id', alloc.id)
    return { success: false, error: 'Failed to save allocation lines', code: 'INTERNAL_ERROR' }
  }

  // GL. A profit credits each owner's capital against Retained Earnings; a loss
  // reverses both sides. Per-owner amounts can individually flip sign only if a
  // share were negative, which the owner schema forbids.
  const isProfit = netProfit > 0
  const ownerLines = rows.map((r) => ({
    accountSystemKey: 'owners_capital',
    description:      `${r.name} — ${r.sharePct}%`,
    debit:            isProfit ? 0 : Math.abs(r.amount),
    credit:           isProfit ? r.amount : 0,
    ownerId:          r.ownerId,
  }))
  const retainedLine = {
    accountSystemKey: 'retained_earnings',
    debit:            isProfit ? netProfit : 0,
    credit:           isProfit ? 0 : Math.abs(netProfit),
  }

  const posted = await postJournalEntry({
    tenantId,
    date:        periodEnd,
    description: isProfit ? 'Profit Allocation to Owners' : 'Loss Allocation to Owners',
    reference:   serialNumber,
    sourceType:  'profit_allocation',
    sourceId:    alloc.id,
    prefix:      'PA',
    // The entry spans every owner, so naming one of them in the narration
    // would misdescribe it — the per-owner detail is on the lines instead.
    suppressPartyName: true,
    lines: isProfit ? [retainedLine, ...ownerLines] : [...ownerLines, retainedLine],
  })

  // Roll back rather than leave an allocation that never reached the ledger —
  // it would block the period from re-allocation while crediting nobody.
  if (!posted.ok) {
    await admin.from('profit_allocations').delete().eq('id', alloc.id)
    return { success: false, error: `Could not post to the ledger: ${posted.message}`, code: 'GL_POST_FAILED' }
  }

  await createAuditEntry({
    tenantId, userId: user.id, action: 'create', entity: 'profit_allocations', entityId: alloc.id,
    after: {
      periodStart, periodEnd, netProfit, serialNumber,
      lines: rows.map((r) => ({ ownerId: r.ownerId, name: r.name, sharePct: r.sharePct, amount: r.amount })),
    },
  })

  return { success: true, data: alloc }
}

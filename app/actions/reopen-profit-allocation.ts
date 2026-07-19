'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { postJournalEntry } from '@/lib/accounting/post-journal-entry'
import { round2 } from '@/lib/loans/amortization'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  id:     z.string().uuid(),
  reason: z.string().trim().max(300).optional(),
})

// Reopens the period covered by a profit allocation (owner-only).
//
// The original entry is NOT deleted — a posted allocation really did move each
// owner's capital, and erasing it would rewrite history. A mirror-image entry
// is posted instead, so the ledger shows both the allocation and its reversal
// and the two net to zero:
//
//   Original (profit): DR Retained Earnings / CR Owner's Capital (per owner)
//   Reversal:          DR Owner's Capital (per owner) / CR Retained Earnings
//
// The allocation is then marked `reversed`, which releases its claim on the
// period so it can be allocated again (e.g. after late entries changed the
// period's profit).
export async function reopenProfitAllocationAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Only owners can reopen a period', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { id, reason } = parsed.data
  const admin = createAdminClient()

  const { data: alloc } = await admin
    .from('profit_allocations')
    .select('id, serial_number, period_start, period_end, net_profit, status')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!alloc) return { success: false, error: 'Allocation not found', code: 'NOT_FOUND' }
  if (alloc.status === 'reversed') {
    return { success: false, error: 'This period has already been reopened', code: 'ALREADY_REVERSED' }
  }

  const { data: allocLines } = await admin
    .from('profit_allocation_lines')
    .select('owner_id, share_pct, amount')
    .eq('allocation_id', id)
    .eq('tenant_id', tenantId)

  if (!allocLines || allocLines.length === 0) {
    return { success: false, error: 'Allocation has no lines to reverse', code: 'INTERNAL_ERROR' }
  }

  const netProfit = round2(Number(alloc.net_profit))
  const isProfit = netProfit > 0

  // Mirror of the original: every debit becomes a credit and vice versa.
  const ownerLines = allocLines.map((l) => {
    const amount = round2(Number(l.amount))
    return {
      accountSystemKey: 'owners_capital',
      description:      `Reversal — ${Number(l.share_pct)}%`,
      debit:            isProfit ? amount : 0,
      credit:           isProfit ? 0 : Math.abs(amount),
      ownerId:          l.owner_id as string,
    }
  })
  const retainedLine = {
    accountSystemKey: 'retained_earnings',
    debit:            isProfit ? 0 : Math.abs(netProfit),
    credit:           isProfit ? netProfit : 0,
  }

  const posted = await postJournalEntry({
    tenantId,
    // Dated at period end, matching the entry it cancels, so the period nets to
    // zero rather than pushing a correction into a later period.
    date:        alloc.period_end as string,
    description: isProfit ? 'Profit Allocation Reversed' : 'Loss Allocation Reversed',
    reference:   alloc.serial_number,
    sourceType:  'profit_allocation_reversal',
    sourceId:    id,
    prefix:      'PA',
    // Spans every owner, so naming one of them would misdescribe the entry.
    suppressPartyName: true,
    lines: isProfit ? [...ownerLines, retainedLine] : [retainedLine, ...ownerLines],
  })

  if (!posted.ok) {
    return {
      success: false,
      error: `Could not post the reversal, so the period was not reopened: ${posted.message}`,
      code: 'GL_POST_FAILED',
    }
  }

  // Only mark it reversed once the reversing entry is safely on the ledger,
  // otherwise the period would be freed while its allocation still stands.
  const { error } = await admin
    .from('profit_allocations')
    .update({ status: 'reversed', reversed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) {
    await admin.from('tajir_journal_entries').delete()
      .eq('tenant_id', tenantId).eq('source_type', 'profit_allocation_reversal').eq('source_id', id)
    return { success: false, error: 'Failed to reopen the period', code: 'INTERNAL_ERROR' }
  }

  await createAuditEntry({
    tenantId, userId: user.id, action: 'update', entity: 'profit_allocations', entityId: id,
    before: { status: 'active' },
    after: {
      status: 'reversed', reason: reason || null,
      serialNumber: alloc.serial_number, periodStart: alloc.period_start,
      periodEnd: alloc.period_end, netProfit,
      reversalVoucher: posted.voucherNumber,
    },
  })

  return { success: true, data: undefined }
}

'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { postJournalEntry } from '@/lib/accounting/post-journal-entry'
import { checkPeriodOpen } from '@/lib/accounting/period-lock'
import { PDC_SOURCES, partyDimension, type PdcRegisterRow, type PdcSource } from '@/lib/pdc/sources'
import { findEndorsementDestination } from '@/lib/pdc/endorsement'
import { pdcAccount } from '@/lib/constants/tender-types'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  source:  z.enum(Object.keys(PDC_SOURCES) as [PdcSource, ...PdcSource[]]),
  lineId:  z.string().uuid(),
  outcome: z.enum(['cleared', 'bounced']),
  date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  /** Where the money actually landed / left. Ignored for a bounce. */
  moneyAccount: z.enum(['cash_at_bank', 'cash_in_hand']).default('cash_at_bank'),
  bankId:  z.string().uuid().optional().nullable(),
})

// Settles a post-dated cheque — the event that was previously impossible to
// record, which is why 1112 only ever grew.
//
// CLEARED — the cheque went through. The amount simply moves between 1112 and
// the real cash account, in the same direction as the original tender:
//     money in : DR Bank / CR 1112     (we finally hold the funds)
//     money out: DR 1112 / CR Bank     (the bank has finally paid it out)
//   Nothing touches the customer/supplier balance: that was already settled
//   when the cheque was accepted.
//
// BOUNCED — the cheque failed, so the original tender is undone and the
// underlying obligation comes back:
//     money in : DR Accounts Receivable / CR 1112   (they owe us again)
//     money out: DR 1112 / CR Accounts Payable      (we owe them again)
//   The counter-account varies by document type and comes from the register
//   view, and the party dimension is carried so the right subledger moves.
export async function settlePdcAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Only owners can settle cheques', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { source, lineId, outcome, date, moneyAccount, bankId } = parsed.data
  const admin = createAdminClient()

  const { data: row } = await admin
    .from('pdc_register')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('source', source)
    .eq('line_id', lineId)
    .maybeSingle()

  const cheque = row as PdcRegisterRow | null
  if (!cheque) return { success: false, error: 'Cheque not found', code: 'NOT_FOUND' }

  // An endorsed cheque was handed on to someone else, so it can still bounce —
  // but it can never clear into our bank, because it is not ours to bank.
  const wasEndorsed = cheque.pdc_status === 'endorsed'
  if (wasEndorsed && outcome === 'cleared') {
    return {
      success: false,
      error: 'This cheque was handed on, so it cannot clear into your account. It can only bounce.',
      code: 'VALIDATION_ERROR',
    }
  }
  if (cheque.pdc_status !== 'pending' && !wasEndorsed) {
    return {
      success: false,
      error: `This cheque is already marked ${cheque.pdc_status}.`,
      code: 'ALREADY_SETTLED',
    }
  }

  const locked = await checkPeriodOpen(tenantId, date, 'This settlement')
  if (locked) return locked

  const amount = Number(cheque.amount)
  const isIn = cheque.direction === 'in'
  const party = partyDimension(cheque)

  const label = PDC_SOURCES[source].label

  // An endorsed cheque bouncing is a different entry entirely. 1112 is already
  // flat for it — the receipt debited it, the payment that handed it on
  // credited it — so touching 1112 again would conjure a balance from nothing.
  // What actually failed is that BOTH settlements were undone: the party we
  // paid never got their money, and the party who gave us the cheque never
  // really paid us. So both subledgers come back and nothing else moves:
  //     DR Accounts Receivable (customer)  — they owe us again
  //     CR Accounts Payable    (supplier)  — we owe them again
  let lines: { accountSystemKey: string; debit: number; credit: number }[]
  let destinationNote = ''

  if (wasEndorsed) {
    const destination = await findEndorsementDestination(tenantId, { source, lineId })
    if (!destination) {
      return {
        success: false,
        error: 'This cheque is marked as handed on, but the document that took it no longer exists. Reverse that document instead.',
        code: 'NOT_FOUND',
      }
    }
    destinationNote = ` → ${destination.label}${destination.docSerial ? ` ${destination.docSerial}` : ''}`
    lines = [
      { accountSystemKey: cheque.counter_key,     debit: amount, credit: 0, ...party },
      { accountSystemKey: destination.counterKey, debit: 0, credit: amount, ...destination.party },
    ]
  } else {
    // Cleared swaps 1112 for real cash; bounced swaps it for the original
    // counter-account. Either way the 1112 leg is the mirror of the original.
    const otherKey = outcome === 'cleared' ? moneyAccount : cheque.counter_key
    // A cheque we received clears out of the asset account; one we issued
    // clears out of the liability. Its direction decides which.
    const pdcLeg = { accountSystemKey: pdcAccount(cheque.direction), debit: isIn ? 0 : amount, credit: isIn ? amount : 0 }
    const otherLeg = {
      accountSystemKey: otherKey,
      debit:  isIn ? amount : 0,
      credit: isIn ? 0 : amount,
      // Only the bounce touches a party subledger; a clearing is bank-to-1112.
      ...(outcome === 'bounced' ? party : {}),
    }
    lines = isIn ? [otherLeg, pdcLeg] : [pdcLeg, otherLeg]
  }
  const posted = await postJournalEntry({
    tenantId,
    date,
    description: outcome === 'cleared'
      ? `PDC Cleared — ${label}`
      : `PDC Bounced — ${label}${destinationNote}`,
    reference:  cheque.cheque_number ?? cheque.doc_serial,
    sourceType: outcome === 'cleared' ? 'pdc_cleared' : 'pdc_bounced',
    sourceId:   lineId,
    prefix:     'PDC',
    lines,
  })

  if (!posted.ok) {
    return { success: false, error: `Could not post to the ledger, so nothing was changed: ${posted.message}`, code: 'GL_POST_FAILED' }
  }

  // Only mark it settled once the entry is safely on the ledger, otherwise the
  // cheque would leave the pending list with no accounting behind it.
  const { error } = await admin
    .from(PDC_SOURCES[source].table)
    .update({
      pdc_status:      outcome,
      settled_at:      new Date().toISOString(),
      settled_bank_id: outcome === 'cleared' ? (bankId ?? cheque.bank_id) : null,
    })
    .eq('id', lineId)
    .eq('tenant_id', tenantId)
    // Guarded on the status we read, so two settlements racing the same cheque
    // cannot both post — the loser writes nothing.
    .eq('pdc_status', cheque.pdc_status)

  if (error) {
    await admin.from('tajir_journal_entries').delete()
      .eq('tenant_id', tenantId)
      .eq('source_type', outcome === 'cleared' ? 'pdc_cleared' : 'pdc_bounced')
      .eq('source_id', lineId)
    return { success: false, error: 'Failed to update the cheque', code: 'INTERNAL_ERROR' }
  }

  await createAuditEntry({
    tenantId, userId: user.id, action: 'update',
    entity: PDC_SOURCES[source].table, entityId: lineId,
    before: { pdcStatus: cheque.pdc_status },
    after: {
      pdcStatus: outcome, date, amount,
      chequeNumber: cheque.cheque_number, party: cheque.party_name,
      document: cheque.doc_serial, voucher: posted.voucherNumber,
    },
  })

  return { success: true, data: undefined }
}

'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { postJournalEntry } from '@/lib/accounting/post-journal-entry'
import { repostJournalEntry } from '@/lib/accounting/repost-journal-entry'
import { checkPeriodOpen } from '@/lib/accounting/period-lock'
import { pdcAccount } from '@/lib/constants/tender-types'
import type { ActionResult } from '@/lib/types'

// Loading the post-dated cheques that were already in hand (or already written)
// on the day the business started using Tajir.
//
// An opening cheque is an opening balance like any other, so the money leg is
// offset against Opening Balance Equity (3300) rather than the party:
//     received (in) : DR Post-Dated Cheques Received 1112 / CR 3300
//     issued  (out) : DR 3300 / CR Post-Dated Cheques Issued 2115
//
// IMPORTANT for whoever loads the data: the party's own opening balance must be
// entered NET of the cheques loaded here. A customer who owes 100 and has given
// a cheque for 40 is loaded as a 60 opening balance plus a 40 opening cheque —
// otherwise the 40 is counted twice. The UI says this too.
//
// Once created the cheque appears in `pdc_register` and is settled, endorsed
// and reported by exactly the same code as a cheque taken on a receipt. Only
// the bounce differs, and only because the register supplies the counter
// account: a bounce puts the amount back on the party's subledger, which is
// correct precisely because their opening balance was entered net of it.

const PARTY_KINDS = ['customer', 'supplier', 'employee', 'owner'] as const

const baseSchema = z.object({
  direction:     z.enum(['in', 'out']),
  chequeNumber:  z.string().trim().min(1, 'Cheque no. is required'),
  chequeDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date is required'),
  asOfDate:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  amount:        z.coerce.number().positive('Amount must be greater than 0'),
  partyKind:     z.enum(PARTY_KINDS).optional().nullable(),
  partyId:       z.string().uuid().optional().nullable(),
  partyLabel:    z.string().trim().optional().nullable(),
  bankId:        z.string().uuid().optional().nullable(),
})

const createSchema = baseSchema
const editSchema = baseSchema.extend({ id: z.string().uuid() })
const deleteSchema = z.object({ id: z.string().uuid() })

type Parsed = z.infer<typeof baseSchema>

const PARTY_TABLE = {
  customer: 'tajir_customers',
  supplier: 'suppliers',
  employee: 'employees',
  owner:    'owners',
} as const satisfies Record<(typeof PARTY_KINDS)[number], string>

/** DR/CR for the opening entry: the PDC account against Opening Balance Equity. */
function openingLines(direction: 'in' | 'out', amount: number) {
  const pdcLeg = { accountSystemKey: pdcAccount(direction), debit: direction === 'in' ? amount : 0, credit: direction === 'in' ? 0 : amount }
  const obeLeg = { accountSystemKey: 'opening_balance_equity', debit: direction === 'in' ? 0 : amount, credit: direction === 'in' ? amount : 0 }
  return direction === 'in' ? [pdcLeg, obeLeg] : [obeLeg, pdcLeg]
}

type AdminClient = ReturnType<typeof createAdminClient>

/**
 * Resolves the named party to a display name, and rejects a party id that does
 * not belong to this tenant — the id comes from the browser, and a foreign one
 * would put another tenant's customer on our register and on a bounce entry.
 */
async function resolveParty(
  admin: AdminClient,
  tenantId: string,
  input: Parsed,
): Promise<{ ok: true; name: string | null } | { ok: false; message: string }> {
  if (!input.partyId) return { ok: true, name: input.partyLabel?.trim() || null }
  if (!input.partyKind) return { ok: false, message: 'Choose what kind of party this cheque belongs to' }

  const { data } = await admin
    .from(PARTY_TABLE[input.partyKind])
    .select('name')
    .eq('id', input.partyId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!data) return { ok: false, message: 'That party was not found' }
  return { ok: true, name: data.name as string }
}

function narration(input: Parsed, partyName: string | null) {
  const side = input.direction === 'in' ? 'received' : 'issued'
  return `Opening post-dated cheque ${side}${partyName ? ` — ${partyName}` : ''}`
}

export async function createOpeningPdcAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Only owners can load opening cheques', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const data = parsed.data
  const admin = createAdminClient()

  const locked = await checkPeriodOpen(tenantId, data.asOfDate, 'This opening cheque')
  if (locked) return locked

  const party = await resolveParty(admin, tenantId, data)
  if (!party.ok) return { success: false, error: party.message, code: 'VALIDATION_ERROR' }

  const { data: serial } = await admin.rpc('get_next_voucher_number', {
    p_tenant_id: tenantId,
    p_prefix:    'OPC',
  })

  const { data: row, error } = await admin
    .from('pdc_opening_cheques')
    .insert({
      tenant_id:       tenantId,
      serial_number:   (serial as string | null) ?? null,
      as_of_date:      data.asOfDate,
      direction:       data.direction,
      party_kind:      data.partyId ? data.partyKind : null,
      party_id:        data.partyId ?? null,
      party_label:     data.partyId ? null : (data.partyLabel?.trim() || null),
      cheque_number:   data.chequeNumber,
      cheque_due_date: data.chequeDueDate,
      bank_id:         data.bankId ?? null,
      amount:          data.amount,
    })
    .select('id')
    .single()

  if (error || !row) {
    // The unique index is on (tenant, direction, cheque number): the same
    // physical cheque loaded twice would double 1112 and could settle twice.
    const duplicate = error?.code === '23505'
    return {
      success: false,
      error: duplicate ? `Cheque ${data.chequeNumber} has already been loaded` : 'Failed to save the cheque',
      code: duplicate ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR',
    }
  }

  const posted = await postJournalEntry({
    tenantId,
    date:        data.asOfDate,
    description: narration(data, party.name),
    reference:   data.chequeNumber,
    sourceType:  'pdc_opening',
    sourceId:    row.id,
    prefix:      'OB',
    lines:       openingLines(data.direction, data.amount),
  })

  if (!posted.ok) {
    // No half-loaded cheque: without its GL entry the register would show an
    // asset that the balance sheet knows nothing about.
    await admin.from('pdc_opening_cheques').delete().eq('id', row.id).eq('tenant_id', tenantId)
    return { success: false, error: `Could not post to the ledger, so nothing was saved: ${posted.message}`, code: 'GL_POST_FAILED' }
  }

  await createAuditEntry({
    tenantId, userId: user.id, action: 'create',
    entity: 'pdc_opening_cheques', entityId: row.id,
    after: { ...data, party: party.name, voucher: posted.voucherNumber },
  })

  return { success: true, data: { id: row.id } }
}

export async function editOpeningPdcAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = editSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Only owners can edit opening cheques', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { id, ...data } = parsed.data
  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('pdc_opening_cheques')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!existing) return { success: false, error: 'Cheque not found', code: 'NOT_FOUND' }

  // Once a cheque has cleared, bounced or been handed on there are other
  // entries built on top of it; changing its amount underneath them would
  // leave 1112 holding the difference forever.
  if (existing.pdc_status !== 'pending') {
    return {
      success: false,
      error: `This cheque is already marked ${existing.pdc_status} and can no longer be changed.`,
      code: 'VALIDATION_ERROR',
    }
  }

  // Both the old and the new date must be in an open period — the edit removes
  // an entry from one and writes one into the other.
  const lockedOld = await checkPeriodOpen(tenantId, existing.as_of_date as string, 'This opening cheque')
  if (lockedOld) return lockedOld
  const lockedNew = await checkPeriodOpen(tenantId, data.asOfDate, 'This opening cheque')
  if (lockedNew) return lockedNew

  const party = await resolveParty(admin, tenantId, data)
  if (!party.ok) return { success: false, error: party.message, code: 'VALIDATION_ERROR' }

  const { error } = await admin
    .from('pdc_opening_cheques')
    .update({
      as_of_date:      data.asOfDate,
      direction:       data.direction,
      party_kind:      data.partyId ? data.partyKind : null,
      party_id:        data.partyId ?? null,
      party_label:     data.partyId ? null : (data.partyLabel?.trim() || null),
      cheque_number:   data.chequeNumber,
      cheque_due_date: data.chequeDueDate,
      bank_id:         data.bankId ?? null,
      amount:          data.amount,
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .eq('pdc_status', 'pending')

  if (error) {
    const duplicate = error.code === '23505'
    return {
      success: false,
      error: duplicate ? `Cheque ${data.chequeNumber} has already been loaded` : 'Failed to update the cheque',
      code: duplicate ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR',
    }
  }

  const posted = await repostJournalEntry({
    tenantId,
    date:        data.asOfDate,
    description: narration(data, party.name),
    reference:   data.chequeNumber,
    sourceType:  'pdc_opening',
    sourceId:    id,
    prefix:      'OB',
    lines:       openingLines(data.direction, data.amount),
  })

  if (!posted.ok) {
    return { success: false, error: `Saved, but the ledger entry could not be rewritten: ${posted.message}`, code: 'GL_POST_FAILED' }
  }

  await createAuditEntry({
    tenantId, userId: user.id, action: 'update',
    entity: 'pdc_opening_cheques', entityId: id,
    before: { amount: existing.amount, chequeNumber: existing.cheque_number, dueDate: existing.cheque_due_date, direction: existing.direction },
    after: { ...data, party: party.name, voucher: posted.voucherNumber },
  })

  return { success: true, data: undefined }
}

export async function deleteOpeningPdcAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = deleteSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Only owners can delete opening cheques', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { id } = parsed.data
  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('pdc_opening_cheques')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!existing) return { success: false, error: 'Cheque not found', code: 'NOT_FOUND' }

  if (existing.pdc_status !== 'pending') {
    return {
      success: false,
      error: `This cheque is already marked ${existing.pdc_status}, so its settlement would be left with nothing behind it.`,
      code: 'VALIDATION_ERROR',
    }
  }

  const locked = await checkPeriodOpen(tenantId, existing.as_of_date as string, 'This opening cheque')
  if (locked) return locked

  // The ledger entry goes first: a cheque row with no entry is recoverable by
  // re-loading it, but an entry with no cheque is an orphan nobody can find.
  const { error: glError } = await admin
    .from('tajir_journal_entries')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('source_type', 'pdc_opening')
    .eq('source_id', id)

  if (glError) return { success: false, error: 'Could not remove the ledger entry', code: 'INTERNAL_ERROR' }

  const { error } = await admin
    .from('pdc_opening_cheques')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .eq('pdc_status', 'pending')

  if (error) return { success: false, error: 'Failed to delete the cheque', code: 'INTERNAL_ERROR' }

  await createAuditEntry({
    tenantId, userId: user.id, action: 'delete',
    entity: 'pdc_opening_cheques', entityId: id,
    before: { chequeNumber: existing.cheque_number, amount: existing.amount, dueDate: existing.cheque_due_date, direction: existing.direction },
  })

  return { success: true, data: undefined }
}

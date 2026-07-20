// Endorsement — handing a post-dated cheque received from a customer straight
// on to a supplier or an employee instead of banking it.
//
// The cheque is a physical object: once it has been passed on it is gone, so
// the source line is marked 'endorsed' and drops out of the pending list. The
// GL needs nothing special — the outgoing document already credits 1112, which
// is exactly the cheque leaving — but the source MUST be consumed, or the same
// amount could later be cleared into our bank as well.

import { createAdminClient } from '@/lib/supabase/admin'
import { PDC_SOURCES, type PdcSource, type PdcRegisterRow } from '@/lib/pdc/sources'

/** A received cheque offered in the Cheque No. picker. */
export type EndorsableCheque = {
  source: PdcSource
  lineId: string
  chequeNumber: string | null
  dueDate: string | null
  amount: number
  partyName: string | null
  docSerial: string | null
}

/**
 * The cheques currently in hand: received (direction 'in') and still pending.
 * Sorted soonest-due first, matching the register and the pending panel, so
 * the cheque most in need of being used appears at the top.
 */
export async function listEndorsableCheques(tenantId: string): Promise<EndorsableCheque[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('pdc_register')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('direction', 'in')
    .eq('pdc_status', 'pending')

  const rows = (data ?? []) as PdcRegisterRow[]
  return rows
    .sort((a, b) => {
      const ad = a.cheque_due_date ?? '9999-12-31'
      const bd = b.cheque_due_date ?? '9999-12-31'
      return ad === bd ? a.doc_date.localeCompare(b.doc_date) : ad.localeCompare(bd)
    })
    .map((r) => ({
      source:       r.source,
      lineId:       r.line_id,
      chequeNumber: r.cheque_number,
      dueDate:      r.cheque_due_date,
      amount:       Number(r.amount),
      partyName:    r.party_name,
      docSerial:    r.doc_serial,
    }))
}

export type EndorsementRef = { source: PdcSource; lineId: string }

/**
 * Re-reads the cheque and checks it can still be handed on, guarding the two
 * ways the picker's view of the world can be stale: someone else endorsed or
 * settled it while this form was open, and a tampered payload naming a cheque
 * that belongs to another tenant or points the wrong way.
 *
 * Returns the register row so the caller can copy the authoritative amount and
 * cheque number rather than trusting the client's copy.
 */
export async function verifyEndorsable(
  tenantId: string,
  ref: EndorsementRef,
  /**
   * True when the document being saved ALREADY holds this cheque — an edit
   * that keeps a line it saved earlier. Such a cheque is legitimately
   * 'endorsed' rather than 'pending', and rejecting it would make every edit
   * of an endorsed payment impossible.
   */
  alreadyHeld = false,
): Promise<{ ok: true; cheque: PdcRegisterRow } | { ok: false; message: string }> {
  if (!(ref.source in PDC_SOURCES)) return { ok: false, message: 'Unknown cheque source' }

  const admin = createAdminClient()
  const { data } = await admin
    .from('pdc_register')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('source', ref.source)
    .eq('line_id', ref.lineId)
    .maybeSingle()

  const cheque = data as PdcRegisterRow | null
  if (!cheque) return { ok: false, message: 'That cheque no longer exists' }
  if (cheque.direction !== 'in') {
    return { ok: false, message: 'Only a cheque received from a party can be handed on' }
  }
  const acceptable = alreadyHeld ? ['pending', 'endorsed'] : ['pending']
  if (!acceptable.includes(cheque.pdc_status)) {
    return { ok: false, message: `That cheque is already marked ${cheque.pdc_status} and cannot be handed on` }
  }
  return { ok: true, cheque }
}

/**
 * Marks the source cheque as handed on. Conditional on the row still being
 * 'pending', so two payments racing for the same cheque cannot both win — the
 * loser updates nothing and gets `false` back.
 */
export async function markEndorsed(tenantId: string, ref: EndorsementRef): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin
    .from(PDC_SOURCES[ref.source].table)
    .update({ pdc_status: 'endorsed', settled_at: new Date().toISOString() })
    .eq('id', ref.lineId)
    .eq('tenant_id', tenantId)
    .eq('pdc_status', 'pending')
    .select('id')

  return (data ?? []).length > 0
}

/**
 * Puts a cheque back in hand when the document that used it is deleted or
 * edited to no longer use it. Without this the cheque would be stranded:
 * 'endorsed' forever, invisible in the pending list, and impossible to clear.
 */
export async function releaseEndorsement(tenantId: string, ref: EndorsementRef): Promise<void> {
  const admin = createAdminClient()
  await admin
    .from(PDC_SOURCES[ref.source].table)
    .update({ pdc_status: 'pending', settled_at: null })
    .eq('id', ref.lineId)
    .eq('tenant_id', tenantId)
    .eq('pdc_status', 'endorsed')
}

/** Reads the endorsement links off a document's saved tender lines. */
export function endorsementRefsFrom(
  lines: { endorsed_from_source?: string | null; endorsed_from_line_id?: string | null }[],
): EndorsementRef[] {
  return lines
    .filter((l) => l.endorsed_from_source && l.endorsed_from_line_id)
    .map((l) => ({ source: l.endorsed_from_source as PdcSource, lineId: l.endorsed_from_line_id as string }))
}

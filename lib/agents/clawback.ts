import type { SupabaseClient } from '@supabase/supabase-js'
import { roundMoney, type CommissionType } from './commission'
import { AGENT_PAYABLE_KEY, COMMISSION_EXPENSE_KEY } from './apply-commission'

// Commission reversal when goods come back.
//
// The accrual on the invoice said "this trade earned the broker X". A return
// says part (or all) of that trade did not stick, so part (or all) of X comes
// off their payable. The reversal is computed from the rate stored on the
// ORIGINAL accrual, never the agent's current terms — otherwise a rate changed
// between the sale and the return would restate history through the back door.

export type ClawbackSourceType = 'sale_return' | 'purchase_return'
export type ClawbackSide = 'sale' | 'purchase'

export type CommissionClawback = {
  agentId: string
  agentName: string
  /** The invoice whose accrual this reverses. */
  invoiceId: string
  /** Basis and rate copied from the original accrual, for the audit trail. */
  commissionType: Exclude<CommissionType, 'none'>
  commissionRate: number
  returnedValue: number
  returnedQuantity: number
  /** Always POSITIVE here; stored negative and posted as a debit to the payable. */
  amount: number
  /** True when the cap bit — i.e. the invoice is now fully clawed back. */
  cappedToRemaining: boolean
}

export type ResolveClawbackResult =
  | { ok: true; clawback: CommissionClawback | null }
  | { ok: false; error: string }

const SIDE_CONFIG = {
  sale: {
    orderTable: 'sales_orders',
    invoiceSourceType: 'sale_invoice' as const,
    returnSourceType: 'sale_return' as const,
    returnTable: 'sale_returns',
    orderFk: 'sale_order_id',
  },
  purchase: {
    orderTable: 'purchase_orders',
    invoiceSourceType: 'purchase_invoice' as const,
    returnSourceType: 'purchase_return' as const,
    returnTable: 'purchase_returns',
    orderFk: 'purchase_order_id',
  },
} as const

type ResolveParams = {
  side: ClawbackSide
  /** The invoice line the return is booked against. Null → nothing to reverse. */
  orderId?: string | null
  /** Value of the goods coming back, in PKR. */
  returnedValue: number
  returnedQuantity: number
  /**
   * Set when re-computing an EDITED return, so that return's own existing
   * clawback is excluded from "how much has already been reversed" — otherwise
   * an edit would measure itself and under-reverse.
   */
  excludeReturnId?: string | null
}

/**
 * Works out how much commission a return takes back.
 *
 * `{ clawback: null }` means nothing is owed back — the return is not linked to
 * an invoice line, the invoice had no agent, the invoice accrued no commission,
 * or the accrual has already been fully reversed by earlier returns.
 */
export async function resolveCommissionClawback(
  admin: SupabaseClient,
  tenantId: string,
  params: ResolveParams,
): Promise<ResolveClawbackResult> {
  const { side, orderId, returnedValue, returnedQuantity, excludeReturnId } = params
  const cfg = SIDE_CONFIG[side]

  // A return can be recorded without pointing at an original line (both return
  // tables allow a null order FK). There is no invoice to reverse, so there is
  // no commission to take back — that is a normal outcome, not an error.
  if (!orderId) return { ok: true, clawback: null }

  const { data: order, error: orderError } = await admin
    .from(cfg.orderTable)
    .select('invoice_id, agent_id')
    .eq('id', orderId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (orderError) return { ok: false, error: `Could not read the original invoice line: ${orderError.message}` }
  if (!order || !order.invoice_id || !order.agent_id) return { ok: true, clawback: null }

  const invoiceId = order.invoice_id as string

  const { data: accrual, error: accrualError } = await admin
    .from('agent_commissions')
    .select('agent_id, commission_type, commission_rate, amount, base_amount')
    .eq('tenant_id', tenantId)
    .eq('source_type', cfg.invoiceSourceType)
    .eq('source_id', invoiceId)
    .maybeSingle()

  if (accrualError) return { ok: false, error: `Could not read the commission accrual: ${accrualError.message}` }
  // No accrual means the invoice named an agent but earned them nothing (rate
  // zero, or type 'none'). Nothing to reverse.
  if (!accrual) return { ok: true, clawback: null }

  const accruedAmount = Number(accrual.amount)
  const commissionType = accrual.commission_type as Exclude<CommissionType, 'none'>
  const commissionRate = Number(accrual.commission_rate)

  const { data: agent, error: agentError } = await admin
    .from('agents').select('name').eq('id', accrual.agent_id).eq('tenant_id', tenantId).maybeSingle()
  if (agentError) return { ok: false, error: `Could not read the agent: ${agentError.message}` }
  if (!agent) return { ok: false, error: 'Agent on the original invoice no longer exists' }

  // How much of this invoice's commission earlier returns have already taken
  // back. Read before computing, so the cap below can never over-reverse.
  let alreadyQuery = admin
    .from('agent_commissions')
    .select('source_id, amount')
    .eq('tenant_id', tenantId)
    .eq('related_invoice_id', invoiceId)
  if (excludeReturnId) alreadyQuery = alreadyQuery.neq('source_id', excludeReturnId)

  const { data: priorClawbacks, error: priorError } = await alreadyQuery
  if (priorError) return { ok: false, error: `Could not read prior clawbacks: ${priorError.message}` }

  // Stored negative; sum their magnitude.
  const alreadyClawedBack = (priorClawbacks ?? []).reduce((s, r) => s + Math.abs(Number(r.amount)), 0)
  const remaining = roundMoney(accruedAmount - alreadyClawedBack)
  if (remaining <= 0) return { ok: true, clawback: null }

  const raw = await computeRawClawback(admin, tenantId, {
    side, invoiceId, commissionType, commissionRate, accruedAmount,
    returnedValue, returnedQuantity, excludeReturnId,
  })
  if (!raw.ok) return { ok: false, error: raw.error }
  if (raw.amount <= 0) return { ok: true, clawback: null }

  // Never hand back more than was ever earned. Rounding across several partial
  // returns, or a return priced above the original line, would otherwise leave
  // the agent owing us money they never received.
  const amount = Math.min(raw.amount, remaining)

  return {
    ok: true,
    clawback: {
      agentId: accrual.agent_id as string,
      agentName: agent.name as string,
      invoiceId,
      commissionType,
      commissionRate,
      returnedValue,
      returnedQuantity,
      amount: roundMoney(amount),
      cappedToRemaining: amount < raw.amount,
    },
  }
}

async function computeRawClawback(
  admin: SupabaseClient,
  tenantId: string,
  p: {
    side: ClawbackSide
    invoiceId: string
    commissionType: Exclude<CommissionType, 'none'>
    commissionRate: number
    accruedAmount: number
    returnedValue: number
    returnedQuantity: number
    excludeReturnId?: string | null
  },
): Promise<{ ok: true; amount: number } | { ok: false; error: string }> {
  switch (p.commissionType) {
    case 'percentage':
      return { ok: true, amount: roundMoney((p.returnedValue * p.commissionRate) / 100) }

    case 'per_unit':
      return { ok: true, amount: roundMoney(p.returnedQuantity * p.commissionRate) }

    case 'flat': {
      // All or nothing — see the migration header for why a flat fee is not
      // pro-rated. Reverse the whole fee only once the invoice has been
      // returned in full by value.
      const full = await isInvoiceFullyReturned(admin, tenantId, p)
      if (!full.ok) return { ok: false, error: full.error }
      return { ok: true, amount: full.fully ? p.accruedAmount : 0 }
    }
  }
}

/**
 * Has every rupee of this invoice's goods come back?
 *
 * Compares total returned value across ALL lines of the invoice (including the
 * return being written right now) against the invoice value the accrual was
 * computed on.
 */
async function isInvoiceFullyReturned(
  admin: SupabaseClient,
  tenantId: string,
  p: { side: ClawbackSide; invoiceId: string; returnedValue: number; excludeReturnId?: string | null },
): Promise<{ ok: true; fully: boolean } | { ok: false; error: string }> {
  const cfg = SIDE_CONFIG[p.side]

  const { data: orders, error: ordersError } = await admin
    .from(cfg.orderTable)
    .select('id, pkr_equivalent')
    .eq('tenant_id', tenantId)
    .eq('invoice_id', p.invoiceId)

  if (ordersError) return { ok: false, error: `Could not read the invoice lines: ${ordersError.message}` }
  const orderIds = (orders ?? []).map((o) => o.id as string)
  if (orderIds.length === 0) return { ok: true, fully: false }

  const invoiceValue = (orders ?? []).reduce((s, o) => s + Number(o.pkr_equivalent), 0)
  if (invoiceValue <= 0) return { ok: true, fully: false }

  let returnsQuery = admin
    .from(cfg.returnTable)
    .select('id, pkr_equivalent')
    .eq('tenant_id', tenantId)
    .in(cfg.orderFk, orderIds)
  if (p.excludeReturnId) returnsQuery = returnsQuery.neq('id', p.excludeReturnId)

  const { data: priorReturns, error: returnsError } = await returnsQuery
  if (returnsError) return { ok: false, error: `Could not read prior returns: ${returnsError.message}` }

  const returnedSoFar = (priorReturns ?? []).reduce((s, r) => s + Number(r.pkr_equivalent), 0)
  // Include the return currently being written, which is not yet in the table
  // on create (and is excluded above on edit).
  const total = returnedSoFar + p.returnedValue

  // A hair under, to absorb rounding on a multi-line invoice returned piecemeal.
  return { ok: true, fully: total >= invoiceValue - 0.01 }
}

/**
 * The two GL legs a clawback adds to the RETURN's journal entry — the exact
 * mirror of `commissionJournalLines`. Riding on the return's own entry means a
 * deleted return takes its reversal with it.
 */
export function clawbackJournalLines(clawback: CommissionClawback | null) {
  if (!clawback) return []
  return [
    {
      accountSystemKey: AGENT_PAYABLE_KEY,
      description: `Commission reversed — ${clawback.agentName}`,
      debit: clawback.amount,
      credit: 0,
      agentId: clawback.agentId,
    },
    {
      accountSystemKey: COMMISSION_EXPENSE_KEY,
      description: `Commission reversed — ${clawback.agentName}`,
      debit: 0,
      credit: clawback.amount,
      agentId: clawback.agentId,
    },
  ]
}

/** Persist-or-remove the clawback row, mirroring `syncAgentCommission`. */
export async function syncCommissionClawback(
  admin: SupabaseClient,
  params: {
    tenantId: string
    clawback: CommissionClawback | null
    sourceType: ClawbackSourceType
    sourceId: string
    documentSerial?: string | null
    partyName?: string | null
    date: string
  },
): Promise<void> {
  const { tenantId, clawback, sourceType, sourceId, documentSerial, partyName, date } = params

  if (!clawback) {
    await admin
      .from('agent_commissions')
      .delete()
      .eq('tenant_id', tenantId).eq('source_type', sourceType).eq('source_id', sourceId)
    return
  }

  const { error } = await admin.from('agent_commissions').upsert(
    {
      tenant_id:          tenantId,
      agent_id:           clawback.agentId,
      source_type:        sourceType,
      source_id:          sourceId,
      related_invoice_id: clawback.invoiceId,
      document_serial:    documentSerial ?? null,
      party_name:         partyName ?? null,
      base_amount:        clawback.returnedValue,
      base_quantity:      clawback.returnedQuantity,
      commission_type:    clawback.commissionType,
      commission_rate:    clawback.commissionRate,
      // Negative by convention and by CHECK constraint: a reversal reduces what
      // is owed, so the agent balance stays a plain sum(amount).
      amount:             -clawback.amount,
      date,
    },
    { onConflict: 'tenant_id,source_type,source_id' },
  )

  if (error) {
    // The GL is already correct; this row is the audit detail behind it.
    console.error(
      `[syncCommissionClawback] could not store the clawback for ${sourceType}/${sourceId}: ${error.message}`,
    )
  }
}

/** Drops a return's clawback row — used when the return itself is deleted. */
export async function clearCommissionClawback(
  admin: SupabaseClient,
  tenantId: string,
  sourceType: ClawbackSourceType,
  sourceId: string,
): Promise<void> {
  await admin
    .from('agent_commissions')
    .delete()
    .eq('tenant_id', tenantId).eq('source_type', sourceType).eq('source_id', sourceId)
}

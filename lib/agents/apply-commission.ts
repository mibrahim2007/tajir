import type { SupabaseClient } from '@supabase/supabase-js'
import {
  computeCommission,
  type CommissionSide,
  type CommissionType,
  type AccruingCommissionType,
} from './commission'

// Server-side glue between an invoice and the agent commission it accrues.
//
// Six actions (create/edit/delete × sale/purchase) need identical behaviour, so
// the resolve → persist → post sequence lives here once. Getting it wrong in
// one of six copies would leave the payable and the expense disagreeing, which
// no report would surface until someone reconciled the agent by hand.

export const COMMISSION_EXPENSE_KEY = 'commission_expense'
export const AGENT_PAYABLE_KEY = 'agent_commission_payable'

export type AgentCommissionSourceType = 'sale_invoice' | 'purchase_invoice'

export type CommissionAccrual = {
  agentId: string
  agentName: string
  type: AccruingCommissionType
  rate: number
  amount: number
  baseAmount: number
  baseQuantity: number
}

export type ResolveCommissionResult =
  | { ok: true; accrual: CommissionAccrual | null }
  | { ok: false; error: string }

type ResolveParams = {
  agentId?: string | null
  side: CommissionSide
  /** Invoice value in PKR. */
  baseAmount: number
  /** Total invoice quantity, for a per-unit rate. */
  baseQuantity: number
  /**
   * Per-document overrides typed on the invoice. Absent (or null) means "use
   * the agent's enrolled default" — a deal struck at a one-off rate should not
   * disturb the agent's standing terms.
   */
  overrideType?: CommissionType | null
  overrideRate?: number | null
}

/**
 * Works out what this document owes the agent.
 *
 * `{ accrual: null }` means no commission is due — no agent on the document, or
 * a basis that computes to zero. Callers skip both the stored row and the GL
 * legs in that case, so a zero-value accrual never reaches the ledger.
 *
 * Returns `ok: false` only when the agent itself is wrong (unknown, or another
 * tenant's), which the caller must surface rather than silently drop.
 */
export async function resolveAgentCommission(
  admin: SupabaseClient,
  tenantId: string,
  params: ResolveParams,
): Promise<ResolveCommissionResult> {
  const { agentId, side, baseAmount, baseQuantity, overrideType, overrideRate } = params
  if (!agentId) return { ok: true, accrual: null }

  const { data: agent } = await admin
    .from('agents')
    .select('id, name, is_active, sale_commission_type, sale_commission_rate, purchase_commission_type, purchase_commission_rate')
    .eq('id', agentId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!agent) return { ok: false, error: 'Agent not found' }
  // An inactive agent is deliberately still allowed here: retiring an agent must
  // not block editing an old invoice that was theirs.

  const defaultType = (side === 'sale' ? agent.sale_commission_type : agent.purchase_commission_type) as CommissionType
  const defaultRate = Number(side === 'sale' ? agent.sale_commission_rate : agent.purchase_commission_rate)

  const type = overrideType ?? defaultType
  const rate = overrideRate ?? defaultRate

  const amount = computeCommission({ type, rate, baseAmount, baseQuantity })
  if (amount <= 0 || type === 'none') return { ok: true, accrual: null }

  return {
    ok: true,
    accrual: {
      agentId: agent.id as string,
      agentName: agent.name as string,
      type: type as AccruingCommissionType,
      rate,
      amount,
      baseAmount,
      baseQuantity,
    },
  }
}

/**
 * The two GL legs an accrual adds to its invoice's journal entry.
 *
 * They ride on the SAME entry as the invoice rather than a separate voucher, so
 * the commission can never be posted without the sale (or survive its deletion)
 * and the whole document stays one balanced entry. The agent is carried on the
 * payable leg as the sub-ledger dimension.
 */
export function commissionJournalLines(accrual: CommissionAccrual | null) {
  if (!accrual) return []
  return [
    {
      accountSystemKey: COMMISSION_EXPENSE_KEY,
      description: `Commission — ${accrual.agentName}`,
      debit: accrual.amount,
      credit: 0,
      agentId: accrual.agentId,
    },
    {
      accountSystemKey: AGENT_PAYABLE_KEY,
      description: `Commission payable — ${accrual.agentName}`,
      debit: 0,
      credit: accrual.amount,
      agentId: accrual.agentId,
    },
  ]
}

/**
 * Writes (or rewrites) the accrual row behind a document's commission.
 *
 * Upsert-on-source rather than insert, so re-saving an edited invoice restates
 * the single accrual instead of stacking a second one on top of the first.
 */
export async function saveAgentCommission(
  admin: SupabaseClient,
  params: {
    tenantId: string
    accrual: CommissionAccrual
    sourceType: AgentCommissionSourceType
    sourceId: string
    documentSerial?: string | null
    partyName?: string | null
    date: string
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { tenantId, accrual, sourceType, sourceId, documentSerial, partyName, date } = params

  const { error } = await admin
    .from('agent_commissions')
    .upsert(
      {
        tenant_id:       tenantId,
        agent_id:        accrual.agentId,
        source_type:     sourceType,
        source_id:       sourceId,
        document_serial: documentSerial ?? null,
        party_name:      partyName ?? null,
        base_amount:     accrual.baseAmount,
        base_quantity:   accrual.baseQuantity,
        commission_type: accrual.type,
        commission_rate: accrual.rate,
        amount:          accrual.amount,
        date,
      },
      { onConflict: 'tenant_id,source_type,source_id' },
    )

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/**
 * Drops the accrual for a document — used when the invoice is deleted, and when
 * an edit removes its agent or drops the commission to zero. Without this an
 * edited invoice would keep an orphaned accrual that the GL no longer carries.
 */
export async function clearAgentCommission(
  admin: SupabaseClient,
  tenantId: string,
  sourceType: AgentCommissionSourceType,
  sourceId: string,
): Promise<void> {
  await admin
    .from('agent_commissions')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('source_type', sourceType)
    .eq('source_id', sourceId)
}

/**
 * Persist-or-remove in one call: the shape every create/edit action wants after
 * its journal entry has posted.
 */
export async function syncAgentCommission(
  admin: SupabaseClient,
  params: {
    tenantId: string
    accrual: CommissionAccrual | null
    sourceType: AgentCommissionSourceType
    sourceId: string
    documentSerial?: string | null
    partyName?: string | null
    date: string
  },
): Promise<void> {
  if (!params.accrual) {
    await clearAgentCommission(admin, params.tenantId, params.sourceType, params.sourceId)
    return
  }
  const saved = await saveAgentCommission(admin, { ...params, accrual: params.accrual })
  if (!saved.ok) {
    // The GL is already correct at this point — the accrual row is the audit
    // detail behind it. Loud, but not worth unwinding a posted invoice for.
    console.error(
      `[syncAgentCommission] could not store the accrual for ` +
        `${params.sourceType}/${params.sourceId}: ${saved.error}`,
    )
  }
}

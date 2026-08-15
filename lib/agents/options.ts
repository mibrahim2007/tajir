import type { SupabaseClient } from '@supabase/supabase-js'
import type { AgentOption } from '@/components/agent-commission-field'
import type { CommissionType } from './commission'

/**
 * Active agents for the picker on an invoice form.
 *
 * Both commission sides come along so the form can preview the amount without a
 * round trip — the server recomputes it from the same terms on save, so this is
 * a convenience, never the source of truth.
 *
 * Retired agents are excluded: they must not appear on NEW invoices. An existing
 * invoice that names a retired agent still edits and re-posts correctly, since
 * the server resolves the agent by id regardless of their active flag.
 */
export async function getAgentOptions(
  admin: SupabaseClient,
  tenantId: string,
): Promise<AgentOption[]> {
  const { data } = await admin
    .from('agents')
    .select('id, name, sale_commission_type, sale_commission_rate, purchase_commission_type, purchase_commission_rate')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('name')

  return (data ?? []).map((a) => ({
    id: a.id as string,
    name: a.name as string,
    saleCommissionType: a.sale_commission_type as CommissionType,
    saleCommissionRate: Number(a.sale_commission_rate),
    purchaseCommissionType: a.purchase_commission_type as CommissionType,
    purchaseCommissionRate: Number(a.purchase_commission_rate),
  }))
}

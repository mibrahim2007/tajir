import { redirect } from 'next/navigation'
import { PendingChequesPanel } from '@/components/pending-cheques-panel'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { peekNextDocumentSerial } from '@/lib/serials/next-serial'
import { formatPKR } from '@/lib/utils/currency'
import { getAgentBalances } from '@/lib/agents/ledger'
import type { CommissionType } from '@/lib/agents/commission'
import { AgentForm } from './agent-form'
import { AgentPaymentForm } from './agent-payment-form'
import { AgentsList, type AgentListItem } from './agents-list'

export default async function AgentsPage() {
  const { tenantId, role } = await requireAuth()
  // Commission terms and the payable behind them are owner-only, in line with
  // Owners and the rest of the Accounts admin section.
  if (role !== 'owner') redirect('/dashboard')
  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const [{ data: allAgents }, { data: allBanks }] = await Promise.all([
    admin.from('agents')
      .select('id, name, agent_code, cnic, phone, email, city, address, is_active, notes, created_at, sale_commission_type, sale_commission_rate, purchase_commission_type, purchase_commission_rate, opening_balance, opening_balance_currency, opening_balance_pkr_equivalent')
      .eq('tenant_id', tenantId).order('created_at', { ascending: false }),
    admin.from('banks').select('id, name, account_number').eq('tenant_id', tenantId).order('name'),
  ])

  const agents = allAgents ?? []
  const banks = allBanks ?? []
  const nextSerial = await peekNextDocumentSerial(admin, tenantId, 'agent_payment', today)

  const balances = await getAgentBalances(
    admin, tenantId,
    agents.map((a) => ({ id: a.id as string, openingPkr: Number(a.opening_balance_pkr_equivalent) })),
  )

  const items: AgentListItem[] = agents.map((a) => {
    const b = balances.get(a.id as string) ?? { earned: 0, paid: 0, outstanding: 0 }
    const openingBalance = Number(a.opening_balance)
    const openingPkr = Number(a.opening_balance_pkr_equivalent)
    return {
      id: a.id as string,
      name: a.name as string,
      agentCode: a.agent_code as string | null,
      phone: a.phone as string | null,
      city: a.city as string | null,
      isActive: a.is_active as boolean,
      saleCommissionType: a.sale_commission_type as CommissionType,
      saleCommissionRate: Number(a.sale_commission_rate),
      purchaseCommissionType: a.purchase_commission_type as CommissionType,
      purchaseCommissionRate: Number(a.purchase_commission_rate),
      ...b,
      // Prepared here so the edit sheet opens fully populated without a second
      // round trip when the row is expanded.
      form: {
        id: a.id as string,
        name: a.name as string,
        agentCode: (a.agent_code as string | null) ?? '',
        cnic: (a.cnic as string | null) ?? '',
        phone: (a.phone as string | null) ?? '',
        email: (a.email as string | null) ?? '',
        city: (a.city as string | null) ?? '',
        address: (a.address as string | null) ?? '',
        saleCommissionType: a.sale_commission_type as CommissionType,
        saleCommissionRate: Number(a.sale_commission_rate),
        purchaseCommissionType: a.purchase_commission_type as CommissionType,
        purchaseCommissionRate: Number(a.purchase_commission_rate),
        openingBalance,
        openingBalanceCurrency: a.opening_balance_currency as 'PKR' | 'USD',
        // Stored as an amount and its PKR equivalent, not a rate — recover the
        // rate so re-saving an unchanged USD opening balance does not restate it.
        openingBalanceExchangeRate: openingBalance > 0 ? openingPkr / openingBalance : 1,
        notes: (a.notes as string | null) ?? '',
      },
    }
  })

  const payable = items.reduce((s, a) => s + a.outstanding, 0)
  const agentOptions = items
    .filter((a) => a.isActive)
    .map((a) => ({ id: a.id, name: a.name, outstanding: a.outstanding }))

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PendingChequesPanel direction="out" className="mb-4" />
      <div className="flex items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Agents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {agents.length} agent{agents.length !== 1 ? 's' : ''}
            {payable !== 0 && <> · {formatPKR(Math.abs(payable))} {payable > 0 ? 'commission outstanding' : 'paid in advance'}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {agentOptions.length > 0 && (
            <AgentPaymentForm agents={agentOptions} today={today} nextSerial={nextSerial} banks={banks} />
          )}
          <AgentForm />
        </div>
      </div>

      {agents.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed py-16 text-center shadow-sm">
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            No agents yet. Enrol a broker to set their sale and purchase commission
            terms — commission then accrues automatically on every invoice they are
            named on, and their ledger tracks what is still owed.
          </p>
        </div>
      ) : (
        <AgentsList agents={items} />
      )}
    </div>
  )
}

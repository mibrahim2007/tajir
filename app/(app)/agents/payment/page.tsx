import { PeriodLockBanner } from '@/components/period-lock-banner'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { peekNextDocumentSerial } from '@/lib/serials/next-serial'
import { getAgentBalances } from '@/lib/agents/ledger'
import { AgentPaymentForm } from '../agent-payment-form'

export default async function NewAgentPaymentPage() {
  const { tenantId, role } = await requireAuth()
  // Commission terms and the payable behind them are owner-only.
  if (role !== 'owner') {
    return <div className="p-6"><p className="text-muted-foreground">Access denied.</p></div>
  }

  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const [{ data: rawAgents }, { data: rawBanks }, nextSerial] = await Promise.all([
    admin.from('agents').select('id, name, opening_balance_pkr_equivalent')
      .eq('tenant_id', tenantId).eq('is_active', true).order('created_at', { ascending: false }),
    admin.from('banks').select('id, name, account_number').eq('tenant_id', tenantId).order('name'),
    peekNextDocumentSerial(admin, tenantId, 'agent_payment', today),
  ])

  const agents = rawAgents ?? []
  const balances = await getAgentBalances(
    admin, tenantId,
    agents.map((a) => ({ id: a.id as string, openingPkr: Number(a.opening_balance_pkr_equivalent) })),
  )
  const agentOptions = agents.map((a) => ({
    id: a.id as string,
    name: a.name as string,
    outstanding: balances.get(a.id as string)?.outstanding ?? 0,
  }))

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      <PeriodLockBanner className="mb-4" />
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Agent Commission Payment</h1>
        <p className="text-sm text-muted-foreground mt-1">Settle commission owed to an agent. Paid on account against their running balance, not against particular invoices.</p>
      </div>
      <AgentPaymentForm agents={agentOptions} today={today} nextSerial={nextSerial} banks={rawBanks ?? []} returnPath="/agents" />
    </div>
  )
}

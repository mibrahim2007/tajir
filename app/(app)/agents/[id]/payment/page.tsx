import { notFound } from 'next/navigation'
import { PeriodLockBanner } from '@/components/period-lock-banner'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { peekNextDocumentSerial } from '@/lib/serials/next-serial'
import { getAgentBalances } from '@/lib/agents/ledger'
import { AgentPaymentForm } from '../../agent-payment-form'

export default async function AgentPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tenantId, role } = await requireAuth()
  // Commission terms and the payable behind them are owner-only.
  if (role !== 'owner') {
    return <div className="p-6"><p className="text-muted-foreground">Access denied.</p></div>
  }

  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const { data: agent } = await admin
    .from('agents')
    .select('id, name, opening_balance_pkr_equivalent')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!agent) notFound()

  const [{ data: rawBanks }, nextSerial, balances] = await Promise.all([
    admin.from('banks').select('id, name, account_number').eq('tenant_id', tenantId).order('name'),
    peekNextDocumentSerial(admin, tenantId, 'agent_payment', today),
    getAgentBalances(admin, tenantId, [{ id: agent.id as string, openingPkr: Number(agent.opening_balance_pkr_equivalent) }]),
  ])

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      <PeriodLockBanner className="mb-4" />
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Agent Commission Payment</h1>
        <p className="text-sm text-muted-foreground mt-1">Settle commission owed to {agent.name as string}. Paid on account against their running balance, not against particular invoices.</p>
      </div>
      <AgentPaymentForm
        agentId={agent.id as string}
        outstanding={balances.get(agent.id as string)?.outstanding ?? 0}
        today={today}
        nextSerial={nextSerial}
        banks={rawBanks ?? []}
        returnPath={`/agents/${agent.id}/ledger`}
      />
    </div>
  )
}

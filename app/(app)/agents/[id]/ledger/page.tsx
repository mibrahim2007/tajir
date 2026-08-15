import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { PendingChequesPanel } from '@/components/pending-cheques-panel'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { peekNextDocumentSerial } from '@/lib/serials/next-serial'
import { formatPKR } from '@/lib/utils/currency'
import { getAgentLedger } from '@/lib/agents/ledger'
import { formatCommissionRate, type CommissionType } from '@/lib/agents/commission'
import { AgentPaymentForm } from '../../agent-payment-form'
import { AgentLedgerRows } from './agent-ledger-rows'

export default async function AgentLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tenantId, role } = await requireAuth()
  if (role !== 'owner') redirect('/dashboard')
  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const { data: agent } = await admin
    .from('agents')
    .select('id, name, agent_code, phone, city, is_active, created_at, sale_commission_type, sale_commission_rate, purchase_commission_type, purchase_commission_rate, opening_balance_pkr_equivalent')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!agent) notFound()

  const [{ data: allBanks }, ledger] = await Promise.all([
    admin.from('banks').select('id, name, account_number').eq('tenant_id', tenantId).order('name'),
    getAgentLedger(admin, tenantId, {
      id: agent.id as string,
      openingPkr: Number(agent.opening_balance_pkr_equivalent),
      createdAt: agent.created_at as string,
    }),
  ])

  const banks = allBanks ?? []
  const nextSerial = await peekNextDocumentSerial(admin, tenantId, 'agent_payment', today)
  const { rows, totals } = ledger

  const terms = [
    `Sales ${formatCommissionRate(agent.sale_commission_type as CommissionType, Number(agent.sale_commission_rate))}`,
    `Purchases ${formatCommissionRate(agent.purchase_commission_type as CommissionType, Number(agent.purchase_commission_rate))}`,
  ].join(' · ')

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PendingChequesPanel direction="out" className="mb-4" />
      <div className="flex items-center justify-between mb-6 gap-3">
        <div>
          <Link href="/agents" className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4">
            ← Agents
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight mt-1">
            {agent.name}
            {!agent.is_active && (
              <span className="text-xs align-middle ml-2 px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">Retired</span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Commission ledger · {terms}</p>
        </div>
        <AgentPaymentForm
          agentId={agent.id as string}
          outstanding={totals.outstanding}
          today={today}
          nextSerial={nextSerial}
          banks={banks}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-card rounded-2xl border shadow-sm px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Commission Earned</p>
          <p className="text-xl font-extrabold tabular-nums mt-1">{formatPKR(totals.earned)}</p>
        </div>
        <div className="bg-card rounded-2xl border shadow-sm px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Paid</p>
          <p className="text-xl font-extrabold tabular-nums mt-1 text-emerald-700 dark:text-emerald-400">
            {formatPKR(totals.paid)}
          </p>
        </div>
        <div className="bg-card rounded-2xl border shadow-sm px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {totals.outstanding < 0 ? 'Paid in Advance' : 'Outstanding'}
          </p>
          <p className={`text-xl font-extrabold tabular-nums mt-1 ${totals.outstanding > 0 ? 'text-amber-700 dark:text-amber-400' : ''}`}>
            {formatPKR(Math.abs(totals.outstanding))}
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed py-16 text-center shadow-sm">
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Nothing recorded for {agent.name} yet. Name them on a sale or purchase
            invoice and their commission will accrue here automatically.
          </p>
        </div>
      ) : (
        <AgentLedgerRows rows={rows} />
      )}
    </div>
  )
}

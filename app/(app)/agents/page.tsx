import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus } from 'lucide-react'
import { PendingChequesPanel } from '@/components/pending-cheques-panel'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'
import { formatPKR } from '@/lib/utils/currency'
import { getAgentBalances } from '@/lib/agents/ledger'
import type { CommissionType } from '@/lib/agents/commission'
import { AgentsList, type AgentListItem } from './agents-list'

export default async function AgentsPage() {
  const { tenantId, role } = await requireAuth()
  // Commission terms and the payable behind them are owner-only, in line with
  // Owners and the rest of the Accounts admin section.
  if (role !== 'owner') redirect('/dashboard')
  const admin = createAdminClient()

  const { data: allAgents } = await admin.from('agents')
    .select('id, name, agent_code, phone, city, is_active, created_at, sale_commission_type, sale_commission_rate, purchase_commission_type, purchase_commission_rate, opening_balance_pkr_equivalent')
    .eq('tenant_id', tenantId).order('created_at', { ascending: false })

  const agents = allAgents ?? []

  const balances = await getAgentBalances(
    admin, tenantId,
    agents.map((a) => ({ id: a.id as string, openingPkr: Number(a.opening_balance_pkr_equivalent) })),
  )

  const items: AgentListItem[] = agents.map((a) => {
    const b = balances.get(a.id as string) ?? { earned: 0, paid: 0, outstanding: 0 }
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
    }
  })

  const payable = items.reduce((s, a) => s + a.outstanding, 0)
  const hasActiveAgents = items.some((a) => a.isActive)

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
          {hasActiveAgents && (
            <Link href="/agents/payment">
              <Button className="min-h-[44px]">Pay Commission</Button>
            </Link>
          )}
          <Link href="/agents/new">
            <Button variant="outline" className="min-h-[44px]"><Plus className="h-4 w-4 mr-2" />Enrol Agent</Button>
          </Link>
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

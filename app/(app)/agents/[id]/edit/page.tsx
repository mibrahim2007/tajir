import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { CommissionType } from '@/lib/agents/commission'
import { AgentForm } from '../../agent-form'

export default async function EditAgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tenantId, role } = await requireAuth()
  // Commission terms and the payable behind them are owner-only.
  if (role !== 'owner') {
    return <div className="p-6"><p className="text-muted-foreground">Access denied.</p></div>
  }

  const admin = createAdminClient()

  const { data: a } = await admin
    .from('agents')
    .select('id, name, agent_code, cnic, phone, email, city, address, notes, sale_commission_type, sale_commission_rate, purchase_commission_type, purchase_commission_rate, opening_balance, opening_balance_currency, opening_balance_pkr_equivalent')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!a) notFound()

  const openingBalance = Number(a.opening_balance)
  const openingPkr = Number(a.opening_balance_pkr_equivalent)

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Edit {a.name as string}</h1>
        <p className="text-sm text-muted-foreground mt-1">A broker who introduces trade. Commission accrues automatically on every invoice they are named on, and is paid out from their ledger.</p>
      </div>
      <AgentForm
        agent={{
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
        }}
      />
    </div>
  )
}

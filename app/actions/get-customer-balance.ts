'use server'

import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function getCustomerBalanceAction(customerId: string): Promise<number | null> {
  try {
    const { tenantId } = await requireAuth()
    const admin = createAdminClient()

    const [{ data: customer }, { data: sales }, { data: receipts }, { data: returns }, { data: creditNotes }] = await Promise.all([
      admin.from('tajir_customers').select('opening_balance_pkr_equivalent').eq('id', customerId).eq('tenant_id', tenantId).single(),
      admin.from('sales_orders').select('pkr_equivalent').eq('customer_id', customerId).eq('tenant_id', tenantId),
      admin.from('ar_receipts').select('pkr_equivalent').eq('customer_id', customerId).eq('tenant_id', tenantId),
      admin.from('sale_returns').select('pkr_equivalent').eq('customer_id', customerId).eq('tenant_id', tenantId),
      admin.from('credit_notes').select('pkr_equivalent').eq('customer_id', customerId).eq('tenant_id', tenantId),
    ])

    if (!customer) return null

    const ob     = parseFloat(customer.opening_balance_pkr_equivalent ?? '0')
    const billed = (sales        ?? []).reduce((s, r) => s + parseFloat(r.pkr_equivalent), 0)
    const paid   = (receipts     ?? []).reduce((s, r) => s + parseFloat(r.pkr_equivalent), 0)
    const ret    = (returns      ?? []).reduce((s, r) => s + parseFloat(r.pkr_equivalent), 0)
    const cn     = (creditNotes  ?? []).reduce((s, n) => s + parseFloat(n.pkr_equivalent), 0)

    return ob + billed - paid - ret - cn
  } catch {
    return null
  }
}

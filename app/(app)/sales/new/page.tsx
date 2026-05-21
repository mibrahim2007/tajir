import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { CreateSaleForm } from './create-sale-form'

export default async function NewSalePage() {
  const { tenantId, role } = await requireAuth()
  const admin = createAdminClient()

  const [{ data: rawCustomers }, { data: rawItems }, { data: rawRules }] = await Promise.all([
    admin.from('tajir_customers').select('id, name').eq('tenant_id', tenantId),
    admin.from('inventory_lots').select('id, name, current_quantity').eq('tenant_id', tenantId),
    admin.from('customer_price_lists').select('customer_id, stock_item_id, rate').eq('tenant_id', tenantId),
  ])

  const customers = rawCustomers ?? []
  const stockItems = (rawItems ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    currentQuantity: l.current_quantity,
  }))
  const pricingRules = (rawRules ?? []).map((r) => ({
    customerId: r.customer_id,
    stockItemId: r.stock_item_id,
    rate: r.rate,
  }))

  return (
    <div className="p-6 max-w-lg mx-auto">
      <Link href="/sales" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ChevronLeft className="h-4 w-4" />
        Back to Sales
      </Link>
      <h1 className="text-2xl font-semibold mb-6">New Sale</h1>
      <CreateSaleForm
        customers={customers}
        stockItems={stockItems}
        pricingRules={pricingRules}
        isOwner={role === 'owner'}
      />
    </div>
  )
}

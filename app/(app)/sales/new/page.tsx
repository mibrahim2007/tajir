import { eq } from 'drizzle-orm'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { requireAuth } from '@/lib/auth/require-auth'
import { db } from '@/db'
import { tajirCustomers, inventoryLots, customerPriceLists } from '@/db/schema'
import { CreateSaleForm } from './create-sale-form'

export default async function NewSalePage() {
  const { tenantId, role } = await requireAuth()

  const [customers, stockItems, pricingRules] = await Promise.all([
    db.select({ id: tajirCustomers.id, name: tajirCustomers.name }).from(tajirCustomers)
      .where(eq(tajirCustomers.tenantId, tenantId)),
    db.select({ id: inventoryLots.id, name: inventoryLots.name, currentQuantity: inventoryLots.currentQuantity })
      .from(inventoryLots).where(eq(inventoryLots.tenantId, tenantId)),
    db.select({ customerId: customerPriceLists.customerId, stockItemId: customerPriceLists.stockItemId, rate: customerPriceLists.rate })
      .from(customerPriceLists)
      .where(eq(customerPriceLists.tenantId, tenantId)),
  ])

  const activePricingRules = pricingRules

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
        pricingRules={activePricingRules}
        isOwner={role === 'owner'}
      />
    </div>
  )
}

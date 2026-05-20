import { eq, desc } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { db } from '@/db'
import { suppliers, inventoryLots } from '@/db/schema'
import { CreatePurchaseForm } from './create-purchase-form'

export default async function NewPurchasePage() {
  const { tenantId } = await requireAuth()

  const [supplierList, lotList] = await Promise.all([
    db.select({ id: suppliers.id, name: suppliers.name })
      .from(suppliers)
      .where(eq(suppliers.tenantId, tenantId))
      .orderBy(desc(suppliers.createdAt)),
    db.select({ id: inventoryLots.id, name: inventoryLots.name, count: inventoryLots.count })
      .from(inventoryLots)
      .where(eq(inventoryLots.tenantId, tenantId))
      .orderBy(desc(inventoryLots.createdAt)),
  ])

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-semibold mb-1">New Purchase</h1>
      <p className="text-sm text-muted-foreground mb-6">Record a purchase from a supplier.</p>
      <CreatePurchaseForm suppliers={supplierList} lots={lotList} />
    </div>
  )
}

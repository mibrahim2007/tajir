import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'

export default async function DashboardPage() {
  const { tenantId, role } = await requireAuth()
  const tenant = await getTenant(tenantId)

  void tenant.subscriptionStatus // banner handled in layout

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-1">{tenant.name}</h1>
      <p className="text-sm text-muted-foreground mb-8 capitalize">{role} account</p>

      <div className="grid grid-cols-2 gap-4">
        <a
          href="/inventory"
          className="block rounded-lg border p-4 hover:bg-accent transition-colors min-h-[44px]"
        >
          <p className="font-medium">Inventory</p>
          <p className="text-sm text-muted-foreground">View stock levels</p>
        </a>
        <a
          href="/purchases/new"
          className="block rounded-lg border p-4 hover:bg-accent transition-colors min-h-[44px]"
        >
          <p className="font-medium">New Purchase</p>
          <p className="text-sm text-muted-foreground">Record a purchase</p>
        </a>
        <a
          href="/sales/new"
          className="block rounded-lg border p-4 hover:bg-accent transition-colors min-h-[44px]"
        >
          <p className="font-medium">New Sale</p>
          <p className="text-sm text-muted-foreground">Create a sale order</p>
        </a>
        {role === 'owner' && (
          <a
            href="/reports"
            className="block rounded-lg border p-4 hover:bg-accent transition-colors min-h-[44px]"
          >
            <p className="font-medium">Reports</p>
            <p className="text-sm text-muted-foreground">Aging & ledgers</p>
          </a>
        )}
      </div>
    </div>
  )
}

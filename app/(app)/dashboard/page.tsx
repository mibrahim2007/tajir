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
          className="block rounded-xl border border-blue-200 bg-blue-50 p-4 hover:bg-blue-100 transition-colors min-h-[44px]"
        >
          <p className="font-semibold text-blue-900">Inventory</p>
          <p className="text-sm text-blue-600">View stock levels</p>
        </a>
        <a
          href="/purchases/new"
          className="block rounded-xl border border-orange-200 bg-orange-50 p-4 hover:bg-orange-100 transition-colors min-h-[44px]"
        >
          <p className="font-semibold text-orange-900">New Purchase</p>
          <p className="text-sm text-orange-600">Record a purchase</p>
        </a>
        <a
          href="/sales/new"
          className="block rounded-xl border border-green-200 bg-green-50 p-4 hover:bg-green-100 transition-colors min-h-[44px]"
        >
          <p className="font-semibold text-green-900">New Sale</p>
          <p className="text-sm text-green-600">Create a sale order</p>
        </a>
        {role === 'owner' && (
          <a
            href="/reports"
            className="block rounded-xl border border-purple-200 bg-purple-50 p-4 hover:bg-purple-100 transition-colors min-h-[44px]"
          >
            <p className="font-semibold text-purple-900">Reports</p>
            <p className="text-sm text-purple-600">Aging &amp; ledgers</p>
          </a>
        )}
      </div>
    </div>
  )
}

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
          className="flex flex-col rounded-xl border border-blue-200 bg-blue-50 p-4 hover:bg-blue-100 transition-colors min-h-[44px]"
        >
          <span className="font-semibold text-blue-900">Inventory</span>
          <span className="text-sm text-blue-600">View stock levels</span>
        </a>
        <a
          href="/purchases/new"
          className="flex flex-col rounded-xl border border-orange-200 bg-orange-50 p-4 hover:bg-orange-100 transition-colors min-h-[44px]"
        >
          <span className="font-semibold text-orange-900">New Purchase</span>
          <span className="text-sm text-orange-600">Record a purchase</span>
        </a>
        <a
          href="/sales/new"
          className="flex flex-col rounded-xl border border-green-200 bg-green-50 p-4 hover:bg-green-100 transition-colors min-h-[44px]"
        >
          <span className="font-semibold text-green-900">New Sale</span>
          <span className="text-sm text-green-600">Create a sale order</span>
        </a>
        <a
          href="/gatepasses/new"
          className="flex flex-col rounded-xl border border-yellow-200 bg-yellow-50 p-4 hover:bg-yellow-100 transition-colors min-h-[44px]"
        >
          <span className="font-semibold text-yellow-900">New Gatepass</span>
          <span className="text-sm text-yellow-600">Issue a gatepass</span>
        </a>
        <a
          href="/purchase-returns/new"
          className="flex flex-col rounded-xl border border-red-200 bg-red-50 p-4 hover:bg-red-100 transition-colors min-h-[44px]"
        >
          <span className="font-semibold text-red-900">Purchase Return</span>
          <span className="text-sm text-red-600">Return to supplier</span>
        </a>
        <a
          href="/sale-returns/new"
          className="flex flex-col rounded-xl border border-pink-200 bg-pink-50 p-4 hover:bg-pink-100 transition-colors min-h-[44px]"
        >
          <span className="font-semibold text-pink-900">Sale Return</span>
          <span className="text-sm text-pink-600">Customer return</span>
        </a>
        {role === 'owner' && (
          <>
            <a
              href="/vouchers/new"
              className="flex flex-col rounded-xl border border-teal-200 bg-teal-50 p-4 hover:bg-teal-100 transition-colors min-h-[44px]"
            >
              <span className="font-semibold text-teal-900">New Voucher</span>
              <span className="text-sm text-teal-600">Journal entry</span>
            </a>
            <a
              href="/reports/profit-loss"
              className="flex flex-col rounded-xl border border-emerald-200 bg-emerald-50 p-4 hover:bg-emerald-100 transition-colors min-h-[44px]"
            >
              <span className="font-semibold text-emerald-900">Profit &amp; Loss</span>
              <span className="text-sm text-emerald-600">P&amp;L statement</span>
            </a>
            <a
              href="/reports"
              className="flex flex-col rounded-xl border border-purple-200 bg-purple-50 p-4 hover:bg-purple-100 transition-colors min-h-[44px]"
            >
              <span className="font-semibold text-purple-900">Reports</span>
              <span className="text-sm text-purple-600">Aging &amp; ledgers</span>
            </a>
          </>
        )}
      </div>
    </div>
  )
}

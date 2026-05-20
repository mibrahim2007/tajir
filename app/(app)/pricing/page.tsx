import { eq } from 'drizzle-orm'
import Link from 'next/link'
import { History } from 'lucide-react'
import { requireAuth } from '@/lib/auth/require-auth'
import { db } from '@/db'
import { customerPriceLists, tajirCustomers, inventoryLots } from '@/db/schema'
import { SetPriceForm } from './set-price-form'
import { DeleteButton } from '@/components/delete-button'
import { Button } from '@/components/ui/button'
import { deletePricingRuleAction } from '@/app/actions/delete-pricing-rule'
import { formatPKR } from '@/lib/utils/currency'

export default async function PricingPage() {
  const { tenantId, role } = await requireAuth()

  const [rules, customers, stockItems] = await Promise.all([
    db.select().from(customerPriceLists)
      .where(eq(customerPriceLists.tenantId, tenantId)),
    db.select({ id: tajirCustomers.id, name: tajirCustomers.name }).from(tajirCustomers)
      .where(eq(tajirCustomers.tenantId, tenantId)),
    db.select({ id: inventoryLots.id, name: inventoryLots.name }).from(inventoryLots)
      .where(eq(inventoryLots.tenantId, tenantId)),
  ])

  const activeRules = rules.filter((r) => r.isActive)

  const customerMap = new Map(customers.map((c) => [c.id, c.name]))
  const itemMap = new Map(stockItems.map((s) => [s.id, s.name]))

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Customer Pricing</h1>
          <p className="text-sm text-muted-foreground mt-1">{activeRules.length} active rule{activeRules.length !== 1 ? 's' : ''}</p>
        </div>
        {role === 'owner' && <SetPriceForm customers={customers} stockItems={stockItems} />}
      </div>

      {activeRules.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground text-sm">No custom pricing rules yet. Default rates from sales orders will be used.</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Customer</th>
                <th className="text-left px-4 py-3 font-medium">Stock Item</th>
                <th className="text-right px-4 py-3 font-medium">Rate (PKR)</th>
                <th className="text-right px-4 py-3 font-medium">Since</th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {activeRules.map((rule) => (
                <tr key={rule.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{customerMap.get(rule.customerId) ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{itemMap.get(rule.stockItemId) ?? '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatPKR(parseFloat(rule.rate))}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground whitespace-nowrap">
                    {rule.effectiveFrom.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button asChild variant="ghost" size="sm" className="min-h-[44px]">
                        <Link href={`/pricing/${rule.customerId}/${rule.stockItemId}/history`}>
                          <History className="h-4 w-4" />
                        </Link>
                      </Button>
                      {role === 'owner' && (
                        <DeleteButton
                          description="Delete this pricing rule? The customer will revert to manual rate entry."
                          onDelete={() => deletePricingRuleAction({ id: rule.id })}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

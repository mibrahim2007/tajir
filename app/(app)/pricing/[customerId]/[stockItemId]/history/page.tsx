import { and, eq, desc } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireAuth } from '@/lib/auth/require-auth'
import { db } from '@/db'
import { customerPriceLists, tajirCustomers, inventoryLots } from '@/db/schema'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'
import { Button } from '@/components/ui/button'

type Props = { params: Promise<{ customerId: string; stockItemId: string }> }

export default async function PricingHistoryPage({ params }: Props) {
  const { tenantId, role } = await requireAuth()
  if (role !== 'owner') notFound()

  const { customerId, stockItemId } = await params

  const [rules, customer, item] = await Promise.all([
    db.select().from(customerPriceLists)
      .where(and(
        eq(customerPriceLists.tenantId, tenantId),
        eq(customerPriceLists.customerId, customerId),
        eq(customerPriceLists.stockItemId, stockItemId),
      ))
      .orderBy(desc(customerPriceLists.effectiveFrom)),
    db.select({ name: tajirCustomers.name }).from(tajirCustomers)
      .where(and(eq(tajirCustomers.id, customerId), eq(tajirCustomers.tenantId, tenantId)))
      .limit(1).then((r) => r[0] ?? null),
    db.select({ name: inventoryLots.name }).from(inventoryLots)
      .where(and(eq(inventoryLots.id, stockItemId), eq(inventoryLots.tenantId, tenantId)))
      .limit(1).then((r) => r[0] ?? null),
  ])

  if (!customer || !item) notFound()

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Pricing History</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {customer.name} — {item.name}
          </p>
        </div>
        <Button asChild variant="outline" className="min-h-[44px]">
          <Link href="/pricing">Back to Pricing</Link>
        </Button>
      </div>

      {rules.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground text-sm">No pricing history found.</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-right px-4 py-3 font-medium">Rate (PKR)</th>
                <th className="text-left px-4 py-3 font-medium">Effective From</th>
                <th className="text-left px-4 py-3 font-medium">Superseded At</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{formatPKR(parseFloat(rule.rate))}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatPKTDate(new Date(rule.effectiveFrom))}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {rule.supersededAt ? formatPKTDate(new Date(rule.supersededAt)) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {rule.isActive ? (
                      <span className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">Active</span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Superseded</span>
                    )}
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

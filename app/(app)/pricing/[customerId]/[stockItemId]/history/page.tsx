import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'
import { Button } from '@/components/ui/button'

type Props = { params: Promise<{ customerId: string; stockItemId: string }> }

export default async function PricingHistoryPage({ params }: Props) {
  const { tenantId, role } = await requireAuth()
  if (role !== 'owner') notFound()

  const { customerId, stockItemId } = await params

  const admin = createAdminClient()

  const [{ data: rawRules }, { data: rawCustomer }, { data: rawItem }] = await Promise.all([
    admin.from('customer_price_lists')
      .select('id, rate, is_active, effective_from, superseded_at')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .eq('stock_item_id', stockItemId)
      .order('effective_from', { ascending: false }),
    admin.from('tajir_customers')
      .select('name')
      .eq('id', customerId)
      .eq('tenant_id', tenantId)
      .single(),
    admin.from('inventory_lots')
      .select('name')
      .eq('id', stockItemId)
      .eq('tenant_id', tenantId)
      .single(),
  ])

  if (!rawCustomer || !rawItem) notFound()

  const rules = rawRules ?? []

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Pricing History</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {rawCustomer.name} — {rawItem.name}
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
                  <td className="px-4 py-3 whitespace-nowrap">{formatPKTDate(new Date(rule.effective_from))}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {rule.superseded_at ? formatPKTDate(new Date(rule.superseded_at)) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {rule.is_active ? (
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

import Link from 'next/link'
import { History } from 'lucide-react'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { SetPriceForm } from './set-price-form'
import { DeleteButton } from '@/components/delete-button'
import { Button } from '@/components/ui/button'
import { deletePricingRuleAction } from '@/app/actions/delete-pricing-rule'
import { formatPKR } from '@/lib/utils/currency'

export default async function PricingPage() {
  const { tenantId, role } = await requireAuth()
  const admin = createAdminClient()

  const [{ data: rawRules }, { data: rawCustomers }, { data: rawItems }] = await Promise.all([
    admin.from('customer_price_lists')
      .select('id, customer_id, stock_item_id, rate, is_active, effective_from')
      .eq('tenant_id', tenantId),
    admin.from('tajir_customers').select('id, name').eq('tenant_id', tenantId),
    admin.from('inventory_lots').select('id, name').eq('tenant_id', tenantId),
  ])

  const rules = rawRules ?? []
  const customers = rawCustomers ?? []
  const stockItems = rawItems ?? []

  const activeRules = rules.filter((r) => r.is_active)

  const customerMap = new Map(customers.map((c) => [c.id, c.name]))
  const itemMap = new Map(stockItems.map((s) => [s.id, s.name]))

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Customer Pricing</h1>
          <p className="text-sm text-muted-foreground mt-1">{activeRules.length} active rule{activeRules.length !== 1 ? 's' : ''}</p>
        </div>
        {role === 'owner' && <SetPriceForm customers={customers} stockItems={stockItems} />}
      </div>

      {activeRules.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed py-16 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">No custom pricing rules yet. Default rates from sales orders will be used.</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Customer</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Stock Item</th>
                <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Rate (PKR)</th>
                <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Since</th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {activeRules.map((rule) => (
                <tr key={rule.id} className="hover:bg-secondary/50 transition-colors">
                  <td className="px-4 py-3 font-medium">{customerMap.get(rule.customer_id) ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{itemMap.get(rule.stock_item_id) ?? '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatPKR(parseFloat(rule.rate))}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground whitespace-nowrap">
                    {new Date(rule.effective_from).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button asChild variant="ghost" size="sm" className="min-h-[44px]">
                        <Link href={`/pricing/${rule.customer_id}/${rule.stock_item_id}/history`}>
                          <History className="h-4 w-4" />
                        </Link>
                      </Button>
                      {role === 'owner' && (
                        <DeleteButton
                          description="Delete this pricing rule? The customer will revert to manual rate entry."
                          onDelete={deletePricingRuleAction.bind(null, { id: rule.id })}
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

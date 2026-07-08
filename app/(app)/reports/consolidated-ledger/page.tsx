import Link from 'next/link'
import { ArrowRight, Link2 } from 'lucide-react'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { RoleGate } from '@/components/role-gate'
import { DeleteButton } from '@/components/delete-button'
import { deletePartyLinkAction } from '@/app/actions/delete-party-link'
import { buildConsolidatedLedger } from '@/lib/ledger/consolidated'
import { formatPKR } from '@/lib/utils/currency'
import { MapAccountsForm } from './map-accounts-form'

export default async function ConsolidatedLedgerIndexPage() {
  const { tenantId, role } = await requireAuth()
  const isOwner = role === 'owner'
  const admin = createAdminClient()

  const [{ data: links }, { data: customers }, { data: suppliers }, { data: lots }] = await Promise.all([
    admin.from('party_links').select('id, customer_id, supplier_id').eq('tenant_id', tenantId),
    admin.from('tajir_customers').select('id, name').eq('tenant_id', tenantId).order('name'),
    admin.from('suppliers').select('id, name').eq('tenant_id', tenantId).order('name'),
    admin.from('inventory_lots').select('id, name').eq('tenant_id', tenantId),
  ])

  const customerName = new Map((customers ?? []).map((c) => [c.id, c.name]))
  const supplierName = new Map((suppliers ?? []).map((s) => [s.id, s.name]))
  const lotMap = new Map((lots ?? []).map((l) => [l.id, l.name]))

  // Net balance per mapping (shares one preloaded item-name map).
  const rows = await Promise.all(
    (links ?? []).map(async (link) => {
      const { netBalance } = await buildConsolidatedLedger(tenantId, link.customer_id, link.supplier_id, lotMap)
      return {
        id: link.id,
        customer: customerName.get(link.customer_id) ?? 'Unknown customer',
        supplier: supplierName.get(link.supplier_id) ?? 'Unknown supplier',
        netBalance,
      }
    }),
  )
  rows.sort((a, b) => a.customer.localeCompare(b.customer))

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Consolidated Ledger</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Map a customer to its supplier counterpart to view one net statement across both.
          </p>
        </div>
        <RoleGate allowedRoles={['owner']}>
          <MapAccountsForm customers={customers ?? []} suppliers={suppliers ?? []} />
        </RoleGate>
      </div>

      {rows.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed py-16 text-center shadow-sm mt-6">
          <Link2 className="h-8 w-8 mx-auto text-muted-foreground/50" />
          <p className="text-muted-foreground text-sm mt-3">
            No mapped accounts yet.{isOwner ? ' Map a customer to a supplier to get started.' : ''}
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden mt-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Customer ↔ Supplier</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Net Balance (PKR)</th>
                  <th className="px-4 py-3 w-32" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => {
                  const label = r.netBalance > 0 ? 'Party owes us' : r.netBalance < 0 ? 'We owe party' : 'Settled'
                  const color = r.netBalance > 0 ? 'text-amber-600 dark:text-amber-400' : r.netBalance < 0 ? 'text-destructive' : 'text-muted-foreground'
                  return (
                    <tr key={r.id} className="hover:bg-secondary/50 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/reports/consolidated-ledger/${r.id}`} className="font-medium hover:underline">
                          {r.customer}
                        </Link>
                        <span className="text-muted-foreground"> ↔ {r.supplier}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`tabular-nums font-medium ${color}`}>{formatPKR(Math.abs(r.netBalance))}</span>
                        <span className="block text-[11px] text-muted-foreground/70">{label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/reports/consolidated-ledger/${r.id}`}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline min-h-[44px]"
                          >
                            View <ArrowRight className="h-3 w-3" />
                          </Link>
                          <RoleGate allowedRoles={['owner']}>
                            <DeleteButton
                              label="Unmap"
                              description={`Remove the mapping between "${r.customer}" and "${r.supplier}"? Their individual records are not affected.`}
                              onDelete={deletePartyLinkAction.bind(null, { id: r.id })}
                            />
                          </RoleGate>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

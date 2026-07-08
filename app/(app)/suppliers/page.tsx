import Link from 'next/link'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { CreateSupplierForm } from './create-supplier-form'
import { EditSupplierForm } from './edit-supplier-form'
import { DeleteButton } from '@/components/delete-button'
import { RoleGate } from '@/components/role-gate'
import { deleteSupplierAction } from '@/app/actions/delete-supplier'
import { formatPKR } from '@/lib/utils/currency'

export default async function SuppliersPage() {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()

  const [{ data: allSuppliers }, { data: allPurchases }, { data: allPayments }, { data: allReturns }, { data: allDebitNotes }, { data: allRefunds }] = await Promise.all([
    admin.from('suppliers').select('id, name, opening_balance_pkr_equivalent, created_at').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
    admin.from('purchase_orders').select('supplier_id, pkr_equivalent, advance_paid').eq('tenant_id', tenantId),
    admin.from('ap_payments').select('supplier_id, pkr_equivalent').eq('tenant_id', tenantId),
    admin.from('purchase_returns').select('supplier_id, pkr_equivalent').eq('tenant_id', tenantId),
    admin.from('debit_notes').select('supplier_id, pkr_equivalent').eq('tenant_id', tenantId),
    admin.from('supplier_refunds').select('supplier_id, pkr_equivalent').eq('tenant_id', tenantId),
  ])

  const suppliers  = allSuppliers ?? []
  const purchases  = allPurchases ?? []
  const payments   = allPayments  ?? []
  const returns    = allReturns   ?? []
  const debitNotes = allDebitNotes ?? []
  const refunds    = allRefunds   ?? []

  const outstandingBySupplier = new Map<string, number>()
  for (const s of suppliers) {
    const openingBalance = s.opening_balance_pkr_equivalent  ?? 0
    const purchased = purchases
      .filter((p) => p.supplier_id === s.id)
      .reduce((sum, p) => sum + p.pkr_equivalent - p.advance_paid, 0)
    const paid = payments
      .filter((p) => p.supplier_id === s.id)
      .reduce((sum, p) => sum + p.pkr_equivalent, 0)
    const returned = returns
      .filter((r) => r.supplier_id === s.id)
      .reduce((sum, r) => sum + r.pkr_equivalent, 0)
    const debited = debitNotes
      .filter((n) => n.supplier_id === s.id)
      .reduce((sum, n) => sum + n.pkr_equivalent, 0)
    const refunded = refunds
      .filter((r) => r.supplier_id === s.id)
      .reduce((sum, r) => sum + r.pkr_equivalent, 0)
    outstandingBySupplier.set(s.id, openingBalance + purchased - paid - returned - debited + refunded)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Suppliers</h1>
          <p className="text-sm text-muted-foreground mt-1">{suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''}</p>
        </div>
        <CreateSupplierForm />
      </div>

      {suppliers.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed py-16 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">No suppliers yet. Add your first supplier to start tracking payables.</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Name</th>
                <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Outstanding (PKR)</th>
                <th className="px-4 py-3" />
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {suppliers.map((s) => {
                const outstanding = outstandingBySupplier.get(s.id) ?? 0
                return (
                  <tr key={s.id} className="hover:bg-secondary/50 transition-colors">
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className={`px-4 py-3 text-right tabular-nums ${outstanding > 0 ? 'text-destructive' : outstanding < 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                      {formatPKR(Math.abs(outstanding))}
                      {outstanding < 0 && <span className="ml-1 text-xs opacity-70">CR</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/suppliers/${s.id}/ledger`}
                        className="text-xs underline underline-offset-4 text-muted-foreground hover:text-foreground"
                      >
                        Ledger
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <RoleGate allowedRoles={['owner']}>
                        <div className="flex gap-1 justify-end">
                          <EditSupplierForm id={s.id} currentName={s.name} />
                          <DeleteButton
                            description={`Delete supplier "${s.name}"? This cannot be undone.`}
                            onDelete={deleteSupplierAction.bind(null, { id: s.id })}
                          />
                        </div>
                      </RoleGate>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

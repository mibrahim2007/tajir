import Link from 'next/link'
import { Plus } from 'lucide-react'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'
import { RoleGate } from '@/components/role-gate'
import { DeletePaymentButton } from './delete-payment-button'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'

export default async function PaymentsPage() {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()

  const [{ data: rawPayments }, { data: rawSuppliers }] = await Promise.all([
    admin.from('ap_payments')
      .select('id, supplier_id, date, amount, currency_code, pkr_equivalent, payment_method_note')
      .eq('tenant_id', tenantId)
      .order('date', { ascending: false }),
    admin.from('suppliers')
      .select('id, name')
      .eq('tenant_id', tenantId),
  ])

  const payments = rawPayments ?? []
  const supplierMap = new Map((rawSuppliers ?? []).map((s) => [s.id, s.name]))

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Payments</h1>
          <p className="text-sm text-muted-foreground mt-1">{payments.length} payment{payments.length !== 1 ? 's' : ''}</p>
        </div>
        <RoleGate allowedRoles={['owner']}>
          <Button asChild className="min-h-[44px]">
            <Link href="/payments/new"><Plus className="h-4 w-4 mr-2" />New Payment</Link>
          </Button>
        </RoleGate>
      </div>

      {payments.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed py-16 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">No payments yet.</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Date</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Supplier</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Note</th>
                <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Amount (PKR)</th>
                <th className="px-4 py-3 w-16" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-secondary/50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap text-xs">
                    {formatPKTDate(p.date + 'T00:00:00')}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {supplierMap.get(p.supplier_id) ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {p.payment_method_note || '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatPKR(parseFloat(p.pkr_equivalent))}
                    {p.currency_code !== 'PKR' && (
                      <span className="ml-1 text-xs text-muted-foreground">({p.currency_code} {parseFloat(p.amount).toLocaleString()})</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <RoleGate allowedRoles={['owner']}>
                      <DeletePaymentButton id={p.id} />
                    </RoleGate>
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

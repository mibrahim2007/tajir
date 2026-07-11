import Link from 'next/link'
import { Plus, Printer, Pencil } from 'lucide-react'
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
      .select('id, serial_number, supplier_id, date, amount, currency_code, pkr_equivalent, payment_method_note')
      .eq('tenant_id', tenantId)
      .order('date', { ascending: false }),
    admin.from('suppliers')
      .select('id, name')
      .eq('tenant_id', tenantId),
  ])

  const payments = rawPayments ?? []
  const supplierMap = new Map((rawSuppliers ?? []).map((s) => [s.id, s.name]))

  const rowActions = (p: (typeof payments)[number]) => (
    <div className="flex items-center gap-1">
      <Link href={`/payments/${p.id}/print`}>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
          <Printer className="h-4 w-4" />
        </Button>
      </Link>
      <RoleGate allowedRoles={['owner']}>
        <Link href={`/payments/${p.id}/edit`}>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
            <Pencil className="h-4 w-4" />
          </Button>
        </Link>
        <DeletePaymentButton id={p.id} />
      </RoleGate>
    </div>
  )

  const amountCell = (p: (typeof payments)[number]) => (
    <>
      {formatPKR(p.pkr_equivalent)}
      {p.currency_code !== 'PKR' && (
        <span className="ml-1 text-xs text-muted-foreground">({p.currency_code} {p.amount.toLocaleString()})</span>
      )}
    </>
  )

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Payments</h1>
          <p className="text-sm text-muted-foreground mt-1">{payments.length} payment{payments.length !== 1 ? 's' : ''}</p>
        </div>
        <Button asChild className="min-h-[44px]">
          <Link href="/payments/new"><Plus className="h-4 w-4 mr-2" />New Payment</Link>
        </Button>
      </div>

      {payments.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed py-16 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">No payments yet.</p>
        </div>
      ) : (
        <>
          {/* Mobile (< md): stacked cards */}
          <div className="md:hidden divide-y divide-border rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            {payments.map((p) => (
              <div key={p.id} className="p-4 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-xs break-words">{p.serial_number ?? '—'}</div>
                    <div className="text-xs text-muted-foreground">{formatPKTDate(p.date + 'T00:00:00')}</div>
                  </div>
                  <div className="shrink-0">{rowActions(p)}</div>
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">Supplier</dt>
                  <dd className="text-right font-medium break-words">{supplierMap.get(p.supplier_id) ?? '—'}</dd>
                  {p.payment_method_note && (
                    <>
                      <dt className="text-muted-foreground">Note</dt>
                      <dd className="text-right break-words">{p.payment_method_note}</dd>
                    </>
                  )}
                  <dt className="text-muted-foreground">Amount</dt>
                  <dd className="text-right font-semibold tabular-nums">{amountCell(p)}</dd>
                </dl>
              </div>
            ))}
          </div>

          {/* Desktop (>= md): table */}
          <div className="max-md:hidden bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Serial #</th>
                  <th className="text-left px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Date</th>
                  <th className="text-left px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Supplier</th>
                  <th className="text-left px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Note</th>
                  <th className="text-right px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Amount (PKR)</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-secondary/50 transition-colors align-top">
                    <td className="px-3 py-3 whitespace-nowrap font-mono text-xs">{p.serial_number ?? '—'}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-xs">{formatPKTDate(p.date + 'T00:00:00')}</td>
                    <td className="px-3 py-3 font-medium break-words">{supplierMap.get(p.supplier_id) ?? '—'}</td>
                    <td className="px-3 py-3 text-muted-foreground text-xs break-words">{p.payment_method_note || '—'}</td>
                    <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">{amountCell(p)}</td>
                    <td className="px-3 py-3"><div className="flex justify-end">{rowActions(p)}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

import Link from 'next/link'
import { Plus, Printer } from 'lucide-react'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'
import { RoleGate } from '@/components/role-gate'
import { DeleteReceiptButton } from './delete-receipt-button'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'

export default async function ReceiptsPage() {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()

  const [{ data: rawReceipts }, { data: rawCustomers }] = await Promise.all([
    admin.from('ar_receipts')
      .select('id, serial_number, customer_id, date, amount, currency_code, pkr_equivalent, payment_method_note')
      .eq('tenant_id', tenantId)
      .order('date', { ascending: false }),
    admin.from('tajir_customers')
      .select('id, name')
      .eq('tenant_id', tenantId),
  ])

  const receipts = rawReceipts ?? []
  const customerMap = new Map((rawCustomers ?? []).map((c) => [c.id, c.name]))

  const rowActions = (r: (typeof receipts)[number]) => (
    <div className="flex items-center gap-1">
      <Link href={`/receipts/${r.id}/print`}>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
          <Printer className="h-4 w-4" />
        </Button>
      </Link>
      <RoleGate allowedRoles={['owner']}>
        <DeleteReceiptButton id={r.id} />
      </RoleGate>
    </div>
  )

  const amountCell = (r: (typeof receipts)[number]) => (
    <>
      {formatPKR(r.pkr_equivalent)}
      {r.currency_code !== 'PKR' && (
        <span className="ml-1 text-xs text-muted-foreground">({r.currency_code} {r.amount.toLocaleString()})</span>
      )}
    </>
  )

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Receipts</h1>
          <p className="text-sm text-muted-foreground mt-1">{receipts.length} receipt{receipts.length !== 1 ? 's' : ''}</p>
        </div>
        <Button asChild className="min-h-[44px]">
          <Link href="/receipts/new"><Plus className="h-4 w-4 mr-2" />New Receipt</Link>
        </Button>
      </div>

      {receipts.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed py-16 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">No receipts yet.</p>
        </div>
      ) : (
        <>
          {/* Mobile (< md): stacked cards */}
          <div className="md:hidden divide-y divide-border rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            {receipts.map((r) => (
              <div key={r.id} className="p-4 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-xs break-words">{r.serial_number ?? '—'}</div>
                    <div className="text-xs text-muted-foreground">{formatPKTDate(r.date + 'T00:00:00')}</div>
                  </div>
                  <div className="shrink-0">{rowActions(r)}</div>
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">Customer</dt>
                  <dd className="text-right font-medium break-words">{customerMap.get(r.customer_id) ?? '—'}</dd>
                  {r.payment_method_note && (
                    <>
                      <dt className="text-muted-foreground">Note</dt>
                      <dd className="text-right break-words">{r.payment_method_note}</dd>
                    </>
                  )}
                  <dt className="text-muted-foreground">Amount</dt>
                  <dd className="text-right font-semibold tabular-nums">{amountCell(r)}</dd>
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
                  <th className="text-left px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Customer</th>
                  <th className="text-left px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Note</th>
                  <th className="text-right px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Amount (PKR)</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {receipts.map((r) => (
                  <tr key={r.id} className="hover:bg-secondary/50 transition-colors align-top">
                    <td className="px-3 py-3 whitespace-nowrap font-mono text-xs">{r.serial_number ?? '—'}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-xs">{formatPKTDate(r.date + 'T00:00:00')}</td>
                    <td className="px-3 py-3 font-medium break-words">{customerMap.get(r.customer_id) ?? '—'}</td>
                    <td className="px-3 py-3 text-muted-foreground text-xs break-words">{r.payment_method_note || '—'}</td>
                    <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">{amountCell(r)}</td>
                    <td className="px-3 py-3"><div className="flex justify-end">{rowActions(r)}</div></td>
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

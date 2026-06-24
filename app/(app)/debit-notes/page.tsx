import Link from 'next/link'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'
import { DeleteButton } from '@/components/delete-button'
import { RoleGate } from '@/components/role-gate'
import { deleteDebitNoteAction } from '@/app/actions/delete-debit-note'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'

export default async function DebitNotesPage() {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()

  const [{ data: rawNotes }, { data: rawSuppliers }] = await Promise.all([
    admin.from('debit_notes')
      .select('id, date, amount, currency_code, exchange_rate, pkr_equivalent, supplier_id, purchase_order_id, reason, reference')
      .eq('tenant_id', tenantId)
      .order('date', { ascending: false })
      .limit(300),
    admin.from('suppliers').select('id, name').eq('tenant_id', tenantId).order('name'),
  ])

  const notes = rawNotes ?? []
  const supplierMap = new Map((rawSuppliers ?? []).map((s) => [s.id, s.name]))

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Debit Notes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {notes.length} record{notes.length !== 1 ? 's' : ''} — financial deductions claimed from suppliers
          </p>
        </div>
        <Link href="/debit-notes/new">
          <Button className="min-h-[44px]">New Debit Note</Button>
        </Link>
      </div>

      {notes.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed py-16 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">No debit notes yet.</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Supplier</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Amount</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">PKR Total</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Reference</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Reason</th>
                  <th className="px-4 py-3 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {notes.map((n) => (
                  <tr key={n.id} className="hover:bg-secondary/50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">{formatPKTDate(new Date(n.date))}</td>
                    <td className="px-4 py-3">{supplierMap.get(n.supplier_id) ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{n.currency_code} {parseFloat(n.amount).toLocaleString('en-PK', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatPKR(parseFloat(n.pkr_equivalent))}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{n.reference ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{n.reason ?? '—'}</td>
                    <td className="px-4 py-3">
                      <RoleGate allowedRoles={['owner']}>
                        <DeleteButton
                          description="Delete this debit note? The GL journal entry will also be reversed."
                          onDelete={deleteDebitNoteAction.bind(null, { id: n.id })}
                        />
                      </RoleGate>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

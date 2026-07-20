import { notFound } from 'next/navigation'
import { PeriodLockBanner } from "@/components/period-lock-banner"
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { EditSupplierRefundForm } from '@/app/(app)/suppliers/edit-supplier-refund-form'
import type { TenderLine } from '@/components/tender-lines-field'

export default async function EditSupplierRefundPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tenantId, role } = await requireAuth()
  if (role !== 'owner') {
    return <div className="p-6"><p className="text-muted-foreground">Access denied.</p></div>
  }

  const admin = createAdminClient()

  const [{ data: refund }, { data: rawLines }, { data: rawBanks }] = await Promise.all([
    admin.from('supplier_refunds')
      .select('id, supplier_id, amount, currency_code, exchange_rate, pkr_equivalent, payment_method, notes, date')
      .eq('id', id).eq('tenant_id', tenantId).single(),
    admin.from('supplier_refund_lines')
      .select('transaction_type, cheque_number, bank_id, amount, line_no')
      .eq('refund_id', id).eq('tenant_id', tenantId).order('line_no'),
    admin.from('banks').select('id, name, account_number').eq('tenant_id', tenantId).order('name'),
  ])

  if (!refund) notFound()

  const { data: supplier } = await admin
    .from('suppliers').select('id, name').eq('id', refund.supplier_id).single()

  const banks = rawBanks ?? []
  const currency = (refund.currency_code === 'USD' ? 'USD' : 'PKR') as 'PKR' | 'USD'
  const exchangeRate = refund.exchange_rate ?? 1

  // Legacy single-tender refunds have no lines — seed one from the header, mapping
  // the old payment_method to a tender type (bank transfer → Online = Cash at Bank).
  const fallbackType: TenderLine['transactionType'] = refund.payment_method === 'bank_transfer' ? 'online' : 'cash'
  const lines: TenderLine[] = (rawLines && rawLines.length > 0)
    ? rawLines.map((l) => ({
        transactionType: l.transaction_type as TenderLine['transactionType'],
        chequeNumber: l.cheque_number ?? '',
        bankId: l.bank_id ?? '',
        amount: Number(l.amount),
      }))
    : [{ transactionType: fallbackType, chequeNumber: '', bankId: '', amount: Number(refund.amount) }]

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <PeriodLockBanner className="mb-4" />
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Edit Supplier Refund</h1>
        <p className="text-sm text-muted-foreground mt-1">Update the tender breakdown; the ledger re-posts automatically.</p>
      </div>
      <EditSupplierRefundForm
        refundId={refund.id}
        supplierName={supplier?.name ?? '—'}
        banks={banks}
        initial={{ currencyCode: currency, exchangeRate, date: refund.date, notes: refund.notes ?? '', lines }}
      />
    </div>
  )
}

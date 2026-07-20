import { notFound } from 'next/navigation'
import { PeriodLockBanner } from "@/components/period-lock-banner"
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { PaymentForm } from '@/app/(app)/payments/new/create-payment-form'
import type { TenderLine } from '@/components/tender-lines-field'

export default async function EditPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tenantId, role } = await requireAuth()
  if (role !== 'owner') {
    return <div className="p-6"><p className="text-muted-foreground">Access denied.</p></div>
  }

  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const [{ data: payment }, { data: rawLines }, { data: rawBanks }] = await Promise.all([
    admin.from('ap_payments')
      .select('id, supplier_id, amount, currency_code, pkr_equivalent, payment_method_note, date, cheque_number, bank_id')
      .eq('id', id).eq('tenant_id', tenantId).single(),
    admin.from('ap_payment_lines')
      .select('transaction_type, cheque_number, cheque_due_date, bank_id, amount, line_no')
      .eq('payment_id', id).eq('tenant_id', tenantId).order('line_no'),
    admin.from('banks').select('id, name, account_number').eq('tenant_id', tenantId).order('name'),
  ])

  if (!payment) notFound()

  const { data: supplier } = await admin
    .from('suppliers').select('id, name').eq('id', payment.supplier_id).single()

  const banks = rawBanks ?? []
  const currency = (payment.currency_code === 'USD' ? 'USD' : 'PKR') as 'PKR' | 'USD'
  const exchangeRate = currency === 'USD' && payment.amount > 0 ? payment.pkr_equivalent / payment.amount : 1

  const lines: TenderLine[] = (rawLines && rawLines.length > 0)
    ? rawLines.map((l) => ({
        transactionType: l.transaction_type as TenderLine['transactionType'],
        chequeNumber: l.cheque_number ?? '',
        chequeDueDate: l.cheque_due_date ?? '',
        bankId: l.bank_id ?? '',
        amount: Number(l.amount),
      }))
    : [{
        transactionType: payment.bank_id ? 'online' : 'cash',
        chequeNumber: payment.cheque_number ?? '',
        chequeDueDate: '',
        bankId: payment.bank_id ?? '',
        amount: Number(payment.amount),
      }]

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PeriodLockBanner className="mb-4" />
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Edit Payment</h1>
        <p className="text-sm text-muted-foreground mt-1">Update the tender breakdown; the ledger re-posts automatically.</p>
      </div>
      <PaymentForm
        today={today}
        suppliers={supplier ? [{ id: supplier.id, name: supplier.name, outstanding: 0 }] : []}
        purchasesBySupplier={{}}
        banks={banks}
        mode="edit"
        paymentId={payment.id}
        initial={{
          supplierId: payment.supplier_id,
          currencyCode: currency,
          exchangeRate,
          date: payment.date,
          paymentMethodNote: payment.payment_method_note ?? '',
          lines,
        }}
      />
    </div>
  )
}

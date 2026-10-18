import { notFound } from 'next/navigation'
import { PeriodLockBanner } from "@/components/period-lock-banner"
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { PaymentForm } from '@/app/(app)/payments/new/create-payment-form'
import type { TenderLine } from '@/components/tender-lines-field'
import { loadInvoicePayables, openDocs } from '@/lib/payables/invoice-payables'

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
      .select('transaction_type, cheque_number, cheque_due_date, bank_id, amount, line_no, endorsed_from_source, endorsed_from_line_id')
      .eq('payment_id', id).eq('tenant_id', tenantId).order('line_no'),
    admin.from('banks').select('id, name, account_number').eq('tenant_id', tenantId).order('name'),
  ])

  if (!payment) notFound()

  const [{ data: supplier }, { data: rawAllocations }, [payables]] = await Promise.all([
    admin.from('suppliers').select('id, name').eq('id', payment.supplier_id).single(),
    admin.from('ap_payment_allocations').select('invoice_key, amount').eq('payment_id', id).eq('tenant_id', tenantId),
    // Left out of the settlement, so its own bills show what they were open
    // for before this payment.
    loadInvoicePayables(admin, tenantId, { supplierId: payment.supplier_id, excludePaymentId: id }),
  ])
  const openInvoices = (payables ? openDocs(payables) : [])
    .filter((d) => !d.isOpening)
    .map((d) => ({ key: d.key, serial: d.serial, ref: d.ref, date: d.date, dueDate: d.dueDate, amount: d.amount, balance: d.balance }))
  // An allocation to a bill that has since been deleted is dropped on save.
  const openKeys = new Set(openInvoices.map((i) => i.key))
  const allocations = Object.fromEntries((rawAllocations ?? [])
    .filter((a) => openKeys.has(a.invoice_key))
    .map((a) => [a.invoice_key, Number(a.amount)]))

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
        // Must round-trip: the edit action replaces all lines, so a dropped
        // link would strand the cheque as 'endorsed' with nothing behind it.
        endorsedFromSource: l.endorsed_from_source ?? '',
        endorsedFromLineId: l.endorsed_from_line_id ?? '',
      }))
    : [{
        transactionType: payment.bank_id ? 'online' : 'cash',
        chequeNumber: payment.cheque_number ?? '',
        chequeDueDate: '',
        bankId: payment.bank_id ?? '',
        amount: Number(payment.amount),
        endorsedFromSource: '',
        endorsedFromLineId: '',
      }]

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      <PeriodLockBanner className="mb-4" />
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Edit Payment</h1>
        <p className="text-sm text-muted-foreground mt-1">Update the tender breakdown; the ledger re-posts automatically.</p>
      </div>
      <PaymentForm
        today={today}
        suppliers={supplier ? [{ id: supplier.id, name: supplier.name, outstanding: 0 }] : []}
        openInvoicesBySupplier={{ [payment.supplier_id]: openInvoices }}
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
          allocations,
        }}
      />
    </div>
  )
}

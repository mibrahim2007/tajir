import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { ReceiptForm } from '@/app/(app)/receipts/new/create-receipt-form'
import type { TenderLine } from '@/components/tender-lines-field'

export default async function EditReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tenantId, role } = await requireAuth()
  if (role !== 'owner') {
    return <div className="p-6"><p className="text-muted-foreground">Access denied.</p></div>
  }

  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const [{ data: receipt }, { data: rawLines }, { data: rawBanks }] = await Promise.all([
    admin.from('ar_receipts')
      .select('id, customer_id, amount, currency_code, pkr_equivalent, payment_method_note, date, cheque_number, bank_id')
      .eq('id', id).eq('tenant_id', tenantId).single(),
    admin.from('ar_receipt_lines')
      .select('transaction_type, cheque_number, bank_id, amount, line_no')
      .eq('receipt_id', id).eq('tenant_id', tenantId).order('line_no'),
    admin.from('banks').select('id, name, account_number').eq('tenant_id', tenantId).order('name'),
  ])

  if (!receipt) notFound()

  const { data: customer } = await admin
    .from('tajir_customers').select('id, name').eq('id', receipt.customer_id).single()

  const banks = rawBanks ?? []
  const currency = (receipt.currency_code === 'USD' ? 'USD' : 'PKR') as 'PKR' | 'USD'
  const exchangeRate = currency === 'USD' && receipt.amount > 0 ? receipt.pkr_equivalent / receipt.amount : 1

  // Existing tender lines, or synthesize one from the legacy header fields.
  const lines: TenderLine[] = (rawLines && rawLines.length > 0)
    ? rawLines.map((l) => ({
        transactionType: l.transaction_type as TenderLine['transactionType'],
        chequeNumber: l.cheque_number ?? '',
        bankId: l.bank_id ?? '',
        amount: Number(l.amount),
      }))
    : [{
        transactionType: receipt.bank_id ? 'online' : 'cash',
        chequeNumber: receipt.cheque_number ?? '',
        bankId: receipt.bank_id ?? '',
        amount: Number(receipt.amount),
      }]

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Edit Receipt</h1>
        <p className="text-sm text-muted-foreground mt-1">Update the tender breakdown; the ledger re-posts automatically.</p>
      </div>
      <ReceiptForm
        today={today}
        customers={customer ? [{ id: customer.id, name: customer.name, outstanding: 0 }] : []}
        salesByCustomer={{}}
        banks={banks}
        mode="edit"
        receiptId={receipt.id}
        initial={{
          customerId: receipt.customer_id,
          currencyCode: currency,
          exchangeRate,
          date: receipt.date,
          paymentMethodNote: receipt.payment_method_note ?? '',
          lines,
        }}
      />
    </div>
  )
}

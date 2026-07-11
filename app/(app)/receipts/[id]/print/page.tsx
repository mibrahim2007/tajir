import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTenant } from '@/lib/auth/get-tenant'
import { PrintVoucherHeader } from '@/components/print-voucher-header'
import { Button } from '@/components/ui/button'
import { PrintButton } from './print-button'
import { formatPKTDate, formatPKTDateTime } from '@/lib/utils/dates'

function fmt(n: number) {
  return n.toLocaleString('en-PK', { maximumFractionDigits: 2 })
}

export default async function PrintReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()

  const [{ data: receipt }, tenant] = await Promise.all([
    admin.from('ar_receipts')
      .select('id, serial_number, date, created_at, customer_id, amount, currency_code, pkr_equivalent, payment_method_note, cheque_number, bank_id')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single(),
    getTenant(tenantId),
  ])

  if (!receipt) notFound()

  const [
    { data: customer },
    { data: bank },
    { data: journalEntry },
    { data: rawLines },
    { data: allBanks },
  ] = await Promise.all([
    admin.from('tajir_customers').select('id, name').eq('id', receipt.customer_id).single(),
    receipt.bank_id
      ? admin.from('banks').select('id, name, account_number').eq('id', receipt.bank_id).single()
      : Promise.resolve({ data: null }),
    admin.from('tajir_journal_entries')
      .select('voucher_number')
      .eq('source_id', id)
      .eq('source_type', 'ar_receipt')
      .single(),
    admin.from('ar_receipt_lines')
      .select('transaction_type, cheque_number, bank_id, amount, line_no')
      .eq('receipt_id', id).eq('tenant_id', tenantId).order('line_no'),
    admin.from('banks').select('id, name').eq('tenant_id', tenantId),
  ])

  const bankMap = new Map((allBanks ?? []).map((b) => [b.id, b.name]))
  const TENDER_LABELS: Record<string, string> = { cash: 'Cash', pdc: 'PDC', online: 'Online' }
  const lines = (rawLines ?? []).map((l) => ({
    type: TENDER_LABELS[l.transaction_type] ?? l.transaction_type,
    cheque: l.cheque_number ?? '',
    bank: l.bank_id ? (bankMap.get(l.bank_id) ?? '—') : '',
    amount: Number(l.amount),
  }))
  const hasLines = lines.length > 0

  const amount     = receipt.amount
  const pkrAmount  = receipt.pkr_equivalent
  const isUSD      = receipt.currency_code === 'USD'
  const voucherNo  = journalEntry?.voucher_number ?? `RC-${id.slice(-6).toUpperCase()}`
  const entryTime  = formatPKTDateTime(new Date(receipt.created_at)).split(', ')[1]

  return (
    <div className="min-h-screen bg-white">
      <div className="print:hidden flex items-center gap-3 px-6 py-4 border-b bg-background sticky top-0">
        <Link href="/receipts">
          <Button variant="ghost" size="sm">← Back</Button>
        </Link>
        <span className="text-sm text-muted-foreground flex-1">Receipt Voucher · {voucherNo}</span>
        <PrintButton />
      </div>

      <div className="max-w-2xl mx-auto px-8 py-10 print:px-4 print:py-6 print:max-w-none">

        {/* Header */}
        <PrintVoucherHeader name={tenant.name} ntn={tenant.ntn} title="Receipt Voucher" />

        {/* Meta grid */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm mb-6">
          <div className="flex gap-2">
            <span className="text-gray-500 w-28 shrink-0">Voucher No.</span>
            <span className="font-mono font-bold">{voucherNo}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-500 w-24 shrink-0">Date</span>
            <span className="font-semibold">{formatPKTDate(new Date(receipt.date))}</span>
          </div>
          {receipt.serial_number && (
            <div className="flex gap-2">
              <span className="text-gray-500 w-28 shrink-0">Serial No.</span>
              <span className="font-mono font-semibold">{receipt.serial_number}</span>
            </div>
          )}
          <div className="flex gap-2">
            <span className="text-gray-500 w-28 shrink-0">Customer</span>
            <span className="font-semibold">{customer?.name ?? '—'}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-500 w-24 shrink-0">Time</span>
            <span className="text-gray-700">{entryTime}</span>
          </div>
          {bank && (
            <div className="flex gap-2">
              <span className="text-gray-500 w-28 shrink-0">Bank</span>
              <span className="font-semibold">
                {bank.name}{bank.account_number ? ` — ${bank.account_number}` : ''}
              </span>
            </div>
          )}
          {receipt.cheque_number && (
            <div className="flex gap-2">
              <span className="text-gray-500 w-28 shrink-0">Cheque No.</span>
              <span className="font-semibold font-mono">{receipt.cheque_number}</span>
            </div>
          )}
          {receipt.payment_method_note && (
            <div className="flex gap-2 col-span-2">
              <span className="text-gray-500 w-28 shrink-0">Note</span>
              <span>{receipt.payment_method_note}</span>
            </div>
          )}
        </div>

        {/* Amount table */}
        <table className="w-full text-sm mb-8 border border-gray-300">
          <thead className="bg-gray-100 print:bg-gray-100">
            <tr>
              <th className="text-left px-4 py-2 border-b border-r border-gray-300 font-semibold text-[11px] uppercase tracking-wide">Description</th>
              <th className="text-right px-4 py-2 border-b border-gray-300 font-semibold text-[11px] uppercase tracking-wide w-40">Amount (PKR)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-4 py-3 border-r border-gray-200">
                Receipt from {customer?.name ?? '—'}
                {isUSD && (
                  <span className="ml-2 text-gray-500 text-xs">
                    (USD {fmt(amount)} @ {fmt(pkrAmount / amount)})
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-right tabular-nums font-medium">
                Rs {fmt(pkrAmount)}
              </td>
            </tr>
          </tbody>
          <tfoot className="border-t-2 border-gray-300 bg-gray-50 print:bg-gray-100">
            <tr>
              <td className="px-4 py-2 text-right font-semibold text-[11px] uppercase tracking-wide border-r border-gray-300">Total Received</td>
              <td className="px-4 py-2 text-right font-bold tabular-nums text-base">
                Rs {fmt(pkrAmount)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Tender breakdown */}
        {hasLines && (
          <table className="w-full text-sm mb-8 border border-gray-300">
            <thead className="bg-gray-100 print:bg-gray-100">
              <tr>
                <th className="text-left px-4 py-2 border-b border-r border-gray-300 font-semibold text-[11px] uppercase tracking-wide w-24">Type</th>
                <th className="text-left px-4 py-2 border-b border-r border-gray-300 font-semibold text-[11px] uppercase tracking-wide">Cheque No.</th>
                <th className="text-left px-4 py-2 border-b border-r border-gray-300 font-semibold text-[11px] uppercase tracking-wide">Bank</th>
                <th className="text-right px-4 py-2 border-b border-gray-300 font-semibold text-[11px] uppercase tracking-wide w-32">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td className="px-4 py-2 border-r border-t border-gray-200">{l.type}</td>
                  <td className="px-4 py-2 border-r border-t border-gray-200 font-mono">{l.cheque || '—'}</td>
                  <td className="px-4 py-2 border-r border-t border-gray-200">{l.bank || '—'}</td>
                  <td className="px-4 py-2 border-t border-gray-200 text-right tabular-nums">{fmt(l.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Signatures */}
        <div className="flex justify-between mt-16 pt-4 text-sm text-center">
          <div className="w-40">
            <div className="border-t border-black pt-2 text-gray-500">Prepared By</div>
          </div>
          <div className="w-40">
            <div className="border-t border-black pt-2 text-gray-500">Paid By</div>
          </div>
          <div className="w-40">
            <div className="border-t border-black pt-2 text-gray-500">Authorized By</div>
          </div>
        </div>

      </div>
    </div>
  )
}

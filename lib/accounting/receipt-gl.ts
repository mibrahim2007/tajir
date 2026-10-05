import { createAdminClient } from '@/lib/supabase/admin'
import { aggregateMoneyLegs, DIRECT_PKR_ONLY, type TenderType } from '@/lib/constants/tender-types'

// GL for a customer receipt, shared by create-ar-receipt and edit-ar-receipt.
//
//   cash / online / pdc line  →  DR the money account (cash, bank, PDC 1112)
//   direct line               →  DR Accounts Payable, tagged with the supplier
//                                the customer paid on our behalf
//   whole receipt             →  CR Accounts Receivable, tagged with the customer
//
// So a direct line moves no money through our books: it swaps a receivable
// for a payable, which is exactly what happened.

type ReceiptLine = {
  transactionType: 'cash' | 'pdc' | 'online' | 'direct'
  amount: number
  supplierId?: string | null
  hawalaRemarks?: string | null
}

type Admin = ReturnType<typeof createAdminClient>

/**
 * Checks the direct lines before anything is written: PKR only, and every
 * supplier must belong to this tenant. Returns an error message or null.
 */
export async function checkDirectLines(
  admin: Admin,
  tenantId: string,
  lines: ReceiptLine[],
  currencyCode: string,
): Promise<string | null> {
  const direct = lines.filter((l) => l.transactionType === 'direct')
  if (direct.length === 0) return null
  // A supplier's payable is kept in rupees; a USD direct line would need its
  // own rate story on the supplier side, so it is refused rather than guessed.
  if (currencyCode !== 'PKR') return DIRECT_PKR_ONLY

  const ids = [...new Set(direct.map((l) => l.supplierId!).filter(Boolean))]
  const { data } = await admin.from('suppliers').select('id').eq('tenant_id', tenantId).in('id', ids)
  if ((data ?? []).length !== ids.length) return 'Unknown supplier on a direct payment line'
  return null
}

/** Rows for ar_receipt_lines (shared by create and edit so neither drops a column). */
export function receiptLineRows(tenantId: string, receiptId: string, lines: (ReceiptLine & {
  chequeNumber?: string | null
  chequeDueDate?: string | null
  bankId?: string | null
})[]) {
  return lines.map((l, i) => {
    const direct = l.transactionType === 'direct'
    return {
      tenant_id:        tenantId,
      receipt_id:       receiptId,
      line_no:          i + 1,
      transaction_type: l.transactionType,
      // A direct line never touched a cheque or a bank account.
      cheque_number:    direct ? null : (l.chequeNumber || null),
      cheque_due_date:  direct ? null : (l.chequeDueDate || null),
      bank_id:          direct ? null : (l.bankId || null),
      supplier_id:      direct ? (l.supplierId || null) : null,
      hawala_remarks:   direct ? (l.hawalaRemarks?.trim() || null) : null,
      amount:           l.amount,
    }
  })
}

export function receiptJournalLines(
  lines: ReceiptLine[],
  rate: number,
  customerId: string,
  pkrEquivalent: number,
) {
  const moneyLines = lines.filter((l) => l.transactionType !== 'direct')
  const moneyLegs = aggregateMoneyLegs(
    moneyLines.map((l) => ({ transactionType: l.transactionType as TenderType, amount: l.amount })),
    rate,
    'in',
  )

  // One AP debit per supplier, so two lines to the same supplier post once.
  const bySupplier = new Map<string, { pkr: number; remarks: string[] }>()
  for (const l of lines) {
    if (l.transactionType !== 'direct' || !l.supplierId) continue
    const entry = bySupplier.get(l.supplierId) ?? { pkr: 0, remarks: [] }
    entry.pkr += l.amount * rate
    if (l.hawalaRemarks?.trim()) entry.remarks.push(l.hawalaRemarks.trim())
    bySupplier.set(l.supplierId, entry)
  }

  return [
    ...moneyLegs.map((leg) => ({ accountSystemKey: leg.accountSystemKey, debit: leg.pkr, credit: 0 })),
    ...[...bySupplier.entries()].map(([supplierId, e]) => ({
      accountSystemKey: 'accounts_payable',
      debit: e.pkr,
      credit: 0,
      supplierId,
      description: ['Paid directly by customer', e.remarks.length ? `Hawala: ${e.remarks.join(', ')}` : null]
        .filter(Boolean).join(' — '),
    })),
    { accountSystemKey: 'accounts_receivable', debit: 0, credit: pkrEquivalent, customerId },
  ]
}

// Where each row of the `pdc_register` view actually lives, so a settlement can
// write the status back to the right tender-line table.
//
// The register unions seven tender-line tables plus the opening-cheque table;
// the view is the read model, this is the write map. Direction and
// counter-account come from the view itself so the rules stay in one place
// (see migrations 0040 and 0051).

export const PDC_SOURCES = {
  ar_receipt:        { table: 'ar_receipt_lines',        label: 'Customer Receipt' },
  ap_payment:        { table: 'ap_payment_lines',        label: 'Supplier Payment' },
  customer_refund:   { table: 'customer_refund_lines',   label: 'Customer Refund' },
  supplier_refund:   { table: 'supplier_refund_lines',   label: 'Supplier Refund' },
  employee_loan:     { table: 'loan_disbursement_lines', label: 'Loan Disbursement' },
  loan_repayment:    { table: 'loan_repayment_lines',    label: 'Loan Repayment' },
  owner_transaction: { table: 'owner_transaction_lines', label: 'Owner Capital Movement' },
  // A cheque that predates Tajir, loaded as an opening balance. It has no
  // parent document, so its own row is both the document and the tender line.
  pdc_opening:       { table: 'pdc_opening_cheques',     label: 'Opening Balance' },
} as const

export type PdcSource = keyof typeof PDC_SOURCES

export type PdcRegisterRow = {
  source: PdcSource
  line_id: string
  tenant_id: string
  document_id: string
  doc_serial: string | null
  doc_date: string
  party_name: string | null
  party_id: string | null
  /** Null only for an opening cheque loaded without naming a party. */
  party_kind: 'customer' | 'supplier' | 'employee' | 'owner' | null
  cheque_number: string | null
  cheque_due_date: string | null
  bank_id: string | null
  amount: number
  /** 'in' = the cheque brings money in (1112 was debited when it was recorded). */
  direction: 'in' | 'out'
  counter_key: string
  /** 'endorsed' = handed on to another party; gone from our hands but it can still bounce. */
  pdc_status: 'pending' | 'cleared' | 'bounced' | 'endorsed'
  settled_at: string | null
}

/** Maps the register's party_kind onto the journal-line dimension field. */
export function partyDimension(row: Pick<PdcRegisterRow, 'party_kind' | 'party_id'>) {
  if (!row.party_id) return {}
  switch (row.party_kind) {
    case 'customer': return { customerId: row.party_id }
    case 'supplier': return { supplierId: row.party_id }
    case 'employee': return { employeeId: row.party_id }
    case 'owner':    return { ownerId: row.party_id }
    // An opening cheque may name no party, in which case there is no subledger
    // to move and the bounce reverses to equity alone.
    default:         return {}
  }
}

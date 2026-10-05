// Receipt direct-payment check — run with `npm run check:direct-payment`.
//
// A Direct Payment receipt line means the customer paid one of our suppliers
// on our behalf. Its journal must swap a receivable for a payable — DR AP for
// that supplier, CR AR for the customer — and never touch cash or bank. Getting
// it wrong either leaves the supplier still showing as owed, or conjures cash
// that never arrived.
//
// Pure functions, no database.

import { receiptJournalLines, receiptLineRows } from '@/lib/accounting/receipt-gl'
import { receiptTenderLineSchema, tenderLineSchema, DIRECT_SUPPLIER_REQUIRED } from '@/lib/constants/tender-types'

let failures = 0
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures++
}

const CUSTOMER = '11111111-1111-4111-8111-111111111111'
const SUPP_A = '22222222-2222-4222-8222-222222222222'
const SUPP_B = '33333333-3333-4333-8333-333333333333'

const sum = (ls: { debit: number; credit: number }[], k: 'debit' | 'credit') => ls.reduce((s, l) => s + l[k], 0)

console.log('\n— A fully direct receipt moves no money —')
{
  const gl = receiptJournalLines(
    [{ transactionType: 'direct', amount: 50000, supplierId: SUPP_A, hawalaRemarks: 'HW-77' }],
    1, CUSTOMER, 50000,
  )
  check('balanced', sum(gl, 'debit') === sum(gl, 'credit'), `${sum(gl, 'debit')} / ${sum(gl, 'credit')}`)
  check('no cash or bank leg', !gl.some((l) => ['cash_in_hand', 'cash_at_bank'].includes(l.accountSystemKey)))
  const ap = gl.find((l) => l.accountSystemKey === 'accounts_payable')
  check('DR accounts payable tagged with the supplier', ap?.debit === 50000 && 'supplierId' in ap && ap.supplierId === SUPP_A)
  check('hawala remark carried into the GL line', !!ap && 'description' in ap && String(ap.description).includes('HW-77'))
  const ar = gl.find((l) => l.accountSystemKey === 'accounts_receivable')
  check('CR accounts receivable tagged with the customer', ar?.credit === 50000 && 'customerId' in ar && ar.customerId === CUSTOMER)
}

console.log('\n— A mixed receipt splits correctly —')
{
  const gl = receiptJournalLines(
    [
      { transactionType: 'cash', amount: 10000 },
      { transactionType: 'direct', amount: 20000, supplierId: SUPP_A },
      { transactionType: 'direct', amount: 5000, supplierId: SUPP_A },
      { transactionType: 'direct', amount: 7000, supplierId: SUPP_B },
    ],
    1, CUSTOMER, 42000,
  )
  check('balanced', sum(gl, 'debit') === sum(gl, 'credit'))
  check('cash leg is only the cash line', gl.find((l) => l.accountSystemKey === 'cash_in_hand')?.debit === 10000)
  const apLines = gl.filter((l) => l.accountSystemKey === 'accounts_payable')
  check('one AP line per supplier', apLines.length === 2)
  check('same-supplier lines are summed', apLines.find((l) => 'supplierId' in l && l.supplierId === SUPP_A)?.debit === 25000)
}

console.log('\n— Stored rows never mix tender detail with a supplier —')
{
  const rows = receiptLineRows('t', 'r', [
    { transactionType: 'direct', amount: 100, supplierId: SUPP_A, hawalaRemarks: '  slip 9  ', chequeNumber: 'leftover', bankId: SUPP_B },
    { transactionType: 'cash', amount: 50, supplierId: SUPP_A, hawalaRemarks: 'ignored' },
  ])
  check('direct row keeps supplier, trims remarks', rows[0].supplier_id === SUPP_A && rows[0].hawala_remarks === 'slip 9')
  check('direct row drops cheque and bank left from a type switch', rows[0].cheque_number === null && rows[0].bank_id === null)
  check('cash row carries no supplier (DB check would reject it)', rows[1].supplier_id === null && rows[1].hawala_remarks === null)
}

console.log('\n— Validation —')
{
  const missing = receiptTenderLineSchema.safeParse({ transactionType: 'direct', amount: 100 })
  check('direct without a supplier is refused', !missing.success && missing.error.issues.some((i) => i.message === DIRECT_SUPPLIER_REQUIRED))
  check('direct with a supplier is accepted', receiptTenderLineSchema.safeParse({ transactionType: 'direct', amount: 100, supplierId: SUPP_A }).success)
  check('other money documents still refuse direct', !tenderLineSchema.safeParse({ transactionType: 'direct', amount: 100, supplierId: SUPP_A }).success)
}

console.log(failures ? `\n${failures} FAILED` : '\nall passed')
process.exit(failures ? 1 : 0)

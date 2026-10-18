import type { createAdminClient } from '@/lib/supabase/admin'

type Admin = ReturnType<typeof createAdminClient>

/*
 * Posting rules: which standard account each business process debits and
 * credits, and which of those heads a tenant may redirect.
 *
 * Every posting names its accounts by chart_of_accounts.system_key. A tenant can
 * replace one of the heads listed here, for one process, with another account of
 * the same type (posting_account_overrides). Anything not listed — notably the
 * cash / bank / cheque leg, which the user already chooses on each document —
 * always posts to the standard account.
 *
 * `process` is the journal entry's source_type, so postJournalEntry can apply
 * the overrides without every action having to know about them.
 */

export type PostingSide = 'Dr' | 'Cr' | 'Dr / Cr'

export type PostingHead = {
  systemKey: string
  side:      PostingSide
  purpose:   string
}

export type PostingProcess = {
  process: string
  label:   string
  group:   'Sales' | 'Purchases' | 'Money' | 'People'
  /** The leg the user picks on the form itself, shown for context only. */
  chosenOnForm?: string
  heads:   PostingHead[]
}

const COMMISSION: PostingHead[] = [
  { systemKey: 'commission_expense',       side: 'Dr', purpose: 'Agent commission' },
  { systemKey: 'agent_commission_payable', side: 'Cr', purpose: 'Commission owed to agent' },
]
const CLAWBACK: PostingHead[] = [
  { systemKey: 'agent_commission_payable', side: 'Dr', purpose: 'Commission reversed from agent' },
  { systemKey: 'commission_expense',       side: 'Cr', purpose: 'Commission expense reversed' },
]

export const POSTING_PROCESSES: PostingProcess[] = [
  // ── Sales ──
  {
    process: 'sale_invoice', label: 'Sale Invoice', group: 'Sales',
    heads: [
      { systemKey: 'accounts_receivable', side: 'Dr',      purpose: 'Amount due from customer' },
      { systemKey: 'sales_revenue',       side: 'Cr',      purpose: 'Goods sold' },
      { systemKey: 'freight_clearing',    side: 'Dr / Cr', purpose: 'Freight recovered and paid out' },
      { systemKey: 'cash_in_hand',        side: 'Cr',      purpose: 'Freight paid in cash' },
      { systemKey: 'cogs',                side: 'Dr',      purpose: 'Cost of goods sold' },
      { systemKey: 'inventory',           side: 'Cr',      purpose: 'Stock released' },
      ...COMMISSION,
    ],
  },
  {
    process: 'sale_return', label: 'Sale Return', group: 'Sales',
    heads: [
      { systemKey: 'sales_returns_contra', side: 'Dr', purpose: 'Sales returned' },
      { systemKey: 'accounts_receivable',  side: 'Cr', purpose: 'Customer balance reduced' },
      { systemKey: 'inventory',            side: 'Dr', purpose: 'Stock returned' },
      { systemKey: 'cogs',                 side: 'Cr', purpose: 'Cost of goods reversed' },
      ...CLAWBACK,
    ],
  },
  {
    process: 'credit_note', label: 'Credit Note', group: 'Sales',
    heads: [
      { systemKey: 'sales_returns_contra', side: 'Dr', purpose: 'Allowance given' },
      { systemKey: 'accounts_receivable',  side: 'Cr', purpose: 'Customer balance reduced' },
    ],
  },
  // ── Purchases ──
  {
    process: 'purchase_invoice', label: 'Purchase Invoice', group: 'Purchases',
    heads: [
      { systemKey: 'inventory',        side: 'Dr', purpose: 'Stock received' },
      { systemKey: 'accounts_payable', side: 'Cr', purpose: 'Amount owed to supplier' },
      ...COMMISSION,
    ],
  },
  {
    process: 'purchase_return', label: 'Purchase Return', group: 'Purchases',
    heads: [
      { systemKey: 'accounts_payable', side: 'Dr', purpose: 'Supplier balance reduced' },
      { systemKey: 'inventory',        side: 'Cr', purpose: 'Stock sent back' },
      ...CLAWBACK,
    ],
  },
  {
    process: 'debit_note', label: 'Debit Note', group: 'Purchases',
    heads: [
      { systemKey: 'accounts_payable',        side: 'Dr', purpose: 'Supplier balance reduced' },
      { systemKey: 'purchase_returns_contra', side: 'Cr', purpose: 'Allowance received' },
    ],
  },
  // ── Money ──
  {
    process: 'ar_receipt', label: 'Customer Receipt', group: 'Money', chosenOnForm: 'Dr Cash / Bank / Cheque',
    heads: [{ systemKey: 'accounts_receivable', side: 'Cr', purpose: 'Customer balance received' }],
  },
  {
    process: 'ap_payment', label: 'Supplier Payment', group: 'Money', chosenOnForm: 'Cr Cash / Bank / Cheque',
    heads: [{ systemKey: 'accounts_payable', side: 'Dr', purpose: 'Supplier balance paid' }],
  },
  {
    process: 'customer_refund', label: 'Customer Refund', group: 'Money', chosenOnForm: 'Cr Cash / Bank',
    heads: [{ systemKey: 'accounts_receivable', side: 'Dr', purpose: 'Refund to customer' }],
  },
  {
    process: 'supplier_refund', label: 'Supplier Refund', group: 'Money', chosenOnForm: 'Dr Cash / Bank',
    heads: [{ systemKey: 'accounts_payable', side: 'Cr', purpose: 'Refund from supplier' }],
  },
  {
    process: 'expense', label: 'Expense', group: 'Money', chosenOnForm: 'Dr Expense account',
    heads: [{ systemKey: 'cash_in_hand', side: 'Cr', purpose: 'Paid from' }],
  },
  // ── People ──
  {
    process: 'employee_loan', label: 'Employee Loan', group: 'People', chosenOnForm: 'Cr Cash / Bank',
    heads: [{ systemKey: 'employee_loans_receivable', side: 'Dr', purpose: 'Loan given' }],
  },
  {
    process: 'loan_repayment', label: 'Loan Repayment', group: 'People', chosenOnForm: 'Dr Cash / Bank (cash repayment)',
    heads: [
      { systemKey: 'employee_loans_receivable', side: 'Cr', purpose: 'Loan recovered' },
      { systemKey: 'salaries_wages',            side: 'Dr', purpose: 'Recovered from salary' },
    ],
  },
  {
    process: 'agent_payment', label: 'Agent Payment', group: 'People', chosenOnForm: 'Cr Cash / Bank',
    heads: [{ systemKey: 'agent_commission_payable', side: 'Dr', purpose: 'Commission paid' }],
  },
  {
    process: 'owner_contribution', label: 'Owner Contribution', group: 'People', chosenOnForm: 'Dr Cash / Bank',
    heads: [{ systemKey: 'owners_capital', side: 'Cr', purpose: 'Capital introduced' }],
  },
  {
    process: 'owner_withdrawal', label: 'Owner Withdrawal', group: 'People', chosenOnForm: 'Cr Cash / Bank',
    heads: [{ systemKey: 'owners_drawings', side: 'Dr', purpose: 'Drawings' }],
  },
]

/** True when this (process, head) pair may be redirected. */
export function isOverridable(process: string, systemKey: string): boolean {
  return POSTING_PROCESSES.some((p) => p.process === process && p.heads.some((h) => h.systemKey === systemKey))
}

/**
 * The tenant's overrides for one process, as system_key → account id. Only
 * pairs the catalog allows are returned, so a stray row can never redirect a
 * money leg.
 */
export async function loadPostingOverrides(
  admin: Admin,
  tenantId: string,
  process: string,
): Promise<Map<string, string>> {
  const { data } = await admin
    .from('posting_account_overrides')
    .select('system_key, account_id')
    .eq('tenant_id', tenantId)
    .eq('process', process)
  return new Map((data ?? []).filter((r) => isOverridable(process, r.system_key)).map((r) => [r.system_key, r.account_id]))
}

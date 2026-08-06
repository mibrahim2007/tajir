// The words that route a question to an intent.
//
// Kept free of server imports so the engine, the routing checks and anything
// else share one definition — the tables are the part most worth checking, and
// engine.ts cannot be imported outside a server context.

/** Intent ids the engine has a runner for. Aliases must target one of these. */
export const RUNNER_IDS = [
  'customer_summary', 'supplier_summary', 'customer_ledger', 'supplier_ledger',
  'item_ledger', 'slow_items', 'slow_customers', 'top_customers', 'receivables',
  'payables', 'low_stock', 'stock_summary', 'overdue', 'cheques', 'cheque_summary',
  'cheque_lookup', 'monthly_sales', 'monthly_purchases', 'trade_comparison',
  'expenses', 'customer_grades', 'supplier_grades', 'item_monthly',
] as const

export const NONENTITY_KEYWORDS: Record<string, string[]> = {
  slow_items:     ['slow moving', 'slow-moving', 'slow item', 'dead stock', 'non moving', 'non-moving', 'not selling', 'least sold', 'slow stock'],
  slow_customers: ['slow customer', 'inactive customer', 'slow business customer', 'dormant', 'not buying', 'least active', 'idle customer'],
  top_customers:  ['top customer', 'best customer', 'biggest customer', 'top buyer', 'highest sales', 'most business', 'top client'],
  receivables:    ['receivable', 'who owes', 'owes me', 'outstanding customer', 'pending from customer', 'to collect', 'collection'],
  payables:       ['payable', 'who do i owe', 'whom do i owe', 'we owe', 'i owe', 'outstanding supplier', 'pending to supplier'],
  low_stock:      ['low stock', 'out of stock', 'reorder', 'running low', 'least stock', 'low quantity'],
  cheques:        ['cheque', 'cheques', 'pdc', 'post dated', 'post-dated', 'dated cheque'],
  stock_summary:  ['stock summary', 'inventory summary', 'stock value', 'inventory value', 'stock overview', 'inventory overview', 'total stock', 'stock worth', 'value of stock', 'stock on hand', 'inventory on hand', 'stock report', 'how much stock'],
  overdue:        ['overdue', 'past due', 'past-due', 'overdue invoice', 'overdue receivable', 'overdue payable', 'overdue receipt', 'overdue payment', 'due invoices', 'late payment', 'late invoice', 'payments overdue', 'receipts overdue', 'what is overdue', 'whats overdue'],

  // ── Analysis (migration 0057) ──
  monthly_sales:     ['monthly sale', 'monthly sales', 'sales by month', 'sale by month', 'month wise sale', 'monthwise sale', 'sales comparison', 'sale comparison', 'sales trend', 'sales per month', 'compare sales'],
  monthly_purchases: ['monthly purchase', 'monthly purchases', 'purchase by month', 'purchases by month', 'month wise purchase', 'monthwise purchase', 'purchase comparison', 'purchase trend', 'purchases per month', 'compare purchases'],
  trade_comparison:  ['sales vs purchase', 'sale vs purchase', 'sales and purchase', 'sale and purchase', 'purchase vs sale', 'buying and selling', 'trade summary', 'trading summary'],
  expenses:          ['expense', 'expenses', 'spending', 'overheads', 'overhead', 'cost breakdown', 'where is money going', 'where money goes', 'expense summary', 'expense report'],
  customer_grades:   ['customer grading', 'customer grade', 'grade customer', 'grade my customer', 'customer ranking', 'rank customer', 'customer abc', 'abc customer', 'customer classification', 'best customers by volume'],
  supplier_grades:   ['supplier grading', 'supplier grade', 'grade supplier', 'grade my supplier', 'supplier ranking', 'rank supplier', 'supplier abc', 'abc supplier', 'supplier classification', 'supplier performance', 'supplier delivery'],
}

export const SPECIFIC_KEYWORDS: Record<string, string[]> = {
  cheque_summary: ['cheque summary', 'cheques summary', 'pdc summary', 'cheque overview', 'how many cheque', 'cheque total', 'cheques total'],
  cheque_lookup:  ['cheque no', 'cheque number', 'cheque #', 'cheque#', 'status of cheque', 'find cheque', 'trace cheque', 'which cheque'],
}

/**
 * Single words that people actually type.
 *
 * Taken from the question log, not guessed: "stock" was typed three times and
 * fell through to the generic help answer every time, as did "items",
 * "ledger", "supplier", "summary" and "bounced" — while the same intents
 * phrased as "Low stock items" or "Bounced cheques" answered fine.
 *
 * Matched on the WHOLE question only. As substrings these would hijack real
 * questions — "ledger" appears in "ledger of Ali Traders", which must still
 * route to that customer's ledger.
 */
export const WHOLE_WORD_ALIASES: Record<string, string[]> = {
  stock_summary:     ['stock', 'stocks', 'inventory', 'stock report', 'summary', 'item stock', 'current stock', 'stock position'],
  slow_items:        ['items', 'item', 'stock items', 'show item current stocks', 'item list'],
  receivables:       ['ledger', 'ledgers', 'balances', 'outstanding'],
  payables:          ['supplier', 'suppliers'],
  top_customers:     ['customer', 'customers'],
  cheques:           ['cheque', 'cheques', 'pdc'],
  cheque_summary:    ['bounced', 'bounce'],
  monthly_sales:     ['sale', 'sales'],
  monthly_purchases: ['purchase', 'purchases', 'buying'],
  expenses:          ['expense', 'expenses', 'cost', 'costs'],
}

/** An alias fires only when it IS the whole question. */
export function aliasFor(question: string): string | null {
  const whole = (question ?? '').toLowerCase().replace(/[?.!,]/g, '').trim()
  for (const [id, aliases] of Object.entries(WHOLE_WORD_ALIASES)) {
    if (aliases.includes(whole)) return id
  }
  return null
}

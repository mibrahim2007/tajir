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

/**
 * A word that names a WHOLE AREA rather than one report.
 *
 * "month" is the case that prompted this: every month-wise keyword is a full
 * phrase ("monthly sale", "month wise purchase"), so the bare word matched
 * nothing and the user got the generic help — even though six reports could
 * have answered some version of it. Rather than guess which, offer them.
 *
 * These are consulted only AFTER the engine has failed to match, so a cue
 * appearing inside a real question can never hijack it.
 */
export type IntentFamily = {
  id: string
  cues: string[]
  title: string
  subtitle: string
  /** Ready-to-tap questions, phrased exactly as the engine expects them. */
  offers: string[]
}

export const INTENT_FAMILIES: IntentFamily[] = [
  {
    id: 'period',
    cues: ['month', 'monthly', 'month wise', 'monthwise', 'month-wise', 'by month', 'per month',
           'this month', 'last month', 'quarter', 'quarterly', 'year', 'yearly', 'annual', 'period'],
    title: 'Which month-wise view?',
    subtitle: 'Several reports break your business down by month',
    offers: [
      'Monthly sale comparison',
      'Monthly purchase comparison',
      'Sales vs purchases',
      'Expense summary',
      'Monthly sales of <item name>',
    ],
  },
  {
    id: 'comparison',
    // "comparision" is not a typo here — it is what a user actually typed, and
    // the question log is the reason it is covered.
    cues: ['compare', 'comparison', 'comparision', 'comparisons', 'trend', 'trends',
           'growth', 'analysis', 'analyse', 'analyze', 'analytics'],
    title: 'What would you like compared?',
    subtitle: 'These answers put figures side by side',
    offers: [
      'Monthly sale comparison',
      'Monthly purchase comparison',
      'Sales vs purchases',
      'Customer grading',
      'Supplier grading',
    ],
  },
  {
    id: 'grading',
    cues: ['grading', 'grade', 'grades', 'ranking', 'rank', 'abc', 'classification', 'performance', 'rating'],
    title: 'Grade customers or suppliers?',
    subtitle: 'A and B and C by share of value',
    offers: [
      'Customer grading',
      'Supplier grading',
      'Top customers',
      'Slow / inactive customers',
    ],
  },
  {
    id: 'reports',
    cues: ['report', 'reports', 'dashboard', 'analysis report', 'mis', 'statistics', 'stats', 'figures', 'numbers'],
    title: 'Which report?',
    subtitle: 'Everything Ask can work out from your data',
    offers: [
      'Monthly sale comparison',
      'Monthly purchase comparison',
      'Sales vs purchases',
      'Expense summary',
      'Customer grading',
      'Supplier grading',
      'Stock summary',
      'What is overdue',
    ],
  },
  {
    id: 'money',
    cues: ['money', 'cash', 'profit', 'income', 'earning', 'revenue', 'turnover', 'business'],
    title: 'Which figures?',
    subtitle: 'Money coming in, going out, and what is owed',
    offers: [
      'Monthly sale comparison',
      'Expense summary',
      'Who owes me money',
      'Who do I owe',
      'Sales vs purchases',
    ],
  },
]

/**
 * The family a question falls into, or null.
 *
 * Longest cue wins, so "month wise" beats "month" and the more specific family
 * is offered when both could apply.
 */
export function familyFor(question: string): IntentFamily | null {
  const q = (question ?? '').toLowerCase().replace(/[?.!,]/g, ' ').trim()
  if (!q) return null

  let best: IntentFamily | null = null
  let bestLen = 0
  for (const family of INTENT_FAMILIES) {
    for (const cue of family.cues) {
      // Word-boundary match so "year" does not fire inside "yearly rate" and
      // more importantly so a cue never matches a fragment of a longer word.
      const re = new RegExp(`(^|\\s)${cue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`)
      if (re.test(q) && cue.length > bestLen) { best = family; bestLen = cue.length }
    }
  }
  return best
}

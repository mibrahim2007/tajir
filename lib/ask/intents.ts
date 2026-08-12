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
  // "show last month sale" was typed and matched nothing: every month-wise
  // keyword here was a phrase built around the word "monthly", and none of them
  // covers the way people actually name a period out loud.
  monthly_sales:     ['monthly sale', 'monthly sales', 'sales by month', 'sale by month', 'month wise sale', 'monthwise sale', 'sales comparison', 'sale comparison', 'sales trend', 'sales per month', 'compare sales', 'last month sale', 'last month sales', 'this month sale', 'this month sales'],
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
  payables:          ['supplier', 'suppliers', 'all suppliers'],
  top_customers:     ['customer', 'customers', 'all customers'],
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
 * Bare questions whose answer is a GUIDE or an FAQ rather than a report.
 *
 * WHOLE_WORD_ALIASES above sends a bare word to a data runner. These do the same
 * for the two static layers, which their own matchers cannot reach: matchGuide
 * and matchFaq both require a how-to or concept cue, so a one-word question can
 * never satisfy them however exactly it names the topic.
 *
 * Taken from the log, same as the aliases: "start" was typed on its own and
 * answered with the generic help card, and so was "how do i start" — the FAQ
 * that answers it exists, but no keyword covered that wording. "location" is
 * the other shape: the app has locations, Ask has no location report, and the
 * FAQ explaining what one is for is the honest answer.
 *
 * Whole question only, for the reason the data aliases are: as substrings these
 * would hijack real questions — "location" appears in "opening stock location
 * wise", which is a guide.
 *
 * Values are `faq:<id>` or `guide:<id>`; ask-analysis-check asserts they exist.
 */
export const STATIC_ALIASES: Record<string, string> = {
  'start':           'faq:where_to_start',
  'how do i start':  'faq:where_to_start',
  'how to start':    'faq:where_to_start',
  'how do i begin':  'faq:where_to_start',
  'where do i begin':'faq:where_to_start',
  'location':        'faq:what_is_location',
  'locations':       'faq:what_is_location',
  // Not from the log — from ASK_HOWTO_EXAMPLES, where it is offered as a
  // tappable chip. It is the guide's own title, carries no how-to cue and is
  // not self-evidently instructional, so matchGuide refused it and tapping the
  // chip fell through to the data engine.
  'employee loans and advances': 'guide:employee_loans',

  // Chart-of-accounts ledgers. "Show Chash in Hand Ledger" was asked on
  // production and answered with the ledger of a supplier called "Chand MNC",
  // because "chand" contains "hand". The resolver no longer matches inside a
  // word; these give the question somewhere to land. "chash" is the typo as it
  // was actually typed, kept for the same reason "comparision" is kept below.
  'cash in hand':         'faq:account_ledger',
  'cash in hand ledger':  'faq:account_ledger',
  'chash in hand ledger': 'faq:account_ledger',
  'cash ledger':          'faq:account_ledger',
  'cash account':         'faq:account_ledger',
  'account ledger':       'faq:account_ledger',
  'general ledger':       'faq:account_ledger',
  'cashbook':             'faq:account_ledger',
  'cash book':            'faq:account_ledger',

  // Financial statements. Ask does not assemble them; the reports do, and
  // saying so beats a loose match. "show balance sheet" was asked by Makks
  // International and matched nothing.
  'balance sheet':        'faq:financial_statements',
  'profit and loss':      'faq:financial_statements',
  'profit & loss':        'faq:financial_statements',
  'p&l':                  'faq:financial_statements',
  'pnl':                  'faq:financial_statements',
  'trial balance':        'faq:financial_statements',
  'income statement':     'faq:financial_statements',
  'financial statements': 'faq:financial_statements',

  // "Show Owner record" — the business owners' capital and drawings, at
  // Admin → Owners. Not the Owner user role, which owner_vs_assistant covers.
  'owner record':         'faq:owner_money',
  'owner records':        'faq:owner_money',
  'owners':               'faq:owner_money',
  'owner':                'faq:owner_money',
}

/**
 * Openers people put in front of a question that carry no meaning of their own.
 *
 * "Show Chash in Hand Ledger" is the same question as "cash in hand ledger",
 * and a table keyed on the bare phrase would miss it. Stripped only for the
 * whole-question alias lookup — the engine's own matching still sees the
 * original text.
 */
const LEAD_INS = /^(?:please\s+)?(?:show\s+me|show|give\s+me|give|tell\s+me|open|display|view|see)\s+/

/** A static alias fires only when it IS the whole question. */
export function staticAliasFor(question: string): string | null {
  const whole = (question ?? '').toLowerCase().replace(/[?.!,]/g, '').trim()
  return STATIC_ALIASES[whole] ?? STATIC_ALIASES[whole.replace(LEAD_INS, '').trim()] ?? null
}

/**
 * The singular of a plural the user typed, or null if it does not look plural.
 *
 * "cards" matched nothing while "card" listed three items, because stock names
 * are stored singular ("10 GB CARD") and every match in the engine is a
 * substring test. The same gap hits any category word a shopkeeper pluralises.
 *
 * Deliberately crude — it only has to undo the "s" people add when they mean
 * the category rather than one item, and it is consulted ONLY after the word as
 * typed has already matched nothing, so a wrong guess costs nothing. Words
 * ending in "ss" are left alone ("address", "business").
 */
export function singularize(word: string): string | null {
  const w = (word ?? '').toLowerCase().trim()
  if (w.length < 4 || !w.endsWith('s') || w.endsWith('ss')) return null
  if (w.endsWith('ies') && w.length > 4) return `${w.slice(0, -3)}y`
  if (/(ch|sh|x|z)es$/.test(w)) return w.slice(0, -2)
  return w.slice(0, -1)
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
    // Setup, not unsettled invoices. "opening" and "open" look alike and mean
    // opposite things — someone asking about unpaid invoices must not be sent
    // to a setup screen, so they stay separate families.
    id: 'opening',
    cues: ['opening', 'opening balance', 'opening balances', 'opening stock',
           'starting balance', 'initial balance', 'previous balance', 'old balance',
           'migrate', 'migration', 'setup', 'set up'],
    title: 'Which opening balance?',
    subtitle: 'Four things can be brought onto the books at setup',
    offers: [
      'How to load opening stock location wise',
      'How to load customer opening balances',
      'How to load supplier opening balances',
      'How to load opening cheques',
      'What is an opening balance?',
    ],
  },
  {
    // "invoice" and "sale invoice" were both typed bare. Ask has no runner that
    // lists invoices, so the only honest offer is the how-to for raising one
    // plus the reports that summarise them — which is exactly why this is a
    // family and not an alias to the sale-invoice guide.
    id: 'documents',
    cues: ['invoice', 'invoices', 'bill', 'bills', 'billing', 'document', 'documents', 'voucher', 'vouchers', 'challan'],
    title: 'Which invoice question?',
    subtitle: 'Ask can show you how to raise one, or what your invoices add up to',
    offers: [
      'How to create a sale invoice',
      'How to create a purchase order',
      'How to create a sale return',
      'Monthly sale comparison',
      'What is overdue',
    ],
  },
  {
    // Unpaid items, NOT setup balances — kept apart from the 'opening' family
    // above for the reason stated there. "open" does not word-boundary match
    // inside "opening", so the two cannot collide.
    id: 'outstanding',
    cues: ['open', 'unpaid', 'unsettled', 'recovery', 'collections', 'remaining', 'left'],
    title: 'Which outstanding figures?',
    subtitle: 'What is still unpaid, in each direction',
    offers: [
      'Who owes me money',
      'Who do I owe',
      'What is overdue',
      'Pending cheques',
      'Overdue cheques',
    ],
  },
  {
    id: 'staff',
    cues: ['employee', 'employees', 'staff', 'worker', 'workers', 'salary', 'salaries', 'wages', 'mulazim'],
    title: 'Which staff question?',
    subtitle: 'Ask covers loans and advances; it has no payroll report',
    offers: [
      'Employee loans and advances',
      'What is the difference between an employee loan and an advance?',
      'How do I record money I take out of the business?',
      'Expense summary',
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

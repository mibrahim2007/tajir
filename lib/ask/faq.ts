// Newcomer questions and answers for the Ask page.
//
// The how-to guides in guides.ts answer "how do I do X" with steps. These
// answer the questions a new user asks BEFORE they know what the steps are:
// what a thing is, which of two similar things to use, and why the app did
// something they did not expect.
//
// Written by walking the whole application — every module, every setting, and
// the account codes actually seeded on the chart of accounts. Static content,
// versioned with the app, no model involved.

export type Faq = {
  id: string
  category: FaqCategory
  /** The question, shown as the answer's title. */
  question: string
  /** Matched as substrings of the lowercased question. */
  keywords: string[]
  /** One or two sentences that answer it directly. */
  answer: string
  /** Supporting detail, only where it earns its place. */
  points?: string[]
  links?: { label: string; href: string }[]
  related?: string[]
}

export const FAQ_CATEGORIES = [
  'Getting started',
  'Customers & suppliers',
  'Stock',
  'Sales & purchases',
  'Cheques & payments',
  'Accounting',
  'Staff & admin',
] as const

export type FaqCategory = (typeof FAQ_CATEGORIES)[number]

// Cues that mark a question as conceptual rather than a request for data.
const FAQ_CUES = [
  'what is', 'what are', 'whats', "what's", 'what does', 'what happens', 'what should',
  'what do i', 'what to do',
  'difference between', 'differs', 'vs ', ' or ', 'which one', 'when should', 'when do i',
  'why does', 'why did', 'why is', 'why can', 'why cant', "why can't", 'why do',
  'can i', 'can we', 'do i need', 'should i', 'am i able', 'is it possible',
  'how do i', 'how to', 'how is', 'how are', 'explain', 'meaning', 'mean',
  'where do i', 'where to', 'where is', 'where are', 'i am new', 'im new', "i'm new",
  'kya', 'kaise', 'kyun', 'kyu', 'farq',
]

export const hasFaqCue = (lowerQ: string): boolean => FAQ_CUES.some((c) => lowerQ.includes(c))

/**
 * A question comparing two things ("difference between a sale return and a
 * credit note") wants the concept, not the how-to steps for whichever one it
 * happens to name first. The engine checks this to run FAQs before guides.
 */
export const isComparativeQuestion = (lowerQ: string): boolean =>
  lowerQ.includes('difference between') || lowerQ.includes(' vs ') || lowerQ.includes('differs')

export const FAQS: Faq[] = [
  // ── Getting started ───────────────────────────────────────────────
  {
    id: 'what_is_tajir',
    category: 'Getting started',
    question: 'What is Tajir and what can it do?',
    keywords: ['what is tajir', 'about tajir', 'tajir kya', 'what can tajir', 'what does tajir'],
    answer:
      'Tajir runs a trading business end to end: stock, purchases, sales, customers, suppliers and full double-entry accounting, all from the same records.',
    points: [
      'Everything you enter once flows everywhere — a sale moves stock, updates the customer balance and posts to the ledger in one step.',
      'It handles PKR and USD, multiple warehouses, and prints or exports every report.',
      'Nothing is estimated: every figure on every report traces back to a document you entered.',
    ],
    links: [{ label: 'User Guide', href: '/user-guide' }],
    related: ['I am new, where do I start?', 'Do I need to know accounting?'],
  },
  {
    id: 'where_to_start',
    category: 'Getting started',
    question: 'I am new — where do I start?',
    keywords: [
      'where do i start', 'where to start', 'i am new', 'im new', 'new user', 'new here',
      'first time', 'getting started', 'how to begin', 'setup order', 'set up my business',
      'shuru kaise', 'start kaise',
    ],
    answer:
      'Set the business up in this order, then start recording day-to-day work. Each step depends on the ones before it.',
    points: [
      '1. Admin → Business — your name, address and NTN, which print on invoices.',
      '2. Admin → Item Types — your product categories.',
      '3. Inventory → Locations — each warehouse or godown.',
      '4. Inventory — every stock item you buy and sell.',
      '5. Sales → Customers and Procurement → Suppliers — your parties.',
      '6. Admin → Banks — your bank accounts.',
      '7. Admin → Opening Balances — what you were carrying on day one: stock, party balances and any cheques still outstanding.',
    ],
    links: [
      { label: 'Opening Balances', href: '/settings/opening-balances' },
      { label: 'User Guide', href: '/user-guide' },
    ],
    related: ['What is an opening balance?', 'What is a location and do I need one?'],
  },
  {
    id: 'owner_vs_assistant',
    category: 'Getting started',
    question: 'What is the difference between Owner and Assistant?',
    keywords: [
      'owner and assistant', 'owner vs assistant', 'difference between owner', 'assistant role',
      'user roles', 'what can assistant', 'assistant cannot', 'permissions',
    ],
    answer:
      'Owner has full access. Assistant can record day-to-day transactions but cannot reach settings, accounting, or other people’s records.',
    points: [
      'An assistant can create purchases, sales, receipts, payments and gatepasses.',
      'An assistant cannot open the Admin group, the Chart of Accounts, sale returns, opening balances, or settle cheques.',
      'Invite people at Admin → Team. You can change a role later.',
    ],
    links: [{ label: 'Team', href: '/settings/team' }],
    related: ['Why can I not see a menu item?', 'Who can delete things?'],
  },
  {
    id: 'missing_menu',
    category: 'Getting started',
    question: 'Why can I not see a menu item?',
    keywords: [
      'cannot see menu', 'can not see menu', 'menu item', 'see a menu', 'menu missing', 'missing menu', 'page missing',
      'cannot find page', 'where is the menu', 'module not showing', 'option not showing',
      'nazar nahi',
    ],
    answer: 'Either the module is switched off, or your role does not have access to it.',
    points: [
      'Owners can turn modules on and off at Admin → Modules. A disabled module disappears for everyone.',
      'The Admin group is owner-only, so an assistant never sees it.',
      'If it is neither, press Ctrl+K and type the page name — the command palette reaches everything you are allowed to open.',
    ],
    links: [{ label: 'Modules', href: '/settings/modules' }],
    related: ['What is the difference between Owner and Assistant?'],
  },
  {
    id: 'find_page_fast',
    category: 'Getting started',
    question: 'How do I find a page quickly?',
    keywords: ['find a page', 'search page', 'command palette', 'keyboard shortcut', 'ctrl k', 'shortcut'],
    answer: 'Press Ctrl+K (⌘K on Mac) anywhere and type what you want. The command palette jumps straight to any page or action.',
    related: ['I am new, where do I start?'],
  },

  // ── Customers & suppliers ─────────────────────────────────────────
  {
    id: 'what_is_opening_balance',
    category: 'Customers & suppliers',
    question: 'What is an opening balance?',
    keywords: [
      'what is an opening balance', 'what is opening balance', 'opening balance mean',
      'opening balance kya', 'why opening balance', 'purpose of opening balance',
    ],
    answer:
      'It is what already existed on the day you started using Tajir — money owed, money owing, stock on the floor, cheques in the drawer. Without it, every report starts from zero and none of your balances are right.',
    points: [
      'There are four kinds, all at Admin → Opening Balances: stock quantities, customer balances, supplier balances and post-dated cheques.',
      'A customer or supplier opening balance is positive when they owe you or you owe them, and negative for an advance already paid.',
      'Enter a party balance NET of any cheque you also load for them, or the same money counts twice.',
    ],
    links: [{ label: 'Opening Balances', href: '/settings/opening-balances' }],
    related: ['How to load customer opening balances', 'Why does my Balance Sheet not match?'],
  },
  {
    id: 'customer_credit_badge',
    category: 'Customers & suppliers',
    question: 'Why does a customer show "Credit"?',
    keywords: [
      'customer shows credit', 'credit badge', 'why credit', 'negative balance customer',
      // Its own title, so the chip that offers it leads somewhere.
      'why does a customer show',
      'customer in credit', 'advance from customer', 'green credit',
    ],
    answer:
      'Their balance has gone the other way — you owe them. It usually means they paid more than they were billed, or something was returned after they had already paid.',
    points: [
      'To settle it, either let it offset their next invoice, or pay it back: open their Ledger and use Refund.',
      'The same idea on the supplier side reads as "Advance paid".',
    ],
    links: [{ label: 'Customers', href: '/customers' }],
    related: ['What is the difference between a refund and a credit note?'],
  },
  {
    id: 'return_vs_credit_note',
    category: 'Customers & suppliers',
    question: 'What is the difference between a sale return and a credit note?',
    keywords: [
      'return or credit note', 'return vs credit note', 'difference between return and credit', 'difference between a sale return', 'sale return and a credit note', 'difference between purchase return and debit',
      'credit note or return', 'when to use credit note', 'what is a credit note',
      'credit note kya', 'difference between purchase return and debit note',
      'what is a debit note', 'debit note or purchase return',
    ],
    answer:
      'A return is for goods physically coming back. A note adjusts the balance when nothing moves — a discount agreed after the invoice, an allowance for damage, or a write-off.',
    points: [
      'Sale Return puts stock back and reduces what the customer owes. Credit Note only reduces what they owe.',
      'Purchase Return takes stock out and reduces what you owe. Debit Note only reduces what you owe.',
      'If you use a note when goods really came back, your stock will be wrong.',
    ],
    links: [
      { label: 'Credit Notes', href: '/credit-notes' },
      { label: 'Debit Notes', href: '/debit-notes' },
    ],
    related: ['What is the difference between a refund and a credit note?', 'How to create a sale return'],
  },
  {
    id: 'refund_vs_note',
    category: 'Customers & suppliers',
    question: 'What is the difference between a refund and a credit note?',
    keywords: [
      'refund or credit note', 'refund vs credit note', 'difference between refund', 'difference between a refund', 'refund and a credit note',
      'what is a refund', 'when to refund', 'refund kya',
    ],
    answer:
      'A credit note is an adjustment on paper. A refund is money actually leaving your hands to clear a credit the customer was holding.',
    points: [
      'Refund a customer from their Ledger, when they are in credit.',
      'Money coming back from a supplier is recorded on the supplier Ledger as "Receive Payment from Supplier".',
      'After a refund the party owes again, because the credit they held has been paid out.',
    ],
    related: ['Why does a customer show "Credit"?'],
  },
  {
    id: 'party_statement',
    category: 'Customers & suppliers',
    question: 'How do I see everything a customer has done?',
    keywords: [
      'customer statement', 'customer history', 'see all transactions of', 'party ledger',
      // Its own title, so the chip that offers it leads somewhere.
      'how do i see everything a customer',
      'account statement', 'khata', 'full history of customer',
    ],
    answer:
      'Open Sales → Customers and click Ledger on their row. It shows every invoice, receipt, return and note with a running balance, and prints as a statement.',
    points: [
      'You can also just type their name here in Ask to get the same ledger.',
      'If the same party is both a customer and a supplier, the Consolidated Ledger report nets the two into one statement.',
    ],
    links: [{ label: 'Customers', href: '/customers' }, { label: 'Suppliers', href: '/suppliers' }],
    related: ['Who owes me money', 'What is an opening balance?'],
  },

  // ── Stock ─────────────────────────────────────────────────────────
  {
    id: 'what_is_location',
    category: 'Stock',
    question: 'What is a location and do I need one?',
    keywords: [
      'what is a location', 'what is location', 'do i need a location', 'why location',
      'warehouse', 'godown', 'location kya', 'multiple warehouse',
    ],
    answer:
      'A location is a warehouse or godown. Stock is tracked per location, so a purchase arrives into one and a sale is dispatched from one.',
    points: [
      'Even with a single godown you need one, because every stock movement has to point somewhere.',
      'Create them at Inventory → Locations before recording purchases and sales.',
      'Move stock between them with Inventory → Stock Transfers.',
    ],
    links: [{ label: 'Locations', href: '/locations' }],
    related: ['Why does it say Insufficient Stock?', 'How to load opening stock location wise'],
  },
  {
    id: 'insufficient_stock',
    category: 'Stock',
    question: 'Why does it say "Insufficient Stock"?',
    keywords: [
      'insufficient stock', 'not enough stock', 'stock error', 'cannot save sale',
      'stock kam', 'why can i not sell',
    ],
    answer:
      'You are trying to sell more than is held at the location you picked in Dispatch From. Stock is counted per location, not in total.',
    points: [
      'Check the Location-wise Stock report — the quantity may be sitting at another godown.',
      'If it is, move it with a Stock Transfer first, or change Dispatch From to the location that holds it.',
      'If you have not loaded opening stock yet, the item genuinely has nothing on hand.',
    ],
    links: [{ label: 'Location-wise Stock', href: '/reports/location-stock' }],
    related: ['What is a location and do I need one?', 'How to load opening stock location wise'],
  },
  {
    id: 'service_item',
    category: 'Stock',
    question: 'What is a service item?',
    keywords: [
      'service item', 'what is service', 'item nature', 'inventory or service',
      'freight item', 'labour charge', 'non stock item',
    ],
    answer:
      'An item with nature "Service" — freight, labour, commission — that is billed but never counted. It has no stock and no cost of sales.',
    points: [
      'A service item never blocks a sale, because there is nothing to run out of.',
      'Set the nature when you create the item; use Inventory for anything you physically hold.',
    ],
    links: [{ label: 'Inventory', href: '/inventory' }],
    related: ['Why does it say Insufficient Stock?'],
  },
  {
    id: 'stock_value',
    category: 'Stock',
    question: 'How is my stock value calculated?',
    keywords: [
      'stock value', 'how is stock valued', 'stock valuation', 'value of my stock',
      'cost of stock', 'inventory value',
    ],
    answer:
      'Each item is valued at its latest purchase rate, falling back to the opening rate you entered if it has never been bought in Tajir.',
    points: [
      'That makes it an estimate, not a booked figure — it moves when you buy at a new price.',
      'The same basis is used for cost of sales in the profit reports.',
      'So the cost rate you put on opening stock matters: use what you paid, not what you sell for.',
    ],
    links: [{ label: 'Stock Valuation', href: '/reports/stock-valuation' }],
    related: ['How to load opening stock location wise'],
  },

  // ── Sales & purchases ─────────────────────────────────────────────
  {
    id: 'edit_delete_invoice',
    category: 'Sales & purchases',
    question: 'Can I edit or delete an invoice after saving?',
    keywords: [
      'edit an invoice', 'delete an invoice', 'change a sale', 'edit a sale', 'delete a sale',
      'edit a purchase', 'delete a purchase', 'mistake in invoice', 'wrong entry', 'galti',
    ],
    answer:
      'Yes. Open it from the Sales or Purchases list and edit or delete it — stock and the ledger are corrected at the same time.',
    points: [
      'A delete is refused if it would drive stock negative, or if it is dated in a period you have closed.',
      'Every change is recorded in the Audit Log with who made it and what changed.',
      'If the invoice is old and settled, a credit or debit note is usually cleaner than editing history.',
    ],
    links: [{ label: 'Audit Log', href: '/audit' }],
    related: ['What is closing the books?', 'What is the difference between a sale return and a credit note?'],
  },
  {
    id: 'print_invoice',
    category: 'Sales & purchases',
    question: 'How do I print an invoice?',
    keywords: ['print an invoice', 'print invoice', 'invoice print', 'pdf invoice', 'bill print', 'save as pdf'],
    answer:
      'Open the saved sale and choose a print format: a compact voucher for quick copies, or a full-page A4 invoice with the amount in words.',
    points: [
      'Your business name, address and NTN come from Admin → Business, so fill those in first.',
      'Use your browser print dialog to save as PDF instead of printing.',
    ],
    related: ['How to create a sale invoice'],
  },
  {
    id: 'due_days',
    category: 'Sales & purchases',
    question: 'What are Due Days on a sale?',
    keywords: [
      'due days', 'payment due', 'credit period', 'payment terms', 'when is payment due',
      'due date on invoice',
    ],
    answer:
      'The credit period you have given. Enter the number of days and Tajir fills in the Payment Due date on the invoice.',
    points: [
      'Anything past its Payment Due date shows up when you ask what is overdue.',
      'Leave it blank for a cash sale.',
    ],
    related: ['What is overdue', 'How to create a sale invoice'],
  },
  {
    id: 'advance_paid',
    category: 'Sales & purchases',
    question: 'What is Advance Paid on a purchase?',
    keywords: ['advance paid', 'advance on purchase', 'partial payment purchase', 'paid at the time'],
    answer:
      'Money you handed over when the goods arrived. It is settled on the invoice itself, so only the unpaid remainder shows in Payables.',
    points: [
      'Use it for a payment made at the moment of purchase. For a payment made later, record a separate Payment against the supplier.',
    ],
    related: ['How to create a purchase order', 'Who do I owe'],
  },
  {
    id: 'po_dc_supplier_invoice',
    category: 'Sales & purchases',
    question: 'What are PO No., DC No. and Supplier Invoice No.?',
    keywords: [
      'po no', 'po number', 'dc no', 'dc number', 'delivery challan', 'supplier invoice no',
      'bill number', 'reference number on invoice',
    ],
    answer:
      'Reference numbers from the other side of the deal, so you can find a document later by the number the other party uses.',
    points: [
      'PO No. and DC No. go on a sale — your customer’s purchase order and your delivery challan. Search them in the Sale Detail report.',
      'Supplier Invoice No. goes on a purchase — the supplier’s own bill number. Search it in the Purchase Detail report.',
    ],
    links: [
      { label: 'Sale Detail', href: '/reports/sale-detail' },
      { label: 'Purchase Detail', href: '/reports/purchase-detail' },
    ],
  },
  {
    id: 'below_cost',
    category: 'Sales & purchases',
    question: 'Why did it warn me that I am selling below cost?',
    keywords: ['below cost', 'selling below cost', 'loss warning', 'cost warning', 'price below'],
    answer:
      'The rate on that line is under what the item cost you, so the sale would book a loss. It is a confirmation, not a block — proceed if that is intended.',
    related: ['How is my stock value calculated?'],
  },
  {
    id: 'customer_pricing',
    category: 'Sales & purchases',
    question: 'Can I fix a price for a particular customer?',
    keywords: [
      'fix a price', 'customer price', 'price list', 'agreed rate', 'special rate',
      'pricing for customer', 'rate automatically',
    ],
    answer:
      'Yes. Set agreed rates per item per customer at Sales → Pricing, and they fill in automatically on that customer’s invoices.',
    points: ['You can still override the rate on any line.'],
    links: [{ label: 'Pricing', href: '/pricing' }],
  },

  // ── Cheques & payments ────────────────────────────────────────────
  {
    id: 'part_payment',
    category: 'Cheques & payments',
    question: 'How do I record a part payment or a mixed payment?',
    keywords: [
      'part payment', 'partial payment', 'split payment', 'mixed payment', 'some cash some',
      'half cash', 'tender lines', 'multiple payment methods',
    ],
    answer:
      'Enter what was actually received or paid — it does not have to match an invoice. Use the tender lines to split it across cash, bank and cheque.',
    points: [
      'One receipt can hold a Cash line, an Online line and a PDC line at the same time.',
      'The party balance simply reduces by the total; payments are not tied to specific invoices.',
      'Received In / Paid From decides which cash or bank account moves in the ledger.',
    ],
    links: [{ label: 'New Receipt', href: '/receipts/new' }, { label: 'New Payment', href: '/payments/new' }],
    related: ['What is PDC', 'How do I see everything a customer has done?'],
  },
  {
    id: 'cheque_bounced',
    category: 'Cheques & payments',
    question: 'A cheque bounced — what do I do?',
    keywords: [
      'cheque bounced', 'cheque bounce', 'cheque returned', 'cheque failed', 'bounced cheque what',
      'cheque wapas', 'dishonoured',
    ],
    answer:
      'Open Reports → Cheque Register, find the cheque and settle it as Bounced. The amount goes back onto the party’s balance, so they owe you again.',
    points: [
      'Do not delete the receipt — bouncing keeps the history and the accounting straight.',
      'A cheque you had passed on to a supplier can still bounce; settling it puts both parties back where they were.',
    ],
    links: [{ label: 'Cheque Register', href: '/reports/pdc-register' }],
    related: ['What is PDC', 'Overdue cheques'],
  },
  {
    id: 'endorse_cheque',
    category: 'Cheques & payments',
    question: 'Can I give a customer’s cheque to a supplier?',
    keywords: [
      'give cheque to supplier', 'cheque to a supplier', 'cheque to supplier', 'pass on a cheque', 'endorse', 'endorsement', 'hand over cheque',
      'transfer cheque', 'cheque aage',
    ],
    answer:
      'Yes — that is an endorsement. On the supplier payment, add a PDC tender line and pick the received cheque from the Cheque No. list instead of writing a new number.',
    points: [
      'The original cheque is then marked Endorsed and can never also be cleared into your own account.',
      'It can still bounce. If it does, both parties come back onto your books.',
    ],
    links: [{ label: 'New Payment', href: '/payments/new' }],
    related: ['What is PDC', 'A cheque bounced — what do I do?'],
  },
  {
    id: 'money_account',
    category: 'Cheques & payments',
    question: 'What does "Received In" or "Paid From" mean?',
    keywords: [
      'received in', 'paid from', 'money account', 'which bank account', 'cash or bank account',
    ],
    answer:
      'Which of your own accounts the money landed in or left from — cash in hand, or a particular bank. It decides what the ledger debits or credits.',
    points: ['Add your banks at Admin → Banks so they appear in this list.'],
    links: [{ label: 'Banks', href: '/banks' }],
    related: ['How do I record a part payment or a mixed payment?'],
  },

  // ── Accounting ────────────────────────────────────────────────────
  {
    id: 'need_accounting',
    category: 'Accounting',
    question: 'Do I need to know accounting to use Tajir?',
    keywords: [
      'need to know accounting', 'do i need accounting', 'not an accountant', 'accounting knowledge',
      'hisab nahi', 'without accounting',
    ],
    answer:
      'No. Record your normal work — purchases, sales, receipts, payments — and the double-entry accounting is written for you in the background.',
    points: [
      'You only meet the accounting when you want it: Profit & Loss, Balance Sheet, Trial Balance and the General Ledger are all built from those same entries.',
      'The one thing worth getting right at the start is opening balances, because every report is built on them.',
    ],
    related: ['What is an opening balance?', 'What is the Chart of Accounts?'],
  },
  {
    id: 'chart_of_accounts',
    category: 'Accounting',
    question: 'What is the Chart of Accounts?',
    keywords: [
      'chart of accounts', 'what is coa', 'gl accounts', 'general ledger accounts',
      'account codes', 'ledger accounts list',
    ],
    answer:
      'The list of ledger accounts your transactions post into — assets, liabilities, equity, revenue and expenses. Tajir seeds a standard chart, so you can usually leave it alone.',
    points: [
      'The ones you will see named most often: 1130 Accounts Receivable, 2110 Accounts Payable, 1112 and 2115 for post-dated cheques, 1135 Employee Loans, 3300 Opening Balance Equity.',
      'You can add your own accounts, or upload them in bulk from a CSV with code, name and type.',
    ],
    links: [{ label: 'Accounts', href: '/accounts' }],
    related: ['What is Opening Balance Equity?', 'Do I need to know accounting?'],
  },
  {
    // Written because "cash in hand ledger" was asked on production and Ask
    // answered with the ledger of a supplier called "Chand MNC" — "chand"
    // contains "hand". The resolver bug is fixed; this is the other half, since
    // the question is a fair one and Ask had nothing to say to it.
    id: 'account_ledger',
    category: 'Accounting',
    question: 'How do I see the ledger of Cash in Hand or another account?',
    keywords: [
      'what is cash in hand', 'how do i see an account ledger', 'how to see account ledger',
      'account ledger', 'ledger of an account', 'gl ledger', 'cash in hand account',
      'how do i see the general ledger', 'what is the general ledger', 'cash account ledger',
      // Bare "cash in hand" needs a cue to fire, so this cannot capture
      // "received 5000 cash in hand". It exists so this entry's own title
      // matches — a related chip that dead-ends is a broken promise.
      'cash in hand',
    ],
    answer:
      'Cash in Hand is account 1110 on your Chart of Accounts — one of your own ledger accounts, not a customer or supplier, so it has no party ledger. Open Reports → General Ledger and pick the account to see its movements.',
    points: [
      'General Ledger filters by account and date range, and shows the opening balance with a running balance down the page.',
      'The money accounts are 1110 Cash in Hand, 1120 Cash at Bank and 1112 PDC. To see cash and bank together for one day, use Reports → Daily Cashbook, which gives opening and closing balances.',
      'Ask answers ledgers for customers, suppliers and stock items. Account ledgers are not in Ask yet — use the report.',
      'Every account you have is listed at Accounts → Chart of Accounts.',
    ],
    links: [
      { label: 'General Ledger', href: '/reports/general-ledger' },
      { label: 'Daily Cashbook', href: '/reports/cashbook' },
      { label: 'Chart of Accounts', href: '/accounts' },
    ],
    related: ['What is the Chart of Accounts?', 'What does "Received In" or "Paid From" mean?', 'What is a voucher?'],
  },
  {
    // "show balance sheet" was asked by Makks International and matched
    // nothing. Ask reports ledgers and activity; the statements are assembled
    // by the reports, and saying so plainly beats routing it to a loose match.
    id: 'financial_statements',
    category: 'Accounting',
    question: 'Where are the Balance Sheet, Profit & Loss and Trial Balance?',
    keywords: [
      'where is the balance sheet', 'how do i see the balance sheet', 'what is the balance sheet',
      'balance sheet report', 'profit and loss report', 'where is profit and loss',
      'trial balance report', 'what is the trial balance', 'financial statements',
      'income statement', 'balance sheet', 'trial balance',
    ],
    answer:
      'In Reports, not in Ask. Balance Sheet shows assets, liabilities and equity on a date; Profit & Loss shows revenue, cost and net profit over a range; Trial Balance lists every GL account and proves debits equal credits.',
    points: [
      'Balance Sheet verifies the accounting equation, so it is the quickest check that your books balance.',
      'For profit on one item or one customer, use Item Profit & Loss or Customer Profit & Loss instead of the overall statement.',
      'Ask reports ledgers, balances and activity straight from your records. Assembling them into a statement is what the reports do.',
    ],
    links: [
      { label: 'Balance Sheet', href: '/reports/balance-sheet' },
      { label: 'Profit & Loss', href: '/reports/profit-loss' },
      { label: 'Trial Balance', href: '/reports/trial-balance' },
    ],
    related: [
      'Why does my Balance Sheet not match the customer or supplier list?',
      'What is the Chart of Accounts?',
      'What is closing the books?',
    ],
  },
  {
    id: 'opening_balance_equity',
    category: 'Accounting',
    question: 'What is Opening Balance Equity (3300)?',
    keywords: [
      'what is opening balance equity', 'opening balance equity', '3300', 'what is 3300', 'equity account opening',
      'contra account opening',
    ],
    answer:
      'The account every opening balance is posted against, so the books balance on day one. It is a starting-point holding account, not real trading equity.',
    points: [
      'When you set an opening balance on an account, Tajir debits or credits that account and puts the other side in 3300.',
      'Your accountant will normally clear it into capital or retained earnings once the opening position is agreed.',
    ],
    related: ['What is an opening balance?', 'Why does my Balance Sheet not match?'],
  },
  {
    id: 'balance_sheet_mismatch',
    category: 'Accounting',
    question: 'Why does my Balance Sheet not match the customer or supplier list?',
    keywords: [
      'balance sheet not match', 'balance sheet does not match', 'balance sheet wrong',
      'receivable does not match', 'payable does not match', 'ledger mismatch',
      'accounts receivable missing', 'balance sheet mismatch',
    ],
    answer:
      'Most often because party opening balances were loaded but the matching ledger opening balances were not. The two are set in different places.',
    points: [
      'A customer or supplier opening balance sets that party’s own subledger — it drives their ledger, the aging reports and the dashboard.',
      'The Balance Sheet reads the general ledger, so it also needs an opening balance on 1130 Accounts Receivable and 2110 Accounts Payable, set from the Accounts page.',
      'Set those two to match your party totals and the statements agree.',
    ],
    links: [
      { label: 'Accounts', href: '/accounts' },
      { label: 'Opening Balances', href: '/settings/opening-balances' },
    ],
    related: ['What is an opening balance?', 'What is Opening Balance Equity?'],
  },
  {
    id: 'what_is_voucher',
    category: 'Accounting',
    question: 'What is a voucher?',
    keywords: ['what is a voucher', 'what is voucher', 'journal entry', 'manual entry', 'voucher kya'],
    answer:
      'A manual journal entry for something no document covers — a correction, a depreciation charge, an accrual. You choose the accounts and the debits and credits yourself.',
    points: [
      'Total debits must equal total credits; Tajir will not save an unbalanced voucher.',
      'Everything else in the app writes its vouchers automatically, so you rarely need this.',
    ],
    links: [{ label: 'Vouchers', href: '/vouchers' }],
    related: ['What is the Chart of Accounts?'],
  },
  {
    id: 'closing_books',
    category: 'Accounting',
    question: 'What is closing the books?',
    keywords: [
      'closing the books', 'close the books', 'lock period', 'period lock', 'freeze accounts',
      'financial year end', 'stop editing old',
    ],
    answer:
      'Locking a finished period so nothing dated on or before that date can be created, edited or deleted. It protects figures you have already reported.',
    points: [
      'Set it at Admin → Close the Books. Later dates carry on as normal.',
      'The rule is enforced by the database, so it holds everywhere — including the mobile app.',
      'You can move the lock date back if you genuinely need to reopen a period.',
    ],
    links: [{ label: 'Close the Books', href: '/settings/period-lock' }],
    related: ['Can I edit or delete an invoice after saving?'],
  },
  {
    id: 'aging_meaning',
    category: 'Accounting',
    question: 'What do the aging buckets mean?',
    keywords: [
      'aging', 'ageing', 'aging buckets', 'what is aging', '0-30', '90+ days', 'aging report',
      'overdue buckets',
    ],
    answer:
      'How long money has been outstanding, split into 0–30, 31–60, 61–90 and 90+ days. Anything to the right is money that has been owed a long time.',
    points: [
      'Payments are applied to the oldest bill first, so what remains in the old buckets is genuinely old.',
      'The dashboard shows the same split as a bar; the full report breaks it down party by party.',
    ],
    links: [
      { label: 'Receivables Aging', href: '/reports/receivables-aging' },
      { label: 'Payables Aging', href: '/reports/payables-aging' },
    ],
    related: ['Who owes me money', 'What is overdue'],
  },

  // ── Staff & admin ─────────────────────────────────────────────────
  {
    id: 'loan_vs_advance',
    category: 'Staff & admin',
    question: 'What is the difference between an employee loan and an advance?',
    keywords: [
      'loan or advance', 'loan vs advance', 'difference between loan and advance',
      'salary advance', 'employee advance', 'staff loan',
    ],
    answer:
      'Nothing, as far as Tajir is concerned — both are money the employee owes back, held in 1135 Employee Loans & Advances. The only difference is whether you set installments.',
    points: [
      'Give it out from the employee’s page: Disburse Loan / Advance.',
      'Recover it with Record Repayment, or Recover via Salary Deduction.',
      'It is never an expense while it is outstanding — it is an asset on your Balance Sheet.',
    ],
    links: [{ label: 'Employees', href: '/employees' }, { label: 'Loans', href: '/loans' }],
    related: ['Employee loans and advances'],
  },
  {
    id: 'owner_money',
    category: 'Staff & admin',
    question: 'How do I record money I take out of the business?',
    keywords: [
      'money i take out', 'owner withdrawal', 'drawings', 'personal use', 'owner money',
      'partner capital', 'put money in business', 'capital contribution',
    ],
    answer:
      'As an owner movement, not an expense. Record owners at Admin → Owners, then a Withdrawal when you take money out or a Contribution when you put it in.',
    points: [
      'Withdrawals post to 3400 Owner’s Drawings, so your profit is not distorted by personal spending.',
      'Each movement is tagged to a specific owner, so partners can be reported separately.',
    ],
    links: [{ label: 'Owners', href: '/owners' }],
    related: ['What is a voucher?'],
  },
  {
    id: 'who_can_delete',
    category: 'Staff & admin',
    question: 'Who can delete things, and can I see what was changed?',
    keywords: [
      'who can delete', 'audit log', 'track changes', 'who changed', 'history of changes',
      'deleted by mistake', 'see what changed',
    ],
    answer:
      'Deletions and settings are owner-only. Every change anyone makes is recorded in the Audit Log with the date, the user, the action and the data that changed.',
    points: ['Use it to trace a figure that moved unexpectedly, or to check an assistant’s work.'],
    links: [{ label: 'Audit Log', href: '/audit' }],
    related: ['What is the difference between Owner and Assistant?', 'What is closing the books?'],
  },
  {
    id: 'safe_to_experiment',
    category: 'Staff & admin',
    question: 'Can I try things without messing up my real data?',
    keywords: [
      'try without', 'try things without', 'messing up', 'without messing', 'test data', 'practice', 'experiment', 'demo data', 'playground',
      'training staff', 'sample data', 'mess up',
    ],
    answer:
      'Yes. Admin → Demo Playground generates realistic sample data you can work with, and removes all of it again in one click.',
    points: ['Good for training staff before letting them touch real records.'],
    links: [{ label: 'Demo Playground', href: '/playground' }],
    related: ['What is the difference between Owner and Assistant?'],
  },
  {
    id: 'get_help',
    category: 'Staff & admin',
    question: 'How do I get help if something is wrong?',
    keywords: [
      'get help', 'need help', 'support ticket', 'contact support', 'report a problem',
      'something is wrong', 'madad',
    ],
    answer:
      'Raise a ticket at Help → Support → New Ticket. You will get a reply in the same thread, and open tickets show as a banner on your dashboard.',
    points: [
      'There are also step-by-step video tutorials under Help → Help Videos, and the full written guide under Help → User Guide.',
    ],
    links: [
      { label: 'Support', href: '/support' },
      { label: 'Help Videos', href: '/help' },
      { label: 'User Guide', href: '/user-guide' },
    ],
  },
]

/**
 * Picks the FAQ a question is asking for.
 *
 * Mirrors the discipline in guides.ts: a topic keyword alone is not enough,
 * because "credit note" is also a thing a user might want listed rather than
 * explained. Either the wording carries a conceptual cue ("what is", "difference
 * between", "why does"), or the keyword itself is only ever a question.
 * Longest keyword wins, so the most specific entry answers.
 */
export function matchFaq(lowerQ: string): Faq | null {
  const cue = hasFaqCue(lowerQ)

  let best: Faq | null = null
  let bestLen = 0
  for (const f of FAQS) {
    for (const kw of f.keywords) {
      if (!lowerQ.includes(kw)) continue
      const selfEvident =
        kw.startsWith('what is') || kw.startsWith('what are') || kw.startsWith('why ') ||
        kw.startsWith('how do i') || kw.startsWith('can i') || kw.startsWith('who can') ||
        kw.includes('difference between') || kw.includes(' vs ') || kw.includes(' or ')
      if (!cue && !selfEvident) continue
      if (kw.length > bestLen) { bestLen = kw.length; best = f }
    }
  }
  return best
}

/** Phrases that ask for the whole list rather than one answer. */
export const FAQ_INDEX_KEYWORDS = [
  'faq', 'faqs', 'common questions', 'frequently asked', 'questions and answers',
  'new user guide', 'help me get started', 'onboarding', 'basics', 'teach me tajir',
]

export const faqsByCategory = (): { category: FaqCategory; questions: string[] }[] =>
  FAQ_CATEGORIES.map((category) => ({
    category,
    questions: FAQS.filter((f) => f.category === category).map((f) => f.question),
  })).filter((c) => c.questions.length > 0)

// How-to and concept answers for the Ask page.
//
// Everything else in Ask reports stored data. These answer the other half of
// what people type into a chat box — "how do I…" and "what is…" — which the
// data engine could only ever shrug at. They are static, hand-written and
// versioned with the app: no model, nothing inferred, same as the rest of Ask.
//
// Keep a guide in step with the screen it describes. Field names below are the
// actual labels on the forms.

export type Guide = {
  id: string
  title: string
  subtitle?: string
  /** Matched as substrings of the lowercased question. */
  keywords: string[]
  intro?: string
  steps: string[]
  notes?: string[]
  links?: { label: string; href: string }[]
  /** Offered as tappable follow-ups. */
  related?: string[]
}

// Phrases that make a question a request for instructions rather than data.
// "Kaise"/"tarika"/"tariqa" are the common Roman-Urdu equivalents.
const HOWTO_CUES = [
  'how to', 'how do i', 'how do we', 'how can i', 'how can we', 'how is', 'how are',
  'what is', 'what are', 'whats', "what's", 'explain', 'meaning of', 'concept',
  'steps to', 'step by step', 'procedure', 'guide', 'teach me', 'show me how',
  'help me', 'where do i', 'where can i', 'kaise', 'kese', 'tarika', 'tariqa', 'kya hai',
]

export const hasHowToCue = (lowerQ: string): boolean => HOWTO_CUES.some((c) => lowerQ.includes(c))

export const GUIDES: Guide[] = [
  {
    id: 'opening_balance_customers',
    title: 'Loading customer opening balances',
    subtitle: 'What each customer already owed you on the day you started',
    keywords: [
      'opening balance of customer', 'customer opening balance', 'opening balance customer',
      'customers opening balance', 'opening balances of customers', 'upload customer balance',
      'customer old balance', 'previous balance of customer', 'customer purana balance',
    ],
    intro: 'Enter what a customer already owed you before Tajir. Owner access only.',
    steps: [
      'Adding a new customer? Sales → Customers → Add Customer captures the opening balance on the same form.',
      'For a customer already on file: Sales → Customers, then the pencil on their row.',
      'Set Opening Balance. Choose PKR, or USD and enter the exchange rate — Tajir stores the PKR equivalent.',
      'Save. The balance shows immediately in their ledger, in Receivables on the dashboard, and in Receivables Aging.',
      'Doing many at once? Settings → Opening Balances → Customer Opening Balances lists every customer in one table.',
    ],
    notes: [
      'A positive figure means the customer owes you. Enter a negative figure for an advance they have already paid you.',
      'Enter the amount NET of any post-dated cheque you have already loaded for them — otherwise the cheque is counted twice.',
      'This sets the customer subledger. For the Balance Sheet to agree, also set the opening balance on 1130 Accounts Receivable at Accounts, which posts DR 1130 / CR 3300 Opening Balance Equity.',
    ],
    links: [
      { label: 'Customers', href: '/customers' },
      { label: 'Settings → Opening Balances', href: '/settings/opening-balances' },
      { label: 'Chart of Accounts', href: '/accounts' },
    ],
    related: ['How to load supplier opening balances', 'How to load opening stock', 'What is PDC'],
  },
  {
    id: 'opening_balance_suppliers',
    title: 'Loading supplier opening balances',
    subtitle: 'What you already owed each supplier on the day you started',
    keywords: [
      'opening balance of supplier', 'supplier opening balance', 'opening balance supplier',
      'suppliers opening balance', 'opening balances of suppliers', 'upload supplier balance',
      'supplier old balance', 'previous balance of supplier', 'vendor opening balance',
    ],
    intro: 'Enter what you already owed a supplier before Tajir. Owner access only.',
    steps: [
      'Adding a new supplier? Procurement → Suppliers → Add Supplier captures the opening balance on the same form.',
      'For a supplier already on file: Procurement → Suppliers, then the pencil on their row.',
      'Set Opening Balance. Choose PKR, or USD and enter the exchange rate.',
      'Save. It shows immediately in their ledger, in Payables on the dashboard, and in Payables Aging.',
      'Doing many at once? Settings → Opening Balances → Supplier Opening Balances lists every supplier in one table.',
    ],
    notes: [
      'A positive figure means you owe the supplier. Enter a negative figure for an advance you have already paid them.',
      'Enter the amount NET of any post-dated cheque you have already issued and loaded — otherwise it is counted twice.',
      'This sets the supplier subledger. For the Balance Sheet to agree, also set the opening balance on 2110 Accounts Payable at Accounts, which posts DR 3300 Opening Balance Equity / CR 2110.',
    ],
    links: [
      { label: 'Suppliers', href: '/suppliers' },
      { label: 'Settings → Opening Balances', href: '/settings/opening-balances' },
      { label: 'Chart of Accounts', href: '/accounts' },
    ],
    related: ['How to load customer opening balances', 'How to load opening stock', 'What is PDC'],
  },
  {
    id: 'opening_stock',
    title: 'Loading opening stock, location wise',
    subtitle: 'Quantity, cost rate and warehouse for stock you already held',
    keywords: [
      'opening stock', 'opening balance of item', 'item opening balance', 'stock opening balance',
      'opening balance of stock', 'opening inventory', 'inventory opening balance', 'opening quantity',
      'stock location wise', 'location wise stock', 'stock by location', 'opening balance item stock',
      'upload stock', 'load stock', 'starting stock',
    ],
    intro: 'Bring the stock you were already holding onto the books, with its cost and its warehouse.',
    steps: [
      'Create your warehouses first: Inventory → Locations → Add Location.',
      'Create each stock item: Inventory → Add New Item.',
      'Go to Settings → Opening Balances → Stock Item Quantities.',
      'Click the pencil on an item and set Location, Quantity, and Rate (your cost per unit).',
      'Save. Value is computed as quantity × rate and totalled at the foot of the table.',
    ],
    notes: [
      'The rate is what stock valuation and profit are calculated from, so use your actual cost, not the selling price.',
      'An item carries ONE opening location here. To split the same item across two warehouses, load the whole quantity at the main one and then move part of it with Inventory → Stock Transfers.',
      'Location matters at sale time: a sale can only draw stock that is at the location you pick in Dispatch From.',
      'Owner access only.',
    ],
    links: [
      { label: 'Settings → Opening Balances', href: '/settings/opening-balances' },
      { label: 'Inventory', href: '/inventory' },
      { label: 'Locations', href: '/locations' },
      { label: 'Stock Transfers', href: '/stock-transfers' },
    ],
    related: ['How to load customer opening balances', 'How to create a sale invoice', 'Stock summary'],
  },
  {
    id: 'sale_invoice',
    title: 'Creating a sale invoice',
    keywords: [
      'create sale', 'make sale', 'sale invoice', 'sales invoice', 'new sale', 'add sale',
      'raise invoice', 'create invoice', 'make invoice', 'bill banao', 'invoice banao', 'sale entry',
      'record a sale', 'book a sale',
    ],
    steps: [
      'Sales → New Sale (or the New Sale button on the dashboard).',
      'Pick the Customer, the Sale Date, and Dispatch From — the location the goods leave.',
      'Add a line per item: choose the item, then Quantity and Rate. If you keep a price list for that customer, the rate fills in automatically.',
      'Set Currency. For USD, enter the exchange rate and Tajir stores the PKR equivalent.',
      'Optional: Due Days (which fills Payment Due), PO No., DC No., and Notes.',
      'Save. Stock leaves the chosen location and the customer’s balance goes up.',
    ],
    notes: [
      'You cannot sell more than the quantity held at the chosen location — the form blocks it with an Insufficient Stock error.',
      'If a line is priced below its cost, a confirmation appears before saving.',
      'Service items have no stock, so they never block a sale.',
      'After saving you can print a compact voucher or a full-page A4 invoice.',
    ],
    links: [
      { label: 'New Sale', href: '/sales/new' },
      { label: 'All Sales', href: '/sales' },
    ],
    related: ['How to create a sale return', 'How to create a purchase order', 'What is PDC'],
  },
  {
    id: 'purchase_order',
    title: 'Creating a purchase order',
    keywords: [
      'create purchase', 'make purchase', 'purchase order', 'new purchase', 'add purchase',
      'purchase entry', 'purchase invoice', 'record a purchase', 'book a purchase', 'kharid',
      'buy goods', 'goods received',
    ],
    steps: [
      'Procurement → Purchases → New Purchase.',
      'Pick the Supplier, the Date, and Receive At — the location the goods arrive into.',
      'Add a line per item: item, Quantity, Rate.',
      'Set Currency; for USD enter the exchange rate.',
      'Enter the Supplier Invoice No. so you can find the purchase by the supplier’s own document number later.',
      'If you paid something at the time, enter it in Advance Paid (PKR).',
      'Save. Stock increases at that location and the supplier’s balance goes up by the unpaid remainder.',
    ],
    notes: [
      'Advance Paid is deducted on the invoice itself, so only the remainder appears in Payables and Payables Aging.',
      'Deleting a purchase is blocked if it would drive stock negative.',
    ],
    links: [
      { label: 'New Purchase', href: '/purchases/new' },
      { label: 'All Purchases', href: '/purchases' },
    ],
    related: ['How to create a purchase return', 'How to create a sale invoice', 'Who do I owe'],
  },
  {
    id: 'sale_return',
    title: 'Recording a sale return',
    subtitle: 'Goods a customer has sent back',
    keywords: [
      'sale return', 'sales return', 'customer return', 'return from customer', 'goods returned by customer',
      'create sale return', 'wapsi', 'sale wapas',
    ],
    steps: [
      'Sales → Sale Returns → New.',
      'Optional but recommended: pick Against Sale Order to pull the original item, quantity and rate from the invoice being returned.',
      'Set the Customer, Return Date and Location — the warehouse the goods come back into.',
      'Enter the item, Quantity and Rate, plus a Reason.',
      'Save. Stock comes back in and the customer’s balance comes down.',
    ],
    notes: [
      'Sale returns are owner-only — an assistant cannot open the form.',
      'A return reduces receivables. If you would rather adjust the balance without goods moving, use a Credit Note instead.',
    ],
    links: [
      { label: 'New Sale Return', href: '/sale-returns/new' },
      { label: 'Sale Returns', href: '/sale-returns' },
      { label: 'Credit Notes', href: '/credit-notes' },
    ],
    related: ['How to create a purchase return', 'How to create a sale invoice'],
  },
  {
    id: 'purchase_return',
    title: 'Recording a purchase return',
    subtitle: 'Goods you have sent back to a supplier',
    keywords: [
      'purchase return', 'purchases return', 'supplier return', 'return to supplier',
      'goods returned to supplier', 'create purchase return', 'kharid wapsi',
    ],
    steps: [
      'Procurement → Purchase Returns → New.',
      'Optional but recommended: pick Against Purchase Order to pull the original item, quantity and rate.',
      'Set the Supplier, Return Date and Location — the warehouse the goods leave from.',
      'Enter the item, Quantity and Rate, plus a Reason.',
      'Save. Stock goes out and what you owe the supplier comes down.',
    ],
    notes: [
      'The return is blocked if it would take stock at that location below zero.',
      'To adjust a supplier balance without goods moving, use a Debit Note instead.',
    ],
    links: [
      { label: 'New Purchase Return', href: '/purchase-returns/new' },
      { label: 'Purchase Returns', href: '/purchase-returns' },
      { label: 'Debit Notes', href: '/debit-notes' },
    ],
    related: ['How to create a sale return', 'How to create a purchase order'],
  },
  {
    id: 'pdc_concept',
    title: 'Post-dated cheques (PDC)',
    subtitle: 'What they are and how Tajir tracks them',
    keywords: [
      'what is pdc', 'pdc concept', 'concept of pdc', 'pdc meaning', 'explain pdc', 'about pdc',
      'post dated cheque', 'post-dated cheque', 'postdated cheque', 'pdc kya', 'pdc kaise',
      'how pdc works', 'pdc work', 'cheque concept', 'what is post dated',
    ],
    intro:
      'A post-dated cheque carries a future date, so it is a promise rather than money. Tajir keeps it in its own account until it actually clears, so your cash is never overstated.',
    steps: [
      'Recording one: on a Receipt or Payment (also refunds, loans and owner movements), add a tender line and set its type to PDC.',
      'Cheque No. and Due Date are both required on a PDC line — without the due date it can never show as overdue.',
      'Save. A cheque you RECEIVE is debited to 1112 Post-Dated Cheques Received (an asset). A cheque you ISSUE is credited to 2115 Post-Dated Cheques Issued (a liability). Either way the party’s balance settles right away, because the cheque has changed hands.',
      'Watch them at Reports → Cheque Register: everything pending, by due date, with overdue flagged.',
      'When the bank acts on it, settle it there — Cleared or Bounced.',
    ],
    notes: [
      'Cleared moves the amount between 1112/2115 and your bank. The party’s balance does not move, because it settled when you took the cheque.',
      'Bounced undoes it: the amount goes back onto the party’s balance, so they owe you again (or you owe them again).',
      'Endorsed means you handed a cheque you received straight on to a supplier instead of banking it. The source cheque is consumed so it can never also be cleared into your account — but it can still bounce.',
      'Cheques that already existed before you started using Tajir are loaded at Settings → Opening Balances → Post-Dated Cheques, one row per cheque with its number, amount and due date.',
    ],
    links: [
      { label: 'Cheque Register', href: '/reports/pdc-register' },
      { label: 'Settings → Opening Balances', href: '/settings/opening-balances' },
      { label: 'New Receipt', href: '/receipts/new' },
      { label: 'New Payment', href: '/payments/new' },
    ],
    related: ['Pending cheques', 'Overdue cheques', 'Cheque summary'],
  },
  {
    id: 'employee_loans',
    title: 'Employee loans and advances',
    keywords: [
      'employee loan', 'employees loan', 'staff loan', 'loan and advance', 'loans and advances',
      'employee advance', 'staff advance', 'advance to employee', 'give loan', 'disburse loan',
      'loan to staff', 'qarz', 'employee qarz', 'salary advance', 'loan repayment',
    ],
    intro:
      'Money lent to a member of staff is not an expense — it is owed back, so Tajir holds it in 1135 Employee Loans & Advances until it is recovered.',
    steps: [
      'Add the person first: Accounts → Employees → Add Employee.',
      'Open the employee and choose Disburse Loan / Advance.',
      'Enter the amount, Date and Currency (with the exchange rate for USD).',
      'Set Installments and the First Due Date if it is to be repaid in parts, and add a Note.',
      'Choose how the money leaves — cash, bank, or a PDC cheque — on the tender lines, then save.',
      'Recovering it: open the employee and use Record Repayment for cash or bank, or Recover via Salary Deduction to take it out of pay.',
    ],
    notes: [
      'Accounts → Loans lists every loan with the amount still outstanding per employee and the installment schedule.',
      'An advance against salary and a loan are recorded the same way — the difference is only whether you set installments.',
      'Paying out by PDC works exactly like any other cheque: it sits in 2115 until it clears, and appears in the Cheque Register.',
    ],
    links: [
      { label: 'Employees', href: '/employees' },
      { label: 'Loans', href: '/loans' },
    ],
    related: ['What is PDC', 'How to create a purchase order'],
  },
]

/**
 * Picks the guide a question is asking for.
 *
 * A topic keyword alone is not enough — "sale invoice of Ali Traders" wants
 * data, not instructions. Either the question carries an explicit how-to cue,
 * or the keyword itself has to be unambiguously instructional ("what is pdc").
 * Longest keyword wins so "customer opening balance" beats "opening balance".
 */
export function matchGuide(lowerQ: string): Guide | null {
  const cue = hasHowToCue(lowerQ)

  let best: Guide | null = null
  let bestLen = 0
  for (const g of GUIDES) {
    for (const kw of g.keywords) {
      if (!lowerQ.includes(kw)) continue
      // Without a how-to cue, only a self-evidently instructional phrase counts.
      const selfEvident = kw.startsWith('what is') || kw.startsWith('how ') || kw.includes('concept') || kw.includes('meaning')
      if (!cue && !selfEvident) continue
      if (kw.length > bestLen) { bestLen = kw.length; best = g }
    }
  }
  return best
}

/** All topics, for "help" / "what can you explain". */
export const GUIDE_INDEX_KEYWORDS = [
  'help topics', 'what can you explain', 'what can you tell me', 'how do i use tajir',
  'how to use tajir', 'user guide', 'tutorial', 'topics', 'how do i use this',
]

export const GUIDE_TITLES = GUIDES.map((g) => g.title)

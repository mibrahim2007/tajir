'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BookOpen, Printer } from 'lucide-react'

/* ─── helpers ─────────────────────────────────── */
function H2({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <h2 className="text-lg font-extrabold tracking-tight text-foreground mt-8 mb-3 pb-2 border-b border-border flex items-center gap-2 print:text-black print:border-gray-300">
      <span className="text-[11px] font-bold bg-primary text-primary-foreground rounded-full h-6 w-6 flex items-center justify-center shrink-0 print:bg-gray-800">{n}</span>
      {children}
    </h2>
  )
}
function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="font-bold text-foreground mt-4 mb-1.5 print:text-black">{children}</h3>
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground leading-relaxed mb-2 print:text-gray-700">{children}</p>
}
function Li({ children }: { children: React.ReactNode }) {
  return <li className="text-sm text-muted-foreground leading-relaxed print:text-gray-700">{children}</li>
}
function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc pl-5 space-y-1 mb-3">{children}</ul>
}
function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 rounded-lg px-4 py-2.5 text-sm text-amber-800 dark:text-amber-300 my-3 print:bg-gray-100 print:border-gray-400 print:text-gray-700">
      <strong>Note: </strong>{children}
    </div>
  )
}
function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 items-start mb-2">
      <span className="shrink-0 h-5 w-5 rounded-full bg-accent text-primary text-[10px] font-extrabold flex items-center justify-center mt-0.5 print:bg-gray-200 print:text-black">{n}</span>
      <span className="text-sm text-muted-foreground print:text-gray-700">{children}</span>
    </div>
  )
}

type Report = { name: string; desc: string }
function ReportTable({ rows }: { rows: Report[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border my-3 print:border-gray-300">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 print:bg-gray-100">
          <tr>
            <th className="text-left px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground print:text-gray-600">Report</th>
            <th className="text-left px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground print:text-gray-600">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border print:divide-gray-200">
          {rows.map(r => (
            <tr key={r.name} className="hover:bg-muted/20">
              <td className="px-4 py-2.5 font-semibold whitespace-nowrap print:text-black">{r.name}</td>
              <td className="px-4 py-2.5 text-muted-foreground print:text-gray-600">{r.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ─── Urdu helpers (RTL) ─────────────────────── */
function UH2({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <h2 className="text-lg font-extrabold tracking-tight text-foreground mt-8 mb-3 pb-2 border-b border-border flex items-center gap-2 flex-row-reverse print:text-black print:border-gray-300">
      <span className="text-[11px] font-bold bg-primary text-primary-foreground rounded-full h-6 w-6 flex items-center justify-center shrink-0 print:bg-gray-800">{n}</span>
      {children}
    </h2>
  )
}
function UH3({ children }: { children: React.ReactNode }) {
  return <h3 className="font-bold text-foreground mt-4 mb-1.5 print:text-black">{children}</h3>
}
function UP({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground leading-loose mb-2 print:text-gray-700">{children}</p>
}
function ULi({ children }: { children: React.ReactNode }) {
  return <li className="text-sm text-muted-foreground leading-loose print:text-gray-700">{children}</li>
}
function UUl({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc pr-5 pl-0 space-y-1 mb-3">{children}</ul>
}
function UNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 rounded-lg px-4 py-2.5 text-sm text-amber-800 dark:text-amber-300 my-3 print:bg-gray-100 print:border-gray-400 print:text-gray-700">
      <strong>نوٹ: </strong>{children}
    </div>
  )
}
function UStep({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 items-start mb-2 flex-row-reverse">
      <span className="shrink-0 h-5 w-5 rounded-full bg-accent text-primary text-[10px] font-extrabold flex items-center justify-center mt-0.5 print:bg-gray-200 print:text-black">{n}</span>
      <span className="text-sm text-muted-foreground print:text-gray-700">{children}</span>
    </div>
  )
}
type UReport = { name: string; desc: string }
function UReportTable({ rows }: { rows: UReport[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border my-3 print:border-gray-300">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 print:bg-gray-100">
          <tr>
            <th className="text-right px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground print:text-gray-600">رپورٹ</th>
            <th className="text-right px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground print:text-gray-600">تفصیل</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border print:divide-gray-200">
          {rows.map(r => (
            <tr key={r.name}>
              <td className="px-4 py-2.5 font-semibold whitespace-nowrap print:text-black text-right">{r.name}</td>
              <td className="px-4 py-2.5 text-muted-foreground print:text-gray-600 text-right">{r.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ─── REPORTS DATA ───────────────────────────── */
const EN_REPORTS: Report[] = [
  { name: 'Pending Balance', desc: 'Purchase and sale orders not yet fully received or dispatched via gatepass.' },
  { name: 'Item Ledger', desc: 'All movements for one stock item between dates with running balance.' },
  { name: 'Item Profit & Loss', desc: 'Revenue, cost and gross profit for a single item with per-transaction detail.' },
  { name: 'Customer Profit & Loss', desc: 'Gross profit per customer — summary of all or drill into one customer.' },
  { name: 'Purchase & Sales', desc: 'Date-range summary of all purchases and sales with totals.' },
  { name: 'Stock Summary', desc: 'Current quantities for all stock items.' },
  { name: 'Stock Valuation', desc: 'Stock value in PKR using the latest purchase rate per item.' },
  { name: 'Location-wise Stock', desc: 'Stock quantities broken down by warehouse location.' },
  { name: 'Receivables Aging', desc: 'Customer outstanding balances by 0–30, 31–60, 61–90, 90+ day buckets.' },
  { name: 'Payables Aging', desc: 'Supplier outstanding balances by aging bucket.' },
  { name: 'Profit & Loss', desc: 'Full income statement — revenue, COGS, expenses, and net profit.' },
  { name: 'Balance Sheet', desc: 'Assets, liabilities and equity as of any date.' },
  { name: 'Trial Balance', desc: 'All GL account balances — verifies debits equal credits.' },
  { name: 'General Ledger', desc: 'Full double-entry ledger with running balance per account.' },
  { name: 'Daily Cashbook', desc: 'Cash and bank movements for a single day with opening and closing balances.' },
  { name: 'Bank Statement', desc: 'All transactions for one bank account over a date range.' },
]

const UR_REPORTS: UReport[] = [
  { name: 'زیر التواء بیلنس', desc: 'ادھوری خریداری اور فروخت جو ابھی گیٹ پاس نہیں ہوئی۔' },
  { name: 'آئٹم لیجر', desc: 'ایک اسٹاک آئٹم کی تمام حرکات بمع رننگ بیلنس۔' },
  { name: 'آئٹم نفع و نقصان', desc: 'ایک آئٹم کی آمدنی، لاگت اور نفع کی تفصیل۔' },
  { name: 'گاہک نفع و نقصان', desc: 'فروخت اور لاگت کی بنیاد پر ہر گاہک کا نفع۔' },
  { name: 'خرید و فروخت', desc: 'تمام خریداری اور فروخت کا تاریخی خلاصہ۔' },
  { name: 'اسٹاک خلاصہ', desc: 'تمام آئٹمز کی موجودہ مقدار۔' },
  { name: 'اسٹاک ویلیویشن', desc: 'موجودہ اسٹاک کی قیمت (آخری خرید ریٹ کے مطابق)۔' },
  { name: 'مقام بہ مقام اسٹاک', desc: 'ہر گودام یا مقام پر اسٹاک کی مقدار۔' },
  { name: 'وصولی بڑھاپا', desc: 'گاہکوں کا بقایا مدت کے مطابق (۳۰، ۶۰، ۹۰ دن)۔' },
  { name: 'ادائیگی بڑھاپا', desc: 'سپلائرز کا بقایا مدت کے مطابق۔' },
  { name: 'نفع و نقصان', desc: 'مکمل آمدنی کا بیان — آمدنی، لاگت اور خالص نفع۔' },
  { name: 'بیلنس شیٹ', desc: 'کسی بھی تاریخ کے اثاثے، واجبات اور ایکوئٹی۔' },
  { name: 'ٹرائل بیلنس', desc: 'تمام حسابات کا بیلنس — ڈیبٹ = کریڈٹ تصدیق۔' },
  { name: 'جنرل لیجر', desc: 'ہر حساب کا مکمل دہری اندراج لیجر۔' },
  { name: 'روزانہ کیش بک', desc: 'ایک دن کی نقدی آمد و رفت اور ابتدائی و اختتامی بیلنس۔' },
  { name: 'بینک اسٹیٹمنٹ', desc: 'منتخب بینک اکاؤنٹ کا تاریخی بیان۔' },
]

/* ─── MAIN COMPONENT ─────────────────────────── */
export function GuideContent() {
  const [lang, setLang] = useState<'en' | 'ur'>('en')

  return (
    <div className="min-h-screen bg-background">
      {/* ── font for Urdu ── */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&display=swap');
        .urdu-guide { font-family: 'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', 'Nafees Web Naskh', serif; }
        @media print {
          .guide-en, .guide-ur { display: block !important; }
          .guide-ur { break-before: page; }
          .print-hide { display: none !important; }
        }
      `}</style>

      {/* ── header ── */}
      <div className="print-hide sticky top-0 z-10 bg-background/95 backdrop-blur border-b flex items-center gap-3 px-6 py-3.5">
        <Link href="/dashboard" className="text-xs text-muted-foreground hover:text-foreground shrink-0">← Dashboard</Link>
        <div className="flex-1 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary shrink-0" />
          <h1 className="text-base font-extrabold tracking-tight">User Guide</h1>
          <span className="text-muted-foreground text-xs">/ راہنما</span>
        </div>
        {/* Language switcher */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <button onClick={() => setLang('en')}
            className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${lang === 'en' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            English
          </button>
          <button onClick={() => setLang('ur')}
            className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${lang === 'ur' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            اردو
          </button>
        </div>
        <button onClick={() => window.print()}
          className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 border rounded-lg hover:bg-secondary transition-colors">
          <Printer className="h-3.5 w-3.5" /> Save PDF
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 print:px-0 print:py-0 print:max-w-none">

        {/* ═══════════════════════════════════════════
            ENGLISH SECTION
        ═══════════════════════════════════════════ */}
        <div className={`guide-en ${lang === 'ur' ? 'hidden' : ''}`}>

          {/* print cover */}
          <div className="hidden print:block text-center mb-10 pb-6 border-b-2 border-black">
            <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">Tajir Business Management Software</p>
            <h1 className="text-4xl font-extrabold">User Guide</h1>
            <p className="text-sm text-gray-500 mt-3">Complete guide to all features and reports</p>
          </div>

          <H2 n="1">Introduction</H2>
          <P>
            <strong>Tajir</strong> is a complete business management platform for traders — covering purchases, sales, stock, customers, suppliers, accounting, and reports in one place.
            It supports two currencies (PKR and USD), multiple warehouse locations, and a full double-entry accounting system.
          </P>
          <Ul>
            <Li>Role-based access: <strong>Owner</strong> has full control; <strong>Assistant</strong> can record transactions but cannot change settings or view all users&apos; data.</Li>
            <Li>All monetary amounts are stored and reported in PKR. USD transactions convert at the exchange rate you enter.</Li>
            <Li>Every report can be printed or saved as PDF using your browser&apos;s print dialog.</Li>
          </Ul>

          <H2 n="2">Getting Started — First-Time Setup</H2>
          <P>After logging in, set up your business in this order before recording any transactions:</P>
          <Step n={1}>Go to <strong>Settings → Item Types</strong> and add your product categories (e.g., Yarn, Grey Fabric, Accessories).</Step>
          <Step n={2}>Go to <strong>Inventory</strong> and add each stock item with its name, code, fiber type, count, and category.</Step>
          <Step n={3}>Go to <strong>Settings → Opening Balances</strong> and enter the initial quantity and purchase rate for stock you already had.</Step>
          <Step n={4}>Go to <strong>Finance → Customers</strong> and add your customers. Enter an opening balance if they already owe you money.</Step>
          <Step n={5}>Go to <strong>Finance → Suppliers</strong> and add your suppliers.</Step>
          <Step n={6}>Go to <strong>Accounts → Chart of Accounts</strong> to set up your GL accounts (or upload a CSV).</Step>
          <Step n={7}>Go to <strong>Settings → Banks</strong> to add your bank accounts.</Step>

          <H2 n="3">Dashboard</H2>
          <P>The dashboard gives you a real-time overview of your business.</P>
          <H3>KPI Cards</H3>
          <Ul>
            <Li><strong>Revenue</strong> — total sales value for the selected period (PKR).</Li>
            <Li><strong>Purchases</strong> — total purchase value for the selected period (PKR).</Li>
            <Li><strong>Outstanding</strong> — total unpaid balance across all customers.</Li>
            <Li><strong>Stock Items</strong> — total number of distinct stock items in inventory.</Li>
          </Ul>
          <H3>Charts</H3>
          <P>The line chart shows monthly revenue (teal) vs. purchases (dashed) for the last 6 months. The pie chart shows your top-selling items by value.</P>
          <H3>Quick Actions</H3>
          <P>One-click links to the most common tasks: Add Purchase, Add Sale, Add Receipt, Add Payment, New Gatepass, View Reports.</P>
          <H3>Support Notification</H3>
          <P>If you have open support tickets, an amber banner appears at the top of the dashboard and a red badge shows on the Support menu item.</P>

          <H2 n="4">Inventory Management</H2>
          <H3>Item Types</H3>
          <P>Item types are categories for your stock items. Add them at <strong>Settings → Item Types</strong>. Examples: Yarn, Grey Fabric, Chemicals.</P>
          <H3>Stock Items</H3>
          <P>Each stock item represents a specific product you buy and sell. Fields include:</P>
          <Ul>
            <Li><strong>Name</strong> — the item name (required).</Li>
            <Li><strong>Code</strong> — your internal product code (optional).</Li>
            <Li><strong>Count</strong> — yarn count or specification (optional).</Li>
            <Li><strong>Fiber</strong> — material type, e.g., Cotton, Polyester (optional).</Li>
            <Li><strong>Type</strong> — the Item Type category (optional).</Li>
          </Ul>
          <P>Add items at <strong>Inventory → Add New Item</strong>. Edit or deactivate from the item list.</P>
          <H3>Opening Balances</H3>
          <P>For stock you had before starting Tajir, set the initial quantity and purchase rate at <strong>Settings → Opening Balances</strong>. The rate is used in stock valuation and profit calculations.</P>

          <H2 n="5">Purchases</H2>
          <P>Record goods you have bought from a supplier.</P>
          <Step n={1}>Go to <strong>Purchases → Add New Purchase</strong>.</Step>
          <Step n={2}>Select the supplier, date, and location (warehouse).</Step>
          <Step n={3}>Add one or more line items — select item, enter quantity and rate.</Step>
          <Step n={4}>Select currency: PKR or USD. If USD, enter the exchange rate; Tajir converts to PKR automatically.</Step>
          <Step n={5}>Save. Stock increases immediately.</Step>
          <Note>You can edit or delete a purchase later. If deleting would make stock negative, the system will block the action.</Note>

          <H2 n="6">Purchase Returns</H2>
          <P>Record goods returned to a supplier (e.g., damaged or wrong items).</P>
          <Step n={1}>Go to <strong>Purchase Returns → Add New Return</strong>.</Step>
          <Step n={2}>Select the supplier, item, quantity, and rate.</Step>
          <Step n={3}>Save. Stock decreases by the returned quantity.</Step>
          <Note>If the return would make available stock go below zero, the system blocks the transaction to protect stock accuracy.</Note>

          <H2 n="7">Sales</H2>
          <P>Record goods sold to a customer.</P>
          <Step n={1}>Go to <strong>Sales → Add New Sale</strong>.</Step>
          <Step n={2}>Select the customer, date, and location.</Step>
          <Step n={3}>Add line items — select item, enter quantity and rate.</Step>
          <Step n={4}>Select currency (PKR or USD) and save.</Step>
          <Note>You cannot sell more than the available stock. If you try, the system shows an <strong>Insufficient Stock</strong> error and blocks the sale.</Note>

          <H2 n="8">Sale Returns</H2>
          <P>Record goods returned by a customer.</P>
          <Step n={1}>Go to <strong>Sale Returns → Add New Return</strong>.</Step>
          <Step n={2}>Select the customer, item, quantity, and rate.</Step>
          <Step n={3}>Save. Stock increases by the returned quantity. The customer&apos;s balance adjusts accordingly.</Step>

          <H2 n="9">Gatepasses</H2>
          <P>Gatepasses track the physical movement of goods at your gate/warehouse door.</P>
          <H3>Inward Gatepass</H3>
          <P>Created when a vehicle arrives with purchased goods. Link it to a purchase order to track how much of an order has been received vs. still pending.</P>
          <H3>Outward Gatepass</H3>
          <P>Created when a vehicle departs with sold goods. Link it to a sale order to track dispatch progress.</P>
          <P>The <strong>Pending Balance</strong> report shows all orders with outstanding quantities not yet covered by a gatepass.</P>
          <P>You can print any gatepass for a physical gate record.</P>

          <H2 n="10">Locations & Stock Transfers</H2>
          <H3>Locations</H3>
          <P>Define multiple warehouse or storage locations at <strong>Settings → Locations → Add Location</strong>. When recording purchases and sales, select which location the stock moves to or from.</P>
          <H3>Stock Transfers</H3>
          <P>Move stock between locations:</P>
          <Step n={1}>Go to <strong>Stock Transfers → New Transfer</strong>.</Step>
          <Step n={2}>Select source location, destination location, item, and quantity.</Step>
          <Step n={3}>Save. The <strong>Location-wise Stock</strong> report updates automatically.</Step>

          <H2 n="11">Customers & Receipts</H2>
          <H3>Customers</H3>
          <P>Add and manage your customers at <strong>Finance → Customers</strong>. You can store name, phone, address, and set an opening balance (amount already owed before you started using Tajir).</P>
          <H3>Receipts</H3>
          <P>Record payments received from customers at <strong>Finance → Receipts → Add Receipt</strong>.</P>
          <Ul>
            <Li>Select the customer and enter the amount received.</Li>
            <Li>The customer&apos;s outstanding balance decreases when a receipt is saved.</Li>
            <Li>Receipts post to the accounting ledger automatically.</Li>
          </Ul>

          <H2 n="12">Suppliers & Payments</H2>
          <H3>Suppliers</H3>
          <P>Add your suppliers at <strong>Finance → Suppliers</strong> with name, phone, and contact details.</P>
          <H3>Payments</H3>
          <P>Record payments made to suppliers at <strong>Finance → Payments → Add Payment</strong>.</P>
          <Ul>
            <Li>Select the supplier and enter the amount paid.</Li>
            <Li>The supplier&apos;s outstanding balance decreases when a payment is saved.</Li>
          </Ul>

          <H2 n="13">Pricing</H2>
          <P>Set default or agreed selling prices per item per customer at <strong>Finance → Pricing</strong>. When creating a sale, the system can pre-fill the agreed rate for the selected customer and item.</P>

          <H2 n="14">Expenses</H2>
          <P>Record operating expenses (rent, salaries, utilities, transport, etc.) at <strong>Finance → Expenses → Add Expense</strong>.</P>
          <Ul>
            <Li>Select the expense account from your Chart of Accounts.</Li>
            <Li>Enter the amount, date, and description.</Li>
            <Li>Expenses appear in the Profit & Loss report and affect your net profit.</Li>
          </Ul>

          <H2 n="15">Chart of Accounts</H2>
          <P>The Chart of Accounts is the list of all your general ledger (GL) accounts — the foundation of double-entry accounting.</P>
          <H3>Account Types</H3>
          <Ul>
            <Li><strong>Asset</strong> — what your business owns (cash, bank, receivables, inventory).</Li>
            <Li><strong>Liability</strong> — what your business owes (payables, loans).</Li>
            <Li><strong>Equity</strong> — owner&apos;s capital and retained earnings.</Li>
            <Li><strong>Revenue</strong> — income from sales.</Li>
            <Li><strong>Expense</strong> — operating costs.</Li>
          </Ul>
          <H3>Adding Accounts</H3>
          <P>Go to <strong>Accounts → Chart of Accounts → Add Account</strong> and fill in the account code, name, and type.</P>
          <H3>CSV Upload</H3>
          <P>To add accounts in bulk, prepare a CSV with columns: <code>code, name, type</code> and upload it on the Chart of Accounts page. This is the fastest way to migrate from an existing accounting system.</P>

          <H2 n="16">Vouchers</H2>
          <P>Vouchers are manual journal entries for accounting adjustments not covered by purchases, sales, or receipts.</P>
          <Step n={1}>Go to <strong>Accounts → Vouchers → New Voucher</strong>.</Step>
          <Step n={2}>Add debit and credit lines — each line has an account and an amount.</Step>
          <Step n={3}>Total debits must equal total credits. The system enforces this rule.</Step>
          <Step n={4}>Save. The voucher posts to the General Ledger immediately.</Step>

          <H2 n="17">Reports</H2>
          <P>All 16 reports are available from the <strong>Reports</strong> menu. Use the date range filters on each report. Every report has a Print / Save as PDF button.</P>
          <ReportTable rows={EN_REPORTS} />
          <Note>Cost figures (COGS) in the P&L reports are estimated using the <em>latest purchase rate</em> per item. Opening balance rate is used for stock that was entered as an opening balance.</Note>

          <H2 n="18">Settings</H2>
          <H3>Item Types</H3>
          <P>Product categories used to group stock items. Add, rename, or remove at <strong>Settings → Item Types</strong>.</P>
          <H3>Team Management</H3>
          <P>Invite team members at <strong>Settings → Team → Invite Member</strong>.</P>
          <Ul>
            <Li><strong>Owner</strong> — full access to all features and settings.</Li>
            <Li><strong>Assistant</strong> — can create purchases, sales, gatepasses, and view their own transactions. Cannot access Settings, Accounts, or other users&apos; records.</Li>
          </Ul>
          <H3>Banks</H3>
          <P>Add bank accounts at <strong>Settings → Banks</strong>. Bank accounts appear in the Cashbook, Bank Statement, and Chart of Accounts.</P>
          <H3>Audit Log</H3>
          <P>Every change in the system is recorded in the Audit Log at <strong>Settings → Audit</strong>. Each entry shows the date, user, action, and the data that changed. Useful for reviewing edits or investigating discrepancies.</P>

          <H2 n="19">Support</H2>
          <P>If you need help or encounter any issue:</P>
          <Step n={1}>Go to <strong>Support → New Ticket</strong>.</Step>
          <Step n={2}>Describe your issue clearly. Attach any relevant context.</Step>
          <Step n={3}>The support team will respond. You can reply within the ticket thread.</Step>
          <Step n={4}>A red badge on the Support menu and a bell on the mobile header notify you of open tickets.</Step>
          <P>You can print any ticket thread for a physical record (<strong>Print</strong> button on the ticket page).</P>

          <div className="hidden print:block mt-10 pt-6 border-t-2 border-black text-center text-xs text-gray-400">
            Tajir User Guide — English — All rights reserved
          </div>
        </div>

        {/* ═══════════════════════════════════════════
            URDU SECTION  (RTL)
        ═══════════════════════════════════════════ */}
        <div
          className={`guide-ur urdu-guide ${lang === 'en' ? 'hidden' : ''} print:break-before-page`}
          dir="rtl"
          lang="ur"
        >
          {/* print cover */}
          <div className="hidden print:block text-center mb-10 pb-6 border-b-2 border-black">
            <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">تاجر بزنس مینجمنٹ سافٹ ویئر</p>
            <h1 className="text-4xl font-extrabold">صارف راہنما</h1>
            <p className="text-sm text-gray-500 mt-3">تمام خصوصیات اور رپورٹوں کی مکمل راہنما</p>
          </div>

          <UH2 n="۱">تعارف</UH2>
          <UP>
            <strong>تاجر</strong> ایک مکمل تجارتی نظم و نسق سافٹ ویئر ہے جو خریداری، فروخت، اسٹاک، گاہکوں، سپلائرز، حسابات اور رپورٹس کو ایک پلیٹ فارم پر یکجا کرتا ہے۔
            یہ سافٹ ویئر دو کرنسیوں (پاکستانی روپیہ اور امریکی ڈالر)، متعدد گودام مقامات اور مکمل دہری اندراج نظام حسابات کو سپورٹ کرتا ہے۔
          </UP>
          <UUl>
            <ULi>کردار کی بنیاد پر رسائی: <strong>مالک</strong> کو تمام خصوصیات تک رسائی ہے؛ <strong>اسسٹنٹ</strong> لین دین ریکارڈ کر سکتا ہے لیکن ترتیبات تبدیل نہیں کر سکتا۔</ULi>
            <ULi>تمام رقوم پاکستانی روپیہ میں محفوظ اور دکھائی جاتی ہیں۔ ڈالر کی رقم شرح تبادلہ کے مطابق خودبخود تبدیل ہوتی ہے۔</ULi>
            <ULi>ہر رپورٹ پرنٹ کی جا سکتی ہے یا پی ڈی ایف کے طور پر محفوظ کی جا سکتی ہے۔</ULi>
          </UUl>

          <UH2 n="۲">ابتداء — پہلی بار ترتیب</UH2>
          <UP>پہلی بار لاگ ان کے بعد کوئی لین دین ریکارڈ کرنے سے پہلے یہ مراحل اس ترتیب سے مکمل کریں:</UP>
          <UStep n="۱">ترتیبات ← آئٹم اقسام پر جائیں اور اپنی مصنوعات کی اقسام شامل کریں (مثلاً: دھاگہ، گرے فیبرک، کیمیکل)۔</UStep>
          <UStep n="۲">انوینٹری پر جائیں اور ہر اسٹاک آئٹم کا نام، کوڈ، فائبر، کاؤنٹ اور قسم شامل کریں۔</UStep>
          <UStep n="۳">ترتیبات ← ابتدائی بیلنس پر جائیں اور پہلے سے موجود اسٹاک کی مقدار اور خرید ریٹ درج کریں۔</UStep>
          <UStep n="۴">فنانس ← گاہک پر جائیں اور اپنے گاہکوں کی فہرست بنائیں۔ اگر وہ پہلے سے کچھ رقم دینے والے ہیں تو ابتدائی بیلنس بھی درج کریں۔</UStep>
          <UStep n="۵">فنانس ← سپلائر پر جائیں اور اپنے سپلائرز شامل کریں۔</UStep>
          <UStep n="۶">اکاؤنٹس ← حسابات کا چارٹ پر جائیں اور اپنے جی ایل اکاؤنٹس ترتیب دیں (یا سی ایس وی فائل اپلوڈ کریں)۔</UStep>
          <UStep n="۷">ترتیبات ← بینک پر جائیں اور اپنے بینک اکاؤنٹس شامل کریں۔</UStep>

          <UH2 n="۳">ڈیش بورڈ</UH2>
          <UP>ڈیش بورڈ آپ کے کاروبار کی فوری جھلک دکھاتا ہے۔</UP>
          <UH3>اعداد و شمار کارڈز</UH3>
          <UUl>
            <ULi><strong>آمدنی</strong> — منتخب مدت کی کل فروخت (روپیہ میں)۔</ULi>
            <ULi><strong>خریداری</strong> — منتخب مدت کی کل خریداری (روپیہ میں)۔</ULi>
            <ULi><strong>واجبات</strong> — تمام گاہکوں کا کل ادا نہ شدہ بیلنس۔</ULi>
            <ULi><strong>اسٹاک آئٹمز</strong> — انوینٹری میں مختلف اسٹاک آئٹمز کی کل تعداد۔</ULi>
          </UUl>
          <UH3>گراف</UH3>
          <UP>لائن چارٹ گزشتہ ۶ ماہ کی ماہانہ فروخت اور خریداری دکھاتا ہے۔ پائی چارٹ قیمت کے لحاظ سے اعلیٰ فروخت ہونے والے آئٹمز دکھاتا ہے۔</UP>
          <UH3>فوری کارروائیاں</UH3>
          <UP>عام کاموں کے یک کلک روابط: خریداری شامل کریں، فروخت شامل کریں، وصولی، ادائیگی، گیٹ پاس، رپورٹیں۔</UP>
          <UH3>سپورٹ اطلاع</UH3>
          <UP>اگر آپ کی کھلی سپورٹ ٹکٹیں ہیں تو ڈیش بورڈ پر ایک سنہری بینر نظر آتا ہے اور سپورٹ مینو پر سرخ بیج دکھائی دیتا ہے۔</UP>

          <UH2 n="۴">اسٹاک انتظام</UH2>
          <UH3>آئٹم اقسام</UH3>
          <UP>آئٹم اقسام اسٹاک آئٹمز کے لیے زمرے ہیں۔ انہیں ترتیبات ← آئٹم اقسام پر شامل کریں۔</UP>
          <UH3>اسٹاک آئٹمز</UH3>
          <UP>ہر اسٹاک آئٹم ایک مخصوص مصنوع کو ظاہر کرتا ہے جو آپ خریدتے اور بیچتے ہیں۔ فیلڈز:</UP>
          <UUl>
            <ULi><strong>نام</strong> — آئٹم کا نام (ضروری)۔</ULi>
            <ULi><strong>کوڈ</strong> — آپ کا اندرونی پروڈکٹ کوڈ (اختیاری)۔</ULi>
            <ULi><strong>کاؤنٹ</strong> — دھاگے کا کاؤنٹ یا تخصیص (اختیاری)۔</ULi>
            <ULi><strong>فائبر</strong> — مواد کی قسم، مثلاً کاٹن، پولیسٹر (اختیاری)۔</ULi>
            <ULi><strong>قسم</strong> — آئٹم کی زمرہ قسم (اختیاری)۔</ULi>
          </UUl>
          <UP>انوینٹری ← نیا آئٹم شامل کریں پر جائیں۔</UP>
          <UH3>ابتدائی بیلنس</UH3>
          <UP>تاجر استعمال شروع کرنے سے پہلے کے اسٹاک کی مقدار اور خرید ریٹ ترتیبات ← ابتدائی بیلنس پر درج کریں۔ یہ ریٹ اسٹاک ویلیویشن اور نفع کے حساب میں استعمال ہوتا ہے۔</UP>

          <UH2 n="۵">خریداری</UH2>
          <UP>سپلائر سے خریدا گیا سامان ریکارڈ کریں۔</UP>
          <UStep n="۱">خریداری ← نئی خریداری شامل کریں پر جائیں۔</UStep>
          <UStep n="۲">سپلائر، تاریخ اور مقام (گودام) منتخب کریں۔</UStep>
          <UStep n="۳">آئٹم، مقدار اور ریٹ کے ساتھ ایک یا زیادہ سطریں شامل کریں۔</UStep>
          <UStep n="۴">کرنسی منتخب کریں: روپیہ یا ڈالر۔ ڈالر کی صورت میں شرح تبادلہ درج کریں۔</UStep>
          <UStep n="۵">محفوظ کریں۔ اسٹاک فوری طور پر بڑھ جاتا ہے۔</UStep>
          <UNote>خریداری بعد میں ترمیم یا حذف کی جا سکتی ہے۔ اگر حذف کرنے سے اسٹاک صفر سے نیچے جائے تو سسٹم بلاک کر دے گا۔</UNote>

          <UH2 n="۶">خریداری واپسی</UH2>
          <UP>سپلائر کو واپس کیا گیا سامان ریکارڈ کریں (خراب یا غلط سامان)۔</UP>
          <UStep n="۱">خریداری واپسی ← نئی واپسی شامل کریں پر جائیں۔</UStep>
          <UStep n="۲">سپلائر، آئٹم، مقدار اور ریٹ منتخب کریں۔</UStep>
          <UStep n="۳">محفوظ کریں۔ اسٹاک واپس کی گئی مقدار کے برابر کم ہو جاتا ہے۔</UStep>
          <UNote>اگر واپسی سے دستیاب اسٹاک صفر سے نیچے جائے تو سسٹم لین دین بلاک کر دے گا۔</UNote>

          <UH2 n="۷">فروخت</UH2>
          <UP>گاہک کو فروخت کیا گیا سامان ریکارڈ کریں۔</UP>
          <UStep n="۱">فروخت ← نئی فروخت شامل کریں پر جائیں۔</UStep>
          <UStep n="۲">گاہک، تاریخ اور مقام منتخب کریں۔</UStep>
          <UStep n="۳">آئٹم، مقدار اور ریٹ شامل کریں۔</UStep>
          <UStep n="۴">کرنسی منتخب کریں اور محفوظ کریں۔</UStep>
          <UNote>آپ دستیاب اسٹاک سے زیادہ فروخت نہیں کر سکتے۔ کوشش کرنے پر سسٹم &quot;ناکافی اسٹاک&quot; کی خرابی دکھاتا ہے اور لین دین بلاک کر دیتا ہے۔</UNote>

          <UH2 n="۸">فروخت واپسی</UH2>
          <UP>گاہک کی طرف سے واپس کیا گیا سامان ریکارڈ کریں۔</UP>
          <UStep n="۱">فروخت واپسی ← نئی واپسی شامل کریں پر جائیں۔</UStep>
          <UStep n="۲">گاہک، آئٹم، مقدار اور ریٹ منتخب کریں۔</UStep>
          <UStep n="۳">محفوظ کریں۔ اسٹاک بڑھ جاتا ہے اور گاہک کا بیلنس ایڈجسٹ ہو جاتا ہے۔</UStep>

          <UH2 n="۹">گیٹ پاس</UH2>
          <UP>گیٹ پاس آپ کے گودام کے دروازے پر سامان کی آمد و رفت کا ریکارڈ رکھتے ہیں۔</UP>
          <UH3>اندرونی گیٹ پاس</UH3>
          <UP>جب گاڑی خریدا ہوا سامان لے کر آئے تو اندرونی گیٹ پاس بنائیں۔ خریداری آرڈر سے منسلک کریں تاکہ معلوم رہے کتنا سامان آیا اور کتنا باقی ہے۔</UP>
          <UH3>بیرونی گیٹ پاس</UH3>
          <UP>جب گاڑی فروخت کیا ہوا سامان لے کر جائے تو بیرونی گیٹ پاس بنائیں۔ فروخت آرڈر سے منسلک کریں۔</UP>
          <UP>زیر التواء بیلنس رپورٹ ان تمام آرڈرز کو دکھاتی ہے جن کا گیٹ پاس ابھی تک نہیں ہوا۔</UP>

          <UH2 n="۱۰">مقامات اور اسٹاک منتقلی</UH2>
          <UH3>مقامات</UH3>
          <UP>متعدد گودام یا ذخیرہ کرنے کی جگہیں ترتیبات ← مقامات ← مقام شامل کریں پر بنائیں۔ خریداری اور فروخت ریکارڈ کرتے وقت مقام منتخب کریں۔</UP>
          <UH3>اسٹاک منتقلی</UH3>
          <UStep n="۱">اسٹاک منتقلی ← نئی منتقلی پر جائیں۔</UStep>
          <UStep n="۲">ماخذ مقام، منزل مقام، آئٹم اور مقدار منتخب کریں۔</UStep>
          <UStep n="۳">محفوظ کریں۔ مقام بہ مقام اسٹاک رپورٹ خودبخود اپ ڈیٹ ہو جاتی ہے۔</UStep>

          <UH2 n="۱۱">گاہک اور وصولیاں</UH2>
          <UH3>گاہک</UH3>
          <UP>اپنے گاہکوں کو فنانس ← گاہک پر شامل کریں۔ نام، فون، پتہ اور ابتدائی بیلنس (تاجر سے پہلے کا واجب الادا) درج کریں۔</UP>
          <UH3>وصولیاں</UH3>
          <UP>گاہکوں سے ملنے والی ادائیگیاں فنانس ← وصولیاں ← وصولی شامل کریں پر ریکارڈ کریں۔</UP>
          <UUl>
            <ULi>گاہک اور ملنے والی رقم درج کریں۔</ULi>
            <ULi>وصولی محفوظ ہونے پر گاہک کا بقایا بیلنس کم ہو جاتا ہے۔</ULi>
            <ULi>وصولیاں خودبخود حسابات کے لیجر میں درج ہو جاتی ہیں۔</ULi>
          </UUl>

          <UH2 n="۱۲">سپلائر اور ادائیگیاں</UH2>
          <UH3>سپلائر</UH3>
          <UP>اپنے سپلائرز کو فنانس ← سپلائر پر شامل کریں — نام، فون اور رابطہ معلومات کے ساتھ۔</UP>
          <UH3>ادائیگیاں</UH3>
          <UP>سپلائرز کو کی گئی ادائیگیاں فنانس ← ادائیگیاں ← ادائیگی شامل کریں پر ریکارڈ کریں۔</UP>
          <UUl>
            <ULi>سپلائر اور ادا کردہ رقم درج کریں۔</ULi>
            <ULi>ادائیگی محفوظ ہونے پر سپلائر کا بقایا بیلنس کم ہو جاتا ہے۔</ULi>
          </UUl>

          <UH2 n="۱۳">قیمت تعین</UH2>
          <UP>ہر گاہک کے لیے فی آئٹم طے شدہ فروخت قیمتیں فنانس ← قیمت تعین پر ترتیب دیں۔ فروخت ریکارڈ کرتے وقت سسٹم خودبخود طے شدہ ریٹ پُر کر دیتا ہے۔</UP>

          <UH2 n="۱۴">اخراجات</UH2>
          <UP>کاروباری اخراجات (کرایہ، تنخواہ، بجلی، گیس، ٹرانسپورٹ وغیرہ) فنانس ← اخراجات ← اخراج شامل کریں پر ریکارڈ کریں۔</UP>
          <UUl>
            <ULi>اخراجات کا حساب (چارٹ آف اکاؤنٹس سے) منتخب کریں۔</ULi>
            <ULi>رقم، تاریخ اور تفصیل درج کریں۔</ULi>
            <ULi>اخراجات نفع و نقصان رپورٹ میں ظاہر ہوتے ہیں۔</ULi>
          </UUl>

          <UH2 n="۱۵">حسابات کا چارٹ</UH2>
          <UP>چارٹ آف اکاؤنٹس آپ کے تمام جنرل لیجر اکاؤنٹس کی فہرست ہے — دہری اندراج نظام کی بنیاد۔</UP>
          <UH3>اکاؤنٹ کی اقسام</UH3>
          <UUl>
            <ULi><strong>اثاثہ</strong> — کاروبار کی ملکیت (نقدی، بینک، وصولیاں، اسٹاک)۔</ULi>
            <ULi><strong>واجب</strong> — کاروبار کا قرض (ادائیگیاں، قرضے)۔</ULi>
            <ULi><strong>ایکوئٹی</strong> — مالک کا سرمایہ اور منافع۔</ULi>
            <ULi><strong>آمدنی</strong> — فروخت سے حاصل آمدنی۔</ULi>
            <ULi><strong>خرچ</strong> — آپریٹنگ اخراجات۔</ULi>
          </UUl>
          <UH3>اکاؤنٹس شامل کرنا</UH3>
          <UP>اکاؤنٹس ← حسابات کا چارٹ ← اکاؤنٹ شامل کریں پر جائیں اور کوڈ، نام اور قسم درج کریں۔</UP>
          <UH3>سی ایس وی اپلوڈ</UH3>
          <UP>اکاؤنٹس کثیر تعداد میں شامل کرنے کے لیے ایک CSV فائل تیار کریں جس میں <code>code, name, type</code> کالمز ہوں اور چارٹ آف اکاؤنٹس صفحے پر اپلوڈ کریں۔</UP>

          <UH2 n="۱۶">واؤچر</UH2>
          <UP>واؤچر دستی جرنل اندراجات ہیں جو خریداری، فروخت یا وصولیوں سے ہٹ کر حسابی ایڈجسٹمنٹ کے لیے استعمال ہوتے ہیں۔</UP>
          <UStep n="۱">اکاؤنٹس ← واؤچر ← نیا واؤچر پر جائیں۔</UStep>
          <UStep n="۲">ڈیبٹ اور کریڈٹ سطریں شامل کریں — ہر سطر میں حساب اور رقم۔</UStep>
          <UStep n="۳">کل ڈیبٹ = کل کریڈٹ ہونا ضروری ہے۔ سسٹم یہ قانون نافذ کرتا ہے۔</UStep>
          <UStep n="۴">محفوظ کریں۔ واؤچر فوری طور پر جنرل لیجر میں درج ہو جاتا ہے۔</UStep>

          <UH2 n="۱۷">رپورٹیں</UH2>
          <UP>تمام ۱۶ رپورٹیں رپورٹیں مینو سے دستیاب ہیں۔ ہر رپورٹ پر تاریخ کے فلٹر موجود ہیں۔ ہر رپورٹ پرنٹ یا پی ڈی ایف میں محفوظ کی جا سکتی ہے۔</UP>
          <UReportTable rows={UR_REPORTS} />
          <UNote>رپورٹوں میں لاگت کے اعداد و شمار (COGS) ہر آئٹم کی <em>آخری خرید قیمت</em> کی بنیاد پر ہیں۔ ابتدائی بیلنس والے اسٹاک کے لیے ابتدائی ریٹ استعمال ہوتا ہے۔</UNote>

          <UH2 n="۱۸">ترتیبات</UH2>
          <UH3>آئٹم اقسام</UH3>
          <UP>اسٹاک آئٹمز کے لیے زمرے۔ ترتیبات ← آئٹم اقسام پر شامل، نام تبدیل یا حذف کریں۔</UP>
          <UH3>ٹیم انتظام</UH3>
          <UP>ٹیم کے اراکین کو ترتیبات ← ٹیم ← رکن مدعو کریں پر مدعو کریں۔</UP>
          <UUl>
            <ULi><strong>مالک</strong> — تمام خصوصیات اور ترتیبات تک مکمل رسائی۔</ULi>
            <ULi><strong>اسسٹنٹ</strong> — خریداری، فروخت، گیٹ پاس وغیرہ کر سکتا ہے لیکن ترتیبات، اکاؤنٹس یا دوسرے صارفین کے ریکارڈ نہیں دیکھ سکتا۔</ULi>
          </UUl>
          <UH3>بینک</UH3>
          <UP>بینک اکاؤنٹس ترتیبات ← بینک پر شامل کریں۔ یہ کیش بک، بینک اسٹیٹمنٹ اور چارٹ آف اکاؤنٹس میں ظاہر ہوتے ہیں۔</UP>
          <UH3>آڈٹ لاگ</UH3>
          <UP>سسٹم میں ہر تبدیلی ترتیبات ← آڈٹ پر ریکارڈ ہوتی ہے — تاریخ، صارف، عمل اور تبدیل شدہ ڈیٹا کے ساتھ۔ غلطیاں تلاش کرنے کے لیے بہت مفید ہے۔</UP>

          <UH2 n="۱۹">معاونت</UH2>
          <UP>مدد کی ضرورت ہو یا کوئی مسئلہ پیش آئے:</UP>
          <UStep n="۱">معاونت ← نئی ٹکٹ پر جائیں۔</UStep>
          <UStep n="۲">اپنا مسئلہ واضح طور پر بیان کریں۔</UStep>
          <UStep n="۳">معاونت ٹیم جواب دے گی۔ آپ ٹکٹ میں جواب دے سکتے ہیں۔</UStep>
          <UStep n="۴">کھلی ٹکٹوں کے لیے سپورٹ مینو پر سرخ بیج اور موبائل ہیڈر میں گھنٹی نظر آتی ہے۔</UStep>
          <UP>ٹکٹ تھریڈ کا پرنٹ آؤٹ ٹکٹ صفحے پر موجود پرنٹ بٹن سے لیا جا سکتا ہے۔</UP>

          <div className="hidden print:block mt-10 pt-6 border-t-2 border-black text-center text-xs text-gray-400">
            تاجر صارف راہنما — اردو — جملہ حقوق محفوظ ہیں
          </div>
        </div>

      </div>
    </div>
  )
}

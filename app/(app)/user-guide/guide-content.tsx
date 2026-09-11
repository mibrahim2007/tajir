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
  { name: 'Purchase Detail', desc: 'Every purchase invoice in a date range with its voucher and supplier invoice number. Searchable by bill number.' },
  { name: 'Sale Detail', desc: 'Every sale invoice in a date range with its voucher, PO and DC number. Searchable by PO / DC number.' },
  { name: 'Purchase & Sales', desc: 'Date-range summary of all purchases and sales with totals and gross profit.' },
  { name: 'Stock Summary', desc: 'Current quantities for all stock items.' },
  { name: 'Stock Valuation', desc: 'Stock value in PKR using the latest purchase rate per item.' },
  { name: 'Location-wise Stock', desc: 'Stock quantities broken down by warehouse location.' },
  { name: 'Receivables Aging', desc: 'Customer outstanding balances by 0–30, 31–60, 61–90, 90+ day buckets, with unrecovered employee loans and advances in their own section.' },
  { name: 'Payables Aging', desc: 'Supplier outstanding balances by aging bucket.' },
  { name: 'Employee Loans', desc: 'Outstanding loan balances and overdue installments per employee.' },
  { name: 'Cheque Register', desc: 'Every post-dated cheque with its due date, party and status. Cheques are cleared or bounced here.' },
  { name: 'Profit & Loss', desc: 'Full income statement — revenue, COGS, expenses, and net profit.' },
  { name: 'Balance Sheet', desc: 'Assets, liabilities and equity as of any date.' },
  { name: 'Trial Balance', desc: 'All GL account balances — verifies debits equal credits.' },
  { name: 'General Ledger', desc: 'Full double-entry ledger with running balance per account.' },
  { name: 'Consolidated Ledger', desc: 'One net statement for a party that is both a customer and a supplier.' },
  { name: 'Daily Cashbook', desc: 'Cash and bank movements for a single day with opening and closing balances.' },
  { name: 'Bank Statement', desc: 'All transactions for one bank account over a date range.' },
  { name: 'Custom Reports', desc: 'Statements you design yourself — your own reporting headers, the account codes mapped to each, and how every line behaves.' },
]

const UR_REPORTS: UReport[] = [
  { name: 'زیر التواء بیلنس', desc: 'ادھوری خریداری اور فروخت جو ابھی گیٹ پاس نہیں ہوئی۔' },
  { name: 'آئٹم لیجر', desc: 'ایک اسٹاک آئٹم کی تمام حرکات بمع رننگ بیلنس۔' },
  { name: 'آئٹم نفع و نقصان', desc: 'ایک آئٹم کی آمدنی، لاگت اور نفع کی تفصیل۔' },
  { name: 'گاہک نفع و نقصان', desc: 'فروخت اور لاگت کی بنیاد پر ہر گاہک کا نفع۔' },
  { name: 'خریداری کی تفصیل', desc: 'ہر خرید بل بمع واؤچر اور سپلائر بل نمبر — بل نمبر سے تلاش کریں۔' },
  { name: 'فروخت کی تفصیل', desc: 'ہر فروخت بل بمع واؤچر، پی او اور ڈی سی نمبر — انہی نمبروں سے تلاش کریں۔' },
  { name: 'خرید و فروخت', desc: 'تمام خریداری اور فروخت کا تاریخی خلاصہ۔' },
  { name: 'اسٹاک خلاصہ', desc: 'تمام آئٹمز کی موجودہ مقدار۔' },
  { name: 'اسٹاک ویلیویشن', desc: 'موجودہ اسٹاک کی قیمت (آخری خرید ریٹ کے مطابق)۔' },
  { name: 'مقام بہ مقام اسٹاک', desc: 'ہر گودام یا مقام پر اسٹاک کی مقدار۔' },
  { name: 'وصولی بڑھاپا', desc: 'گاہکوں کا بقایا مدت کے مطابق (۳۰، ۶۰، ۹۰ دن)، بمع ملازمین کے غیر وصول شدہ قرض و ایڈوانس الگ حصے میں۔' },
  { name: 'ادائیگی بڑھاپا', desc: 'سپلائرز کا بقایا مدت کے مطابق۔' },
  { name: 'ملازمین کے قرض', desc: 'ہر ملازم کا باقی قرض اور زائد المیعاد اقساط۔' },
  { name: 'چیک رجسٹر', desc: 'ہر مؤخر تاریخ چیک بمع مقررہ تاریخ، فریق اور حالت — کلیئر یا باؤنس یہیں کریں۔' },
  { name: 'نفع و نقصان', desc: 'مکمل آمدنی کا بیان — آمدنی، لاگت اور خالص نفع۔' },
  { name: 'بیلنس شیٹ', desc: 'کسی بھی تاریخ کے اثاثے، واجبات اور ایکوئٹی۔' },
  { name: 'ٹرائل بیلنس', desc: 'تمام حسابات کا بیلنس — ڈیبٹ = کریڈٹ تصدیق۔' },
  { name: 'جنرل لیجر', desc: 'ہر حساب کا مکمل دہری اندراج لیجر۔' },
  { name: 'مشترکہ لیجر', desc: 'ایک ہی فریق جو گاہک بھی ہو اور سپلائر بھی — دونوں کا مشترکہ خالص بیان۔' },
  { name: 'روزانہ کیش بک', desc: 'ایک دن کی نقدی آمد و رفت اور ابتدائی و اختتامی بیلنس۔' },
  { name: 'بینک اسٹیٹمنٹ', desc: 'منتخب بینک اکاؤنٹ کا تاریخی بیان۔' },
  { name: 'کسٹم رپورٹس', desc: 'اپنی مرضی کے مالیاتی بیانات — اپنے رپورٹنگ ہیڈر، ہر ہیڈر کے اکاؤنٹ کوڈز، اور ہر لائن کا رویہ خود منتخب کریں۔' },
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
            <p className="text-sm text-gray-500 mt-3">Complete guide to all features and reports · Updated September 2026</p>
          </div>

          <Link
            href="/ask"
            className="print-hide flex items-center gap-3 rounded-xl border border-primary/30 bg-accent/40 px-4 py-3 mb-2 hover:bg-accent transition-colors"
          >
            <span className="text-sm text-foreground flex-1">
              <strong>Have a question right now?</strong> Ask answers common questions in plain language, and can look up your own ledgers and balances.
            </span>
            <span className="text-xs font-semibold text-primary shrink-0">Open Ask →</span>
          </Link>

          <div className="rounded-xl border border-border bg-card px-4 py-3 mb-2 print:border-gray-300">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">What&apos;s new — September 2026</p>
            <Ul>
              <Li><strong>Setup Wizard</strong> — all master data for a new business in one guided flow (section 2).</Li>
              <Li><strong>New menu and themes</strong> — six daily-document buttons on top, groups named Sell / Buy / Stock / Money / Reports / Setup / Help, and a Day / Night switch (section 1).</Li>
              <Li><strong>Agents &amp; commission</strong> — enrol brokers, accrue commission on every invoice, claw it back on returns (section 21).</Li>
              <Li><strong>WhatsApp invoices</strong> — send a sale invoice to the customer&apos;s phone with a view-and-download link (section 12).</Li>
              <Li><strong>Profit allocation</strong> — distribute a period&apos;s profit to partners by share (section 20).</Li>
              <Li><strong>Ask</strong> — analysis reports, emailed answers and statements, and question history (section 4).</Li>
              <Li><strong>Cheques</strong> — a due date is now mandatory on every post-dated cheque (section 16).</Li>
              <Li><strong>Data entry</strong> — Enter moves to the next field everywhere; reports print without the surrounding page.</Li>
            </Ul>
          </div>

          <H2 n="1">Introduction</H2>
          <P>
            <strong>Tajir</strong> is a complete business management platform for traders — covering purchases, sales, stock, customers, suppliers, accounting, and reports in one place.
            It supports two currencies (PKR and USD), multiple warehouse locations, and a full double-entry accounting system.
          </P>
          <Ul>
            <Li>Role-based access: <strong>Owner</strong> has full control; <strong>Assistant</strong> can record transactions but cannot change settings or view all users&apos; data.</Li>
            <Li>All monetary amounts are stored and reported in PKR. USD transactions convert at the exchange rate you enter.</Li>
            <Li>The menu opens with six buttons for the documents you raise every day — <strong>Sale, Purchase, Receipt, Payment, Expense, Gatepass</strong> — then <strong>Dashboard</strong> and <strong>Ask</strong>, then seven groups named for what you are doing: <strong>Sell</strong>, <strong>Buy</strong>, <strong>Stock</strong>, <strong>Money</strong>, <strong>Reports</strong>, <strong>Setup</strong> (owner only) and <strong>Help</strong>. Throughout this guide, &ldquo;Sell → Customers&rdquo; means that group and that page. A group opens itself to wherever you already are.</Li>
            <Li>Modules you do not use can be switched off at <strong>Setup → Modules</strong>, which hides them for everyone. If a page named here is missing, check there first.</Li>
            <Li>Press <strong>Ctrl+K</strong> (⌘K on Mac) anywhere to open the command palette and jump straight to any page or action by typing its name.</Li>
            <Li>On every entry form, <strong>Enter</strong> moves to the next field — including straight after picking a party or item — so a whole invoice can be typed without touching the mouse.</Li>
            <Li>The sun / moon switch in the header changes the whole application between <strong>Day</strong> and <strong>Night</strong> themes. Your choice is remembered on that device.</Li>
            <Li>Every report and document has a <strong>Print</strong> button that prints just the report — no menu or header around it — or saves it as PDF.</Li>
          </Ul>

          <H2 n="2">Getting Started — First-Time Setup</H2>
          <P>Before the first invoice, Tajir needs your master data: who you are, the ledger it posts to, what you sell, where it is kept, and who you trade with. The <strong>Setup Wizard</strong> collects all of it in one place, in the right order.</P>
          <Step n={1}>Go to <strong>Setup → Setup Wizard</strong> (owners also have a <strong>Setup Wizard</strong> tile on the dashboard).</Step>
          <Step n={2}><strong>Business Profile</strong> — your business name and NTN, as printed on every invoice and voucher.</Step>
          <Step n={3}><strong>Chart of Accounts</strong> — one click loads the standard ledger for a trading business. Safe to repeat; existing accounts are never changed.</Step>
          <Step n={4}><strong>Item Categories</strong> — tap the presets that match your trade (Yarn, Greige, Fabric, Electric…) or type your own, with optional sub-types.</Step>
          <Step n={5}><strong>Warehouses</strong> — every godown or shop that holds stock. A single-godown business still needs one.</Step>
          <Step n={6}><strong>Stock Items</strong> — one row per product with its category, count/grade and unit. Type several rows and save them together.</Step>
          <Step n={7}><strong>Customers</strong>, <strong>Suppliers</strong> and <strong>Bank Accounts</strong> — again as rows, each with its opening balance.</Step>
          <Step n={8}><strong>Owners &amp; Staff</strong> and <strong>Team Access</strong> are optional — partners, employees, agents, and a login for your munshi.</Step>
          <Step n={9}><strong>Review &amp; Finish</strong> shows what is filled in and what is still empty, then points you to <strong>Setup → Opening Balances</strong> to load stock quantities, cash and post-dated cheques you were carrying on day one.</Step>
          <Ul>
            <Li>The wizard reads what already exists, so you can return to it any time to add more — nothing is created twice, and each step links to the full page for that data.</Li>
            <Li>Every step can also be done from its own page: <strong>Setup → Business / Item Types / Banks</strong>, <strong>Stock → Locations / Inventory</strong>, <strong>Sell → Customers</strong>, <strong>Buy → Suppliers</strong>, <strong>Money → Accounts</strong>.</Li>
          </Ul>
          <Note>Opening balances are the one part of setup worth doing carefully — every report is built on them. Section 25 explains each of the four kinds.</Note>

          <H2 n="3">Dashboard</H2>
          <P>The dashboard gives you a real-time overview of your business. Everyone sees the top row; owners see extra sales KPIs and analytics below it.</P>
          <H3>KPI Cards</H3>
          <Ul>
            <Li><strong>Sales (MTD)</strong> — total sales value so far this month.</Li>
            <Li><strong>Purchases (MTD)</strong> — total purchase value so far this month.</Li>
            <Li><strong>Receivables</strong> — what all customers owe you: opening balances plus sales, less receipts, sale returns and credit notes, plus refunds.</Li>
            <Li><strong>Payables</strong> — what you owe all suppliers, on the same basis.</Li>
            <Li><strong>Inventory</strong> — total units on hand across all stock items.</Li>
          </Ul>
          <H3>Aging Cards</H3>
          <P>Below the KPIs, <strong>Receivables Aging</strong> and <strong>Payables Aging</strong> show how overdue those two balances are, split into 0–30, 31–60, 61–90 and 90+ day bands with a proportional bar. The headline figure is everything past 30 days. Each card links to the full report.</P>
          <H3>Owner KPIs and Analytics</H3>
          <Ul>
            <Li>A second KPI row: <strong>Orders (MTD)</strong>, <strong>Avg Sale (MTD)</strong>, <strong>Collections (MTD)</strong> and <strong>Gross Margin (MTD)</strong>.</Li>
            <Li><strong>Sales Analytics</strong> — sales by product and by party, with a period selector (this month, last month, last 3 months, year to date).</Li>
          </Ul>
          <H3>Charts</H3>
          <P><strong>Stock by Category</strong> is a donut of current inventory by item type. <strong>Revenue vs Purchases</strong> is a 6-month line chart — revenue solid, purchases dashed.</P>
          <H3>Recent Transactions & Quick Actions</H3>
          <P>The latest sales and purchases appear side by side with one-click tiles for the most common tasks: Sale, Purchase, Receipt, Payment, Gatepass, Expense, Inventory, Reports and more. Owners also get Voucher, Setup Wizard and Demo Playground tiles, plus shortcuts to Profit &amp; Loss, Balance Sheet and all reports.</P>
          <H3>Support Notification</H3>
          <P>If you have open support tickets, an amber banner appears at the top of the dashboard and a red badge shows on the Support menu item.</P>

          <H2 n="4">Ask — Questions About Your Business</H2>
          <P><strong>Ask</strong> (pinned at the top of the menu) is a chat box you can type a plain question into. It answers in two ways.</P>
          <Ul>
            <Li><strong>Questions about your data</strong> — &ldquo;ledger of Ali Traders&rdquo;, &ldquo;who owes me money&rdquo;, &ldquo;top customers&rdquo;, &ldquo;stock summary&rdquo;, &ldquo;overdue cheques&rdquo;, &ldquo;cheque no 12345&rdquo;. Answers are built only from what is recorded — nothing is estimated or invented.</Li>
            <Li><strong>Questions about how to do something</strong> — &ldquo;how to create a sale invoice&rdquo;, &ldquo;what is PDC&rdquo;, &ldquo;how to load opening stock&rdquo;. These return step-by-step instructions with links to the right screen.</Li>
          </Ul>
          <P>Tap a suggested question to run it, or type a party or item name to jump straight to their ledger. Answers carry follow-up chips you can tap to dig further.</P>
          <Ul>
            <Li><strong>Analysis</strong> — ask for &ldquo;monthly sales&rdquo;, &ldquo;sales vs purchases&rdquo;, &ldquo;expenses&rdquo;, &ldquo;customer grading&rdquo; or &ldquo;supplier grading&rdquo; to get a 12-month table with a chart, straight from the ledger.</Li>
            <Li><strong>Email it</strong> — start the question with &ldquo;email me&rdquo; (&ldquo;email me the ledger of Star Textiles&rdquo;), or use the <strong>Email</strong> button on any answer. The answer goes out as a formatted email with the table attached as a spreadsheet. If the customer or supplier has an email on file, you can send their statement to them directly.</Li>
            <Li><strong>History</strong> — Tajir remembers what your business asks. Your previous questions are offered back as suggestions, and anything it could not answer is collected so support can add it.</Li>
          </Ul>

          <H2 n="5">Inventory Management</H2>
          <H3>Item Types</H3>
          <P>Item types are categories for your stock items. Add them at <strong>Setup → Item Types</strong> or from the Setup Wizard. Examples: Yarn, Grey Fabric, Chemicals.</P>
          <P>A type can have <strong>sub-types</strong> — <em>Yarn → Cotton, Polyester, Blend</em>. When a type has sub-types, items are filed under the sub-type, and the type itself becomes a heading in pickers and in the Stock by Category chart.</P>
          <H3>Stock Items</H3>
          <P>Each stock item represents a specific product you buy and sell. Fields include:</P>
          <Ul>
            <Li><strong>Name</strong> — the item name (required).</Li>
            <Li><strong>SKU</strong> — a scannable code (<em>TJR-000123</em>) Tajir assigns automatically, or your own if you prefer. It is what the barcode label carries.</Li>
            <Li><strong>Code</strong> — your internal product code (optional).</Li>
            <Li><strong>Unit</strong> — KG, Cone, Than, Meter, Piece… The list suggested depends on the item&apos;s type.</Li>
            <Li><strong>Count</strong> — yarn count or specification (optional).</Li>
            <Li><strong>Fiber</strong> — material type, e.g., Cotton, Polyester (optional).</Li>
            <Li><strong>Type</strong> — the Item Type category (optional).</Li>
            <Li><strong>Nature</strong> — <strong>Inventory</strong> for goods that are counted and costed, or <strong>Service</strong> for things like freight or labour. A service item has no stock, so it never blocks a sale and carries no cost of sales.</Li>
          </Ul>
          <P>Add items at <strong>Stock → Inventory → Add New Item</strong>, or several at once under one category with <strong>Create items by type</strong>. Edit or deactivate from the item list.</P>
          <H3>Barcode Labels</H3>
          <P>Tick the items you want on the Inventory list and choose <strong>Print labels</strong>, or use the label icon on a single row. Each label carries the item name, count and a barcode of its SKU, sized for a standard label sheet, so bags and bales on the floor can be matched to the record in Tajir.</P>
          <H3>Opening Stock</H3>
          <P>For stock you held before starting Tajir, set the quantity, cost rate and location at <strong>Setup → Opening Balances → Stock Item Quantities</strong>. The rate drives stock valuation and profit, so use your cost, not your selling price.</P>
          <P>An item sitting in several warehouses on day one is entered at all of them at once: click <strong>Add location</strong> for a line per warehouse, each with its own quantity and rate. No opening stock transfer is needed.</P>

          <H2 n="6">Locations & Stock Transfers</H2>
          <H3>Locations</H3>
          <P>Define your warehouses or storage places at <strong>Stock → Locations → Add Location</strong>. Purchases arrive into a location and sales are dispatched from one, so create these before recording transactions.</P>
          <H3>Stock Transfers</H3>
          <Step n={1}>Go to <strong>Stock → Stock Transfers → New Transfer</strong>.</Step>
          <Step n={2}>Select the source location, destination location, item and quantity.</Step>
          <Step n={3}>Save. The Location-wise Stock report updates immediately.</Step>
          <Note>Opening stock can be loaded at several warehouses directly (section 5). Transfers are for stock that moves <em>after</em> that — they never change the total on hand, only where it is.</Note>

          <H2 n="7">Purchases</H2>
          <P>Record goods you have bought from a supplier.</P>
          <Step n={1}>Go to <strong>Buy → Purchases → New Purchase</strong>.</Step>
          <Step n={2}>Select the <strong>Supplier</strong>, the <strong>Date</strong>, and <strong>Receive At</strong> — the location the goods arrive into.</Step>
          <Step n={3}>Add one or more line items — select item, enter quantity and rate.</Step>
          <Step n={4}>Select currency: PKR or USD. If USD, enter the exchange rate; Tajir converts to PKR automatically.</Step>
          <Step n={5}>Enter the <strong>Supplier Invoice No.</strong> so you can find this purchase later by the supplier&apos;s own bill number.</Step>
          <Step n={6}>If you paid something at the time, enter it in <strong>Advance Paid (PKR)</strong>.</Step>
          <Step n={7}>Save. Stock increases at that location and the supplier&apos;s balance rises by the unpaid remainder.</Step>
          <Note>Advance Paid is settled on the invoice itself, so only the remainder appears in Payables and Payables Aging. If deleting a purchase would make stock negative, the system blocks the action.</Note>

          <H2 n="8">Purchase Returns</H2>
          <P>Record goods returned to a supplier (e.g., damaged or wrong items).</P>
          <Step n={1}>Go to <strong>Buy → Purchase Returns → New Return</strong>.</Step>
          <Step n={2}>Optionally choose <strong>Against Purchase Order</strong> to pull the item, quantity and rate from the original purchase.</Step>
          <Step n={3}>Select the supplier, <strong>Return Date</strong> and <strong>Location</strong>, then the item, quantity and rate. Add a <strong>Reason</strong>.</Step>
          <Step n={4}>Save. Stock decreases and what you owe the supplier comes down.</Step>
          <Note>If the return would make available stock go below zero, the system blocks the transaction to protect stock accuracy. To adjust a supplier balance without goods moving, use a Debit Note instead (section 14).</Note>

          <H2 n="9">Sales</H2>
          <P>Record goods sold to a customer.</P>
          <Step n={1}>Go to <strong>Sell → Sales → New Sale</strong>.</Step>
          <Step n={2}>Select the <strong>Customer</strong>, the <strong>Sale Date</strong>, and <strong>Dispatch From</strong> — the location the goods leave.</Step>
          <Step n={3}>Add line items — select item, enter quantity and rate. If you keep a price list for that customer, the rate fills in automatically.</Step>
          <Step n={4}>Select currency (PKR or USD).</Step>
          <Step n={5}>Optionally set <strong>Due Days</strong>, which fills in the <strong>Payment Due</strong> date and drives the overdue reports, plus <strong>PO No.</strong>, <strong>DC No.</strong> and <strong>Notes</strong>.</Step>
          <Step n={6}>Save. Stock leaves that location and the customer&apos;s balance rises.</Step>
          <Ul>
            <Li>You cannot sell more than the stock held <em>at the chosen location</em> — the form shows an <strong>Insufficient Stock</strong> error and blocks the sale.</Li>
            <Li>If a line is priced below its cost, a confirmation appears before saving.</Li>
            <Li>After saving, print either the compact voucher or the full-page A4 invoice.</Li>
          </Ul>

          <H2 n="10">Sale Returns</H2>
          <P>Record goods returned by a customer.</P>
          <Step n={1}>Go to <strong>Sell → Sale Returns → New Return</strong>.</Step>
          <Step n={2}>Optionally choose <strong>Against Sale Order</strong> to pull the item, quantity and rate from the original invoice.</Step>
          <Step n={3}>Select the customer, <strong>Return Date</strong> and <strong>Location</strong>, then the item, quantity and rate. Add a <strong>Reason</strong>.</Step>
          <Step n={4}>Save. Stock increases and the customer&apos;s balance comes down.</Step>
          <Note>Sale returns are owner-only — an assistant cannot open the form. To reduce a customer balance without goods moving, use a Credit Note instead (section 14).</Note>

          <H2 n="11">Gatepasses</H2>
          <P>Gatepasses track the physical movement of goods at your gate/warehouse door.</P>
          <H3>Inward Gatepass</H3>
          <P>Created when a vehicle arrives with purchased goods. Link it to a purchase order to track how much of an order has been received vs. still pending.</P>
          <H3>Outward Gatepass</H3>
          <P>Created when a vehicle departs with sold goods. Link it to a sale order to track dispatch progress.</P>
          <P>The <strong>Pending Balance</strong> report shows all orders with outstanding quantities not yet covered by a gatepass.</P>
          <P>You can print any gatepass for a physical gate record.</P>

          <H2 n="12">Customers & Receipts</H2>
          <H3>Customers</H3>
          <P>Add and manage your customers at <strong>Sell → Customers</strong>, storing name, phone, address and a status (active, inactive, low transaction). The pencil on a row edits the customer, including their <strong>opening balance</strong> — what they already owed before you started using Tajir.</P>
          <P>The <strong>Outstanding</strong> column is their opening balance plus sales, less receipts, sale returns and credit notes, plus refunds. A green <em>Credit</em> badge means you owe them. Open a customer&apos;s <strong>Ledger</strong> for the full statement.</P>
          <H3>Sharing an invoice on WhatsApp</H3>
          <P>Open any sale invoice&apos;s print view and tap <strong>WhatsApp</strong>. WhatsApp opens with the customer&apos;s number already filled in — taken from their <strong>Phone</strong> — and a ready-made greeting carrying the invoice number, the amount, and a link the customer can open to view or download the invoice without logging in. You still press Send inside WhatsApp, so nothing goes out until you do.</P>
          <H3>Receipts</H3>
          <P>Record money received from customers at <strong>Sell → Receipts → New Receipt</strong>.</P>
          <Ul>
            <Li>Select the customer and the date, then enter the amount.</Li>
            <Li>Use the tender lines to split how it arrived — <strong>Cash</strong>, <strong>Online</strong> (bank transfer) or <strong>PDC</strong> (a post-dated cheque). One receipt can mix all three.</Li>
            <Li>The <strong>Received In</strong> account decides which cash or bank account is debited in the ledger.</Li>
            <Li>The customer&apos;s outstanding balance decreases and the receipt posts to the accounting ledger automatically.</Li>
          </Ul>

          <H2 n="13">Suppliers & Payments</H2>
          <H3>Suppliers</H3>
          <P>Add your suppliers at <strong>Buy → Suppliers</strong> with name, phone and contact details. As with customers, the pencil edits the supplier including their <strong>opening balance</strong>, and each row links to a full <strong>Ledger</strong>.</P>
          <H3>Payments</H3>
          <P>Record money paid to suppliers at <strong>Buy → Payments → New Payment</strong>.</P>
          <Ul>
            <Li>Select the supplier and the date, then enter the amount.</Li>
            <Li>Split the tender lines by <strong>Cash</strong>, <strong>Online</strong> or <strong>PDC</strong>, exactly as on a receipt. <strong>Paid From</strong> decides which cash or bank account is credited.</Li>
            <Li>A cheque you received from a customer can be handed straight on to a supplier here — see Endorsed in section 16.</Li>
            <Li>The supplier&apos;s outstanding balance decreases when the payment is saved.</Li>
          </Ul>

          <H2 n="14">Credit Notes & Debit Notes</H2>
          <P>Notes adjust a party&apos;s balance when no goods move — a discount agreed after the invoice, an allowance for damage, a rounding difference or a write-off. If goods are physically coming back, use a return instead (sections 8 and 10).</P>
          <Ul>
            <Li><strong>Credit Note</strong> — <strong>Sell → Credit Notes → New</strong>. Reduces what a customer owes you.</Li>
            <Li><strong>Debit Note</strong> — <strong>Buy → Debit Notes → New</strong>. Reduces what you owe a supplier.</Li>
          </Ul>
          <P>Both post to the ledger immediately and are reflected in the Receivables and Payables figures and their aging reports.</P>

          <H2 n="15">Refunds</H2>
          <P>A refund is money actually changing hands to clear a credit balance, rather than an adjustment on paper.</P>
          <Ul>
            <Li><strong>Refund to a customer</strong> — open <strong>Sell → Customers → Ledger</strong> for that customer and use <strong>Refund</strong>. Available when they are in credit, for example after a return on an invoice they had already paid.</Li>
            <Li><strong>Refund from a supplier</strong> — open <strong>Buy → Suppliers → Ledger</strong> and use <strong>Receive Payment from Supplier</strong>, for money coming back to you.</Li>
          </Ul>
          <Note>A refund increases what the party owes again, because the credit they were holding has been paid out. Both the party lists and the aging reports account for this.</Note>

          <H2 n="16">Post-Dated Cheques (PDC)</H2>
          <P>A post-dated cheque carries a future date, so it is a promise to pay rather than money in hand. Tajir keeps it in its own account until the bank actually acts on it, so your cash is never overstated.</P>
          <H3>Recording a cheque</H3>
          <Step n={1}>On a Receipt or a Payment, add a tender line and set its type to <strong>PDC</strong>. Refunds, employee loans and owner movements accept PDC lines too.</Step>
          <Step n={2}>Enter the <strong>Cheque No.</strong> and the <strong>Due Date</strong>. Both are required — a PDC line cannot be saved without a due date, and editing the receipt later never clears it. Any older cheque that is missing one is flagged in the Cheque Register so it can be fixed.</Step>
          <Step n={3}>Pick the bank if you know it, then save. One document can mix Cash, Online and PDC lines in any combination.</Step>
          <H3>How it is accounted</H3>
          <Ul>
            <Li>A cheque you <strong>receive</strong> is debited to <strong>1112 Post-Dated Cheques Received</strong> — an asset.</Li>
            <Li>A cheque you <strong>issue</strong> is credited to <strong>2115 Post-Dated Cheques Issued</strong> — a liability.</Li>
            <Li>Either way the customer&apos;s or supplier&apos;s balance settles straight away, because the cheque has changed hands.</Li>
          </Ul>
          <H3>The Cheque Register</H3>
          <P>Go to <strong>Reports → Cheque Register</strong> to see every cheque with its due date, party, amount and status, soonest due first and overdue ones highlighted. Cheques are settled from here.</P>
          <Ul>
            <Li><strong>Pending</strong> — with the bank, not yet presented.</Li>
            <Li><strong>Cleared</strong> — the funds moved. The amount shifts between 1112/2115 and your bank account. The party&apos;s balance does not move, because it settled when you accepted the cheque.</Li>
            <Li><strong>Bounced</strong> — the cheque failed, so the amount goes back onto the party&apos;s balance: they owe you again, or you owe them again.</Li>
            <Li><strong>Endorsed</strong> — a cheque received from a customer that you handed straight on to a supplier instead of banking it. The original is consumed so it can never also clear into your account, but it can still bounce.</Li>
          </Ul>
          <H3>Cheques from before you started</H3>
          <P>Cheques that were already outstanding on the day you began using Tajir are loaded at <strong>Setup → Opening Balances → Post-Dated Cheques</strong> — one row per cheque with its number, amount, due date and party. They then behave exactly like any other cheque and can be cleared, bounced or endorsed.</P>
          <Note>Enter the party&apos;s own opening balance <strong>net of</strong> any cheque you load here, otherwise the same amount is counted twice.</Note>

          <H2 n="17">Employee Loans &amp; Advances</H2>
          <P>Money lent to a member of staff is not an expense — it is owed back. Tajir holds it in <strong>1135 Employee Loans &amp; Advances</strong> until it is recovered, so it stays on the Balance Sheet as an asset instead of reducing your profit.</P>
          <H3>Adding an employee</H3>
          <P>Go to <strong>Money → Employees → Add Employee</strong> and enter their name and details.</P>
          <H3>Disbursing a loan or advance</H3>
          <Step n={1}>Open the employee and choose <strong>Disburse Loan / Advance</strong>.</Step>
          <Step n={2}>Enter the amount, the Date and the Currency — with the exchange rate if it is in USD.</Step>
          <Step n={3}>If it is to be repaid in parts, set <strong>Installments</strong> and the <strong>First Due Date</strong>. Add a note if useful.</Step>
          <Step n={4}>Choose how the money leaves — cash, bank, or a PDC cheque — on the tender lines, then save.</Step>
          <Note>A salary advance and a loan are recorded exactly the same way. The only difference is whether you set installments.</Note>
          <H3>Recovering it</H3>
          <Ul>
            <Li><strong>Record Repayment</strong> — the employee pays it back in cash or through the bank.</Li>
            <Li><strong>Recover via Salary Deduction</strong> — the amount is taken out of their pay.</Li>
          </Ul>
          <H3>Tracking</H3>
          <P><strong>Money → Loans</strong> lists every loan with its principal, the amount still outstanding per employee, and the installment schedule.</P>

          <H2 n="18">Pricing</H2>
          <P>Set agreed selling prices per item per customer at <strong>Sell → Pricing</strong>. When you create a sale for that customer, the agreed rate fills in automatically — you can still override it on the line.</P>

          <H2 n="19">Expenses</H2>
          <P>Record operating expenses (rent, salaries, utilities, transport, etc.) at <strong>Money → Expenses → New Expense</strong>.</P>
          <Ul>
            <Li>Select the expense account from your Chart of Accounts.</Li>
            <Li>Enter the amount, date, and description, and how it was paid.</Li>
            <Li>Expenses appear in the Profit & Loss report and affect your net profit.</Li>
          </Ul>

          <H2 n="20">Owners — Capital & Drawings</H2>
          <P>If the business has one or more proprietors or partners, record them at <strong>Setup → Owners</strong> so their money is tracked separately from the business&apos;s own.</P>
          <Ul>
            <Li><strong>Contribution</strong> — the owner puts money in. It increases their capital.</Li>
            <Li><strong>Withdrawal</strong> — the owner takes money out. It posts to <strong>3400 Owner&apos;s Drawings</strong>.</Li>
          </Ul>
          <P>Each movement records which owner it belongs to, so capital and drawings can be reported per partner. Money can move by cash, bank or post-dated cheque, exactly like a receipt or payment.</P>
          <H3>Profit Allocation</H3>
          <P>Each owner carries a <strong>profit share %</strong>. At <strong>Setup → Owners → Profit Allocation</strong>, pick a period and Tajir shows the net profit for it and how it splits by share; confirm to move that profit out of <strong>3200 Retained Earnings</strong> into each partner&apos;s capital. A loss moves the other way. An allocation can be reopened or deleted while the period is still unlocked.</P>
          <Note>Shares need not total 100% while partners are still being added, but allocate only once they do — otherwise part of the profit stays unassigned.</Note>

          <H2 n="21">Agents &amp; Commission</H2>
          <P>An agent (arhti / broker) introduces trade on either side and is paid commission for it. Tajir treats agents as a party of their own — neither customer nor supplier — with their own ledger of commission earned and paid.</P>
          <H3>Enrolling an agent</H3>
          <P>Go to <strong>Money → Agents → Enrol Agent</strong> (or the Owners &amp; Staff step of the Setup Wizard). Beyond name and contact details, set the default commission separately for sales and for purchases, because the same broker is often paid on a different basis for each:</P>
          <Ul>
            <Li><strong>% of invoice value</strong> — e.g. 1% of the sale.</Li>
            <Li><strong>Per unit</strong> — a fixed rupee amount per KG, bag or piece.</Li>
            <Li><strong>Flat per invoice</strong> — a fixed amount whatever the size.</Li>
            <Li><strong>None</strong> — enrolled but not paid on that side.</Li>
          </Ul>
          <P>An <strong>opening balance</strong> is commission already owed to them on the day you started, and becomes the first line of their ledger.</P>
          <H3>Commission on an invoice</H3>
          <P>On a sale or purchase invoice, pick the <strong>Agent</strong>. Their default rate fills in and the commission is previewed as you type; you can change the rate for that one document. On save, Tajir accrues the amount — an expense for you, a payable to the agent — on the invoice&apos;s own journal entry. If the goods are later returned, the matching share of commission is clawed back on the return automatically, at the rate that was in force on the original invoice.</P>
          <H3>Paying an agent</H3>
          <P>Record what you pay from the agent&apos;s ledger with <strong>Record Payment</strong> — by cash, online or post-dated cheque, like any payment. The ledger shows every invoice, its commission, each payment, and the balance still owed.</P>

          <H2 n="22">Chart of Accounts</H2>
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
          <P>Go to <strong>Money → Accounts → Add Account</strong> and fill in the account code, name, and type.</P>
          <H3>Account Opening Balances</H3>
          <P>Each account can carry an opening balance, set from its row on the Accounts page. It posts as a dated journal entry against <strong>3300 Opening Balance Equity</strong>, so the Trial Balance and Balance Sheet stay in balance. Re-entering it replaces the previous figure rather than adding to it.</P>
          <Note>Customer and supplier opening balances (section 25) set the party subledger. To make the Balance Sheet agree, also set the opening balance here on <strong>1130 Accounts Receivable</strong> and <strong>2110 Accounts Payable</strong>.</Note>
          <H3>CSV Upload</H3>
          <P>To add accounts in bulk, prepare a CSV with columns: <code>code, name, type</code> and upload it on the Accounts page. This is the fastest way to migrate from an existing accounting system.</P>

          <H2 n="23">Vouchers</H2>
          <P>Vouchers are manual journal entries for accounting adjustments not covered by purchases, sales, or receipts.</P>
          <Step n={1}>Go to <strong>Money → Vouchers → New Voucher</strong>.</Step>
          <Step n={2}>Add debit and credit lines — each line has an account and an amount.</Step>
          <Step n={3}>Total debits must equal total credits. The system enforces this rule.</Step>
          <Step n={4}>Save. The voucher posts to the General Ledger immediately.</Step>

          <H2 n="24">Reports</H2>
          <P>All reports are available from <strong>Reports → Browse all reports</strong>. Use the date range filters on each report. Every report has a Print / Save as PDF button, and most can be exported to Excel.</P>
          <ReportTable rows={EN_REPORTS} />
          <Note>Cost figures (COGS) in the P&L reports are estimated using the <em>latest purchase rate</em> per item. The opening rate is used for stock that was entered as an opening balance.</Note>

          <H2 n="25">Setup & Settings</H2>
          <P>The <strong>Setup</strong> group is visible to owners only.</P>
          <H3>Setup Wizard</H3>
          <P><strong>Setup → Setup Wizard</strong> walks through every master record a transaction depends on — business profile, chart of accounts, categories, warehouses, items, customers, suppliers, banks, then the optional owners, staff, agents and team logins — in the order they are needed. It shows what is already there, takes rows in bulk, and finishes with a checklist and the road to opening balances. Section 2 describes each step; the pages below are the same data, one at a time.</P>
          <H3>Business Profile</H3>
          <P>Your business name, address and NTN at <strong>Setup → Business</strong>. These appear on printed invoices and vouchers.</P>
          <H3>Modules</H3>
          <P>Turn features on or off at <strong>Setup → Modules</strong>. A disabled module disappears from the menu for everyone, which is a good way to keep the app simple if you do not use gatepasses, pricing or loans.</P>
          <H3>Opening Balances</H3>
          <P><strong>Setup → Opening Balances</strong> is where you bring your existing business onto the books. It has four sections:</P>
          <Ul>
            <Li><strong>Stock Item Quantities</strong> — quantity and cost rate per item, split across as many locations as the item was held at.</Li>
            <Li><strong>Customer Opening Balances</strong> — what each customer already owed you. Negative for an advance they had paid.</Li>
            <Li><strong>Supplier Opening Balances</strong> — what you already owed each supplier. Negative for an advance you had paid.</Li>
            <Li><strong>Post-Dated Cheques</strong> — one row per cheque already in hand or already written, with its number, amount and due date.</Li>
          </Ul>
          <Note>Enter a party&apos;s opening balance <strong>net of</strong> any post-dated cheque you load for them, or the same money is counted twice.</Note>
          <H3>Item Types</H3>
          <P>Product categories used to group stock items. Add, rename, or remove at <strong>Setup → Item Types</strong>.</P>
          <H3>Team Management</H3>
          <P>Invite team members at <strong>Setup → Team → Invite Member</strong>.</P>
          <Ul>
            <Li><strong>Owner</strong> — full access to all features and settings.</Li>
            <Li><strong>Assistant</strong> — can create purchases, sales, gatepasses, and view their own transactions. Cannot open Setup, sale returns, or other users&apos; records. By default an assistant sees the transaction modules only — sales, purchases, returns, receipts, payments, stock, gatepasses, employees and loans — and the owner chooses exactly which modules each assistant gets from the Team page.</Li>
          </Ul>
          <H3>Banks</H3>
          <P>Add bank accounts at <strong>Setup → Banks</strong>. They appear in the Cashbook, Bank Statement and Chart of Accounts. Each bank also carries its own opening balance, which seeds the Bank Statement report.</P>
          <H3>Closing the Books</H3>
          <P>Lock a finished period at <strong>Setup → Close the Books</strong>. Nothing dated on or before the lock date can be created, edited or deleted — sales, purchases, receipts, payments, returns, notes and vouchers alike. Later dates carry on as normal. The rule lives in the database, so it applies everywhere including the mobile app.</P>
          <H3>Audit Log</H3>
          <P>Every change in the system is recorded at <strong>Setup → Audit Log</strong>, showing the date, user, action and the data that changed. Useful for reviewing edits or investigating discrepancies.</P>
          <H3>Demo Playground</H3>
          <P><strong>Setup → Demo Playground</strong> generates realistic sample data so you can try features safely, and removes it again in one click. Useful for training staff without touching real records.</P>

          <H2 n="26">Support</H2>
          <P>If you need help or encounter any issue:</P>
          <Step n={1}>Go to <strong>Help → Support → New Ticket</strong>.</Step>
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

          <Link
            href="/ask"
            className="print-hide flex items-center gap-3 rounded-xl border border-primary/30 bg-accent/40 px-4 py-3 mb-2 hover:bg-accent transition-colors flex-row-reverse"
          >
            <span className="text-sm text-foreground flex-1">
              <strong>ابھی کوئی سوال ہے؟</strong> &rdquo;پوچھیں&ldquo; عام سوالوں کے آسان جواب دیتا ہے اور آپ کے اپنے کھاتے اور بیلنس بھی نکال کر دکھاتا ہے۔
            </span>
            <span className="text-xs font-semibold text-primary shrink-0">← پوچھیں کھولیں</span>
          </Link>

          <div className="rounded-xl border border-border bg-card px-4 py-3 mb-2 print:border-gray-300">
            <p className="text-[11px] font-bold tracking-wider text-muted-foreground mb-1.5">نیا کیا ہے — ستمبر ۲۰۲۶</p>
            <UUl>
              <ULi><strong>سیٹ اپ وزرڈ</strong> — نئے کاروبار کا سارا بنیادی ڈیٹا ایک راہنما ترتیب میں (سیکشن ۲)۔</ULi>
              <ULi><strong>نیا مینو اور رنگ</strong> — اوپر روزمرہ دستاویزات کے چھ بٹن، Sell / Buy / Stock / Money / Reports / Setup / Help گروپ، اور دن / رات کا بٹن (سیکشن ۱)۔</ULi>
              <ULi><strong>ایجنٹ اور کمیشن</strong> — بروکر درج کریں، ہر بل پر کمیشن خود بنے، واپسی پر کٹ جائے (سیکشن ۲۱)۔</ULi>
              <ULi><strong>واٹس ایپ بل</strong> — فروخت بل گاہک کے فون پر، دیکھنے اور ڈاؤن لوڈ کے لنک کے ساتھ (سیکشن ۱۲)۔</ULi>
              <ULi><strong>منافع کی تقسیم</strong> — مدت کا منافع حصوں کے مطابق شراکت داروں میں بانٹیں (سیکشن ۲۰)۔</ULi>
              <ULi><strong>پوچھیں</strong> — تجزیاتی رپورٹیں، ای میل شدہ جواب اور بیان، اور سوالوں کی تاریخ (سیکشن ۴)۔</ULi>
              <ULi><strong>چیک</strong> — اب ہر مؤخر چیک پر مقررہ تاریخ لازمی ہے (سیکشن ۱۶)۔</ULi>
              <ULi><strong>اندراج</strong> — Enter ہر جگہ اگلے خانے میں لے جاتا ہے؛ رپورٹیں ارد گرد کے صفحے کے بغیر چھپتی ہیں۔</ULi>
            </UUl>
          </div>

          <UH2 n="۱">تعارف</UH2>
          <UP>
            <strong>تاجر</strong> ایک مکمل تجارتی نظم و نسق سافٹ ویئر ہے جو خریداری، فروخت، اسٹاک، گاہکوں، سپلائرز، حسابات اور رپورٹس کو ایک پلیٹ فارم پر یکجا کرتا ہے۔
            یہ سافٹ ویئر دو کرنسیوں (پاکستانی روپیہ اور امریکی ڈالر)، متعدد گودام مقامات اور مکمل دہری اندراج نظام حسابات کو سپورٹ کرتا ہے۔
          </UP>
          <UUl>
            <ULi>کردار کی بنیاد پر رسائی: <strong>مالک</strong> کو تمام خصوصیات تک رسائی ہے؛ <strong>اسسٹنٹ</strong> لین دین ریکارڈ کر سکتا ہے لیکن ترتیبات تبدیل نہیں کر سکتا۔</ULi>
            <ULi>تمام رقوم پاکستانی روپیہ میں محفوظ اور دکھائی جاتی ہیں۔ ڈالر کی رقم شرح تبادلہ کے مطابق خودبخود تبدیل ہوتی ہے۔</ULi>
            <ULi>مینو کے سب سے اوپر روزمرہ دستاویزات کے چھ بٹن ہیں — <strong>فروخت، خریداری، وصولی، ادائیگی، اخراج، گیٹ پاس</strong> — پھر <strong>ڈیش بورڈ</strong> اور <strong>پوچھیں</strong>، اور پھر کام کے لحاظ سے سات گروپ: <strong>فروخت (Sell)</strong>، <strong>خریداری (Buy)</strong>، <strong>اسٹاک (Stock)</strong>، <strong>رقم (Money)</strong>، <strong>رپورٹیں (Reports)</strong>، <strong>سیٹ اپ (Setup)</strong> (صرف مالک) اور <strong>مدد (Help)</strong>۔ اس راہنما میں &rdquo;فروخت ← گاہک&ldquo; کا مطلب وہی گروپ اور وہی صفحہ ہے۔ آپ جس صفحے پر ہوں، اس کا گروپ خود کھل جاتا ہے۔</ULi>
            <ULi>جو ماڈیول آپ استعمال نہیں کرتے انہیں سیٹ اپ ← ماڈیولز سے بند کیا جا سکتا ہے، پھر وہ سب کے لیے چھپ جاتے ہیں۔ اگر یہاں بتایا گیا کوئی صفحہ نظر نہ آئے تو پہلے وہیں دیکھیں۔</ULi>
            <ULi>کہیں بھی <strong>Ctrl+K</strong> دبا کر کمانڈ پیلٹ کھولیں اور نام لکھ کر کسی بھی صفحے پر سیدھے پہنچ جائیں۔</ULi>
            <ULi>ہر اندراج فارم پر <strong>Enter</strong> اگلے خانے میں لے جاتا ہے — فریق یا آئٹم چننے کے فوراً بعد بھی — اس لیے پورا بل ماؤس چھوئے بغیر لکھا جا سکتا ہے۔</ULi>
            <ULi>ہیڈر میں سورج / چاند کا بٹن پوری ایپلیکیشن کو <strong>دن</strong> اور <strong>رات</strong> کے رنگوں میں بدلتا ہے۔ آپ کی پسند اسی آلے پر یاد رہتی ہے۔</ULi>
            <ULi>ہر رپورٹ اور دستاویز پر <strong>پرنٹ</strong> بٹن صرف رپورٹ چھاپتا ہے — ارد گرد کا مینو یا ہیڈر نہیں — یا اسے پی ڈی ایف میں محفوظ کرتا ہے۔</ULi>
          </UUl>

          <UH2 n="۲">ابتداء — پہلی بار ترتیب</UH2>
          <UP>پہلے بل سے پہلے تاجر کو آپ کا بنیادی ڈیٹا چاہیے: آپ کون ہیں، کھاتے کس لیجر میں جائیں گے، آپ کیا بیچتے ہیں، وہ کہاں رکھا ہے، اور آپ کس سے لین دین کرتے ہیں۔ <strong>سیٹ اپ وزرڈ</strong> یہ سب ایک جگہ، صحیح ترتیب سے جمع کرتا ہے۔</UP>
          <UStep n="۱">سیٹ اپ ← سیٹ اپ وزرڈ پر جائیں (مالک کو ڈیش بورڈ پر بھی <strong>Setup Wizard</strong> کا بٹن ملتا ہے)۔</UStep>
          <UStep n="۲"><strong>کاروباری پروفائل</strong> — کاروبار کا نام اور این ٹی این، جو ہر بل اور واؤچر پر چھپتے ہیں۔</UStep>
          <UStep n="۳"><strong>حسابات کا چارٹ</strong> — ایک کلک سے تجارتی کاروبار کا معیاری لیجر لوڈ ہو جاتا ہے۔ دوبارہ چلانا محفوظ ہے؛ موجودہ اکاؤنٹس کبھی تبدیل نہیں ہوتے۔</UStep>
          <UStep n="۴"><strong>آئٹم اقسام</strong> — اپنے کاروبار کی اقسام چنیں (دھاگہ، گریج، کپڑا، الیکٹرک…) یا اپنی لکھیں، چاہیں تو ذیلی اقسام کے ساتھ۔</UStep>
          <UStep n="۵"><strong>گودام</strong> — ہر گودام یا دکان جہاں اسٹاک رکھا ہے۔ ایک گودام والے کاروبار کو بھی ایک درج کرنا ہوگا۔</UStep>
          <UStep n="۶"><strong>اسٹاک آئٹمز</strong> — ہر مصنوع کی ایک سطر، بمع قسم، کاؤنٹ/گریڈ اور یونٹ۔ کئی سطریں لکھ کر ایک ساتھ محفوظ کریں۔</UStep>
          <UStep n="۷"><strong>گاہک</strong>، <strong>سپلائر</strong> اور <strong>بینک اکاؤنٹس</strong> — اسی طرح سطروں میں، ہر ایک اپنے ابتدائی بیلنس کے ساتھ۔</UStep>
          <UStep n="۸"><strong>مالکان اور عملہ</strong> اور <strong>ٹیم رسائی</strong> اختیاری ہیں — شراکت دار، ملازمین، ایجنٹ، اور منشی کے لیے لاگ ان۔</UStep>
          <UStep n="۹"><strong>جائزہ اور تکمیل</strong> دکھاتا ہے کہ کیا بھر گیا اور کیا ابھی خالی ہے، پھر سیٹ اپ ← ابتدائی بیلنس کی طرف لے جاتا ہے تاکہ پہلے دن کا اسٹاک، نقد اور مؤخر چیک درج ہوں۔</UStep>
          <UUl>
            <ULi>وزرڈ پہلے سے موجود ڈیٹا پڑھتا ہے، اس لیے مزید شامل کرنے کے لیے کبھی بھی واپس آ سکتے ہیں — کچھ بھی دو بار نہیں بنتا، اور ہر مرحلہ اس ڈیٹا کے مکمل صفحے سے جڑا ہے۔</ULi>
            <ULi>ہر مرحلہ اپنے صفحے سے بھی ہو سکتا ہے: سیٹ اپ ← کاروبار / آئٹم اقسام / بینک، اسٹاک ← مقامات / انوینٹری، فروخت ← گاہک، خریداری ← سپلائر، رقم ← اکاؤنٹس۔</ULi>
          </UUl>
          <UNote>ابتدائی بیلنس ہی وہ کام ہے جو احتیاط سے کرنا چاہیے — ہر رپورٹ اسی پر کھڑی ہے۔ سیکشن ۲۵ میں چاروں اقسام کی تفصیل ہے۔</UNote>

          <UH2 n="۳">ڈیش بورڈ</UH2>
          <UP>ڈیش بورڈ آپ کے کاروبار کی فوری جھلک دکھاتا ہے۔ اوپر کی قطار سب کو نظر آتی ہے؛ مالک کو نیچے مزید اعداد و شمار اور تجزیے بھی ملتے ہیں۔</UP>
          <UH3>اعداد و شمار کارڈز</UH3>
          <UUl>
            <ULi><strong>فروخت (اس ماہ)</strong> — رواں مہینے کی اب تک کی کل فروخت۔</ULi>
            <ULi><strong>خریداری (اس ماہ)</strong> — رواں مہینے کی اب تک کی کل خریداری۔</ULi>
            <ULi><strong>وصولیاں</strong> — تمام گاہکوں کے ذمے واجب: ابتدائی بیلنس اور فروخت، منہا وصولیاں، فروخت واپسی اور کریڈٹ نوٹ، جمع ریفنڈ۔</ULi>
            <ULi><strong>ادائیگیاں</strong> — تمام سپلائرز کو دینے والی رقم، اسی اصول پر۔</ULi>
            <ULi><strong>انوینٹری</strong> — تمام آئٹمز کی کل موجود مقدار۔</ULi>
          </UUl>
          <UH3>بڑھاپا کارڈز</UH3>
          <UP>ان کے نیچے <strong>وصولی بڑھاپا</strong> اور <strong>ادائیگی بڑھاپا</strong> بتاتے ہیں کہ یہ رقم کتنی پرانی ہے — ۰ تا ۳۰، ۳۱ تا ۶۰، ۶۱ تا ۹۰ اور ۹۰+ دن کے خانوں میں، ایک متناسب پٹی کے ساتھ۔ نمایاں عدد وہ ہے جو ۳۰ دن سے پرانا ہو چکا۔ ہر کارڈ سے مکمل رپورٹ کھلتی ہے۔</UP>
          <UH3>مالک کے اعداد و شمار اور تجزیے</UH3>
          <UUl>
            <ULi>دوسری قطار: <strong>آرڈرز (اس ماہ)</strong>، <strong>اوسط فروخت</strong>، <strong>وصولیاں (اس ماہ)</strong> اور <strong>مجموعی منافع</strong>۔</ULi>
            <ULi><strong>فروخت کا تجزیہ</strong> — مصنوع اور فریق کے لحاظ سے فروخت، مدت منتخب کرنے کی سہولت کے ساتھ۔</ULi>
          </UUl>
          <UH3>گراف</UH3>
          <UP><strong>زمرے کے لحاظ سے اسٹاک</strong> ایک ڈونٹ چارٹ ہے۔ <strong>آمدنی بمقابلہ خریداری</strong> گزشتہ ۶ ماہ کا لائن چارٹ ہے — آمدنی ٹھوس لکیر، خریداری نقطہ دار۔</UP>
          <UH3>حالیہ لین دین اور فوری کارروائیاں</UH3>
          <UP>تازہ ترین فروخت اور خریداری کے ساتھ عام کاموں کے یک کلک روابط: نئی فروخت، نئی خریداری، وصولی، ادائیگی، گیٹ پاس، اخراج، انوینٹری اور رپورٹیں۔ مالک کو نفع و نقصان اور بیلنس شیٹ کے شارٹ کٹ بھی ملتے ہیں۔</UP>
          <UH3>سپورٹ اطلاع</UH3>
          <UP>اگر آپ کی کھلی سپورٹ ٹکٹیں ہیں تو ڈیش بورڈ پر ایک سنہری بینر نظر آتا ہے اور سپورٹ مینو پر سرخ بیج دکھائی دیتا ہے۔</UP>

          <UH2 n="۴">پوچھیں — اپنے کاروبار کے بارے میں سوال</UH2>
          <UP>پوچھیں (مینو کے اوپر) ایک چیٹ باکس ہے جس میں آپ سادہ زبان میں سوال لکھ سکتے ہیں۔ یہ دو طرح جواب دیتا ہے۔</UP>
          <UUl>
            <ULi><strong>آپ کے ڈیٹا کے بارے میں</strong> — &rdquo;علی ٹریڈرز کا لیجر&ldquo;، &rdquo;کس نے میرے پیسے دینے ہیں&ldquo;، &rdquo;اسٹاک خلاصہ&ldquo;، &rdquo;زائد المیعاد چیک&ldquo;۔ جواب صرف درج شدہ ریکارڈ سے بنتا ہے — کچھ اندازہ نہیں لگایا جاتا۔</ULi>
            <ULi><strong>کام کیسے کریں</strong> — &rdquo;فروخت کا بل کیسے بنائیں&ldquo;، &rdquo;PDC کیا ہے&ldquo;، &rdquo;ابتدائی اسٹاک کیسے درج کریں&ldquo;۔ ان کا جواب قدم بہ قدم ہدایات اور متعلقہ صفحے کے لنک کے ساتھ آتا ہے۔</ULi>
          </UUl>
          <UP>تجویز کردہ سوال پر کلک کریں، یا کسی فریق یا آئٹم کا نام لکھ کر سیدھے اس کے لیجر تک پہنچیں۔</UP>
          <UUl>
            <ULi><strong>تجزیہ</strong> — &rdquo;ماہانہ فروخت&ldquo;، &rdquo;فروخت بمقابلہ خریداری&ldquo;، &rdquo;اخراجات&ldquo;، &rdquo;گاہکوں کی درجہ بندی&ldquo; یا &rdquo;سپلائرز کی درجہ بندی&ldquo; پوچھیں تو بارہ مہینوں کا جدول اور گراف سیدھا لیجر سے بن کر آتا ہے۔</ULi>
            <ULi><strong>ای میل</strong> — سوال &rdquo;email me&ldquo; سے شروع کریں (&rdquo;email me the ledger of Star Textiles&ldquo;) یا کسی بھی جواب پر <strong>Email</strong> بٹن دبائیں۔ جواب ایک ترتیب شدہ ای میل کے طور پر جاتا ہے اور جدول اسپریڈ شیٹ کی صورت میں منسلک ہوتا ہے۔ اگر گاہک یا سپلائر کی ای میل درج ہے تو اس کا بیان سیدھا اسے بھیجا جا سکتا ہے۔</ULi>
            <ULi><strong>تاریخ</strong> — تاجر یاد رکھتا ہے کہ آپ کا کاروبار کیا پوچھتا ہے۔ پچھلے سوال تجاویز کے طور پر واپس ملتے ہیں، اور جن کا جواب نہ مل سکا وہ جمع ہوتے ہیں تاکہ سپورٹ انہیں شامل کر سکے۔</ULi>
          </UUl>

          <UH2 n="۵">اسٹاک انتظام</UH2>
          <UH3>آئٹم اقسام</UH3>
          <UP>آئٹم اقسام اسٹاک آئٹمز کے لیے زمرے ہیں۔ انہیں سیٹ اپ ← آئٹم اقسام پر یا سیٹ اپ وزرڈ سے شامل کریں۔</UP>
          <UP>ایک قسم کی <strong>ذیلی اقسام</strong> ہو سکتی ہیں — <em>دھاگہ ← کاٹن، پالیسٹر، بلینڈ</em>۔ جب کسی قسم کی ذیلی اقسام ہوں تو آئٹم ذیلی قسم کے تحت درج ہوتے ہیں اور قسم خود انتخاب کی فہرست اور &rdquo;قسم کے حساب سے اسٹاک&ldquo; گراف میں سرخی بن جاتی ہے۔</UP>
          <UH3>اسٹاک آئٹمز</UH3>
          <UP>ہر اسٹاک آئٹم ایک مخصوص مصنوع کو ظاہر کرتا ہے جو آپ خریدتے اور بیچتے ہیں۔ فیلڈز:</UP>
          <UUl>
            <ULi><strong>نام</strong> — آئٹم کا نام (ضروری)۔</ULi>
            <ULi><strong>کوڈ</strong> — آپ کا اندرونی پروڈکٹ کوڈ (اختیاری)۔</ULi>
            <ULi><strong>کاؤنٹ</strong> — دھاگے کا کاؤنٹ یا تخصیص (اختیاری)۔</ULi>
            <ULi><strong>فائبر</strong> — مواد کی قسم، مثلاً کاٹن، پولیسٹر (اختیاری)۔</ULi>
            <ULi><strong>قسم</strong> — آئٹم کی زمرہ قسم (اختیاری)۔</ULi>
            <ULi><strong>نوعیت</strong> — <strong>انوینٹری</strong> (جس کی گنتی اور لاگت رکھی جائے) یا <strong>سروس</strong> (مثلاً کرایہ یا مزدوری)۔ سروس آئٹم کا اسٹاک نہیں ہوتا، اس لیے وہ فروخت نہیں روکتا اور اس کی لاگت درج نہیں ہوتی۔</ULi>
          </UUl>
          <UP>اسٹاک ← انوینٹری ← نیا آئٹم شامل کریں پر جائیں، یا <strong>قسم کے حساب سے آئٹم بنائیں</strong> سے ایک قسم کے کئی آئٹم ایک ساتھ بنائیں۔ ہر آئٹم کو تاجر خود ایک اسکین ہونے والا <strong>SKU</strong> (<em>TJR-000123</em>) دیتا ہے، اور اس کا <strong>یونٹ</strong> (کلو، کون، تھان، میٹر…) قسم کے مطابق تجویز ہوتا ہے۔</UP>
          <UH3>بارکوڈ لیبل</UH3>
          <UP>انوینٹری کی فہرست میں آئٹم منتخب کر کے <strong>لیبل پرنٹ کریں</strong> چنیں، یا کسی ایک سطر پر لیبل کا نشان دبائیں۔ ہر لیبل پر آئٹم کا نام، کاؤنٹ اور SKU کا بارکوڈ ہوتا ہے، معیاری لیبل شیٹ کے ناپ پر — تاکہ گودام میں پڑی بوری یا گانٹھ کو تاجر کے ریکارڈ سے ملایا جا سکے۔</UP>
          <UH3>ابتدائی اسٹاک</UH3>
          <UP>تاجر سے پہلے کے اسٹاک کی مقدار، لاگت ریٹ اور مقام سیٹ اپ ← ابتدائی بیلنس ← اسٹاک کی مقدار پر درج کریں۔ یہ ریٹ اسٹاک ویلیویشن اور نفع کے حساب میں استعمال ہوتا ہے، اس لیے فروخت قیمت نہیں بلکہ اپنی لاگت درج کریں۔</UP>

          <UH2 n="۶">مقامات اور اسٹاک منتقلی</UH2>
          <UH3>مقامات</UH3>
          <UP>اپنے گودام یا ذخیرہ گاہیں اسٹاک ← مقامات ← مقام شامل کریں پر بنائیں۔ خریداری کسی مقام پر آتی ہے اور فروخت کسی مقام سے جاتی ہے، اس لیے لین دین سے پہلے یہ بنا لیں۔</UP>
          <UH3>اسٹاک منتقلی</UH3>
          <UStep n="۱">اسٹاک ← اسٹاک منتقلی ← نئی منتقلی پر جائیں۔</UStep>
          <UStep n="۲">ماخذ مقام، منزل مقام، آئٹم اور مقدار منتخب کریں۔</UStep>
          <UStep n="۳">محفوظ کریں۔ مقام بہ مقام اسٹاک رپورٹ خودبخود اپ ڈیٹ ہو جاتی ہے۔</UStep>
          <UNote>ابتدائی اسٹاک سیدھا کئی گوداموں پر درج ہو سکتا ہے (سیکشن ۵)۔ منتقلی اس اسٹاک کے لیے ہے جو <em>بعد میں</em> ایک جگہ سے دوسری جگہ جائے — اس سے کل مقدار نہیں بدلتی، صرف جگہ بدلتی ہے۔</UNote>

          <UH2 n="۷">خریداری</UH2>
          <UP>سپلائر سے خریدا گیا سامان ریکارڈ کریں۔</UP>
          <UStep n="۱">خریداری ← نئی خریداری پر جائیں۔</UStep>
          <UStep n="۲"><strong>سپلائر</strong>، <strong>تاریخ</strong> اور <strong>وصولی کا مقام</strong> منتخب کریں — یعنی سامان کس گودام میں آ رہا ہے۔</UStep>
          <UStep n="۳">آئٹم، مقدار اور ریٹ کے ساتھ ایک یا زیادہ سطریں شامل کریں۔</UStep>
          <UStep n="۴">کرنسی منتخب کریں: روپیہ یا ڈالر۔ ڈالر کی صورت میں شرح تبادلہ درج کریں۔</UStep>
          <UStep n="۵"><strong>سپلائر بل نمبر</strong> درج کریں تاکہ بعد میں سپلائر کے اپنے بل نمبر سے یہ خریداری تلاش کی جا سکے۔</UStep>
          <UStep n="۶">اگر اسی وقت کچھ ادائیگی کی ہے تو <strong>ادا شدہ ایڈوانس</strong> میں درج کریں۔</UStep>
          <UStep n="۷">محفوظ کریں۔ اسٹاک بڑھ جاتا ہے اور سپلائر کا بیلنس باقی رقم کے برابر بڑھتا ہے۔</UStep>
          <UNote>ادا شدہ ایڈوانس بل پر ہی طے ہو جاتا ہے، اس لیے ادائیگیوں اور ادائیگی بڑھاپا میں صرف باقی رقم آتی ہے۔ اگر حذف کرنے سے اسٹاک صفر سے نیچے جائے تو سسٹم بلاک کر دے گا۔</UNote>

          <UH2 n="۸">خریداری واپسی</UH2>
          <UP>سپلائر کو واپس کیا گیا سامان ریکارڈ کریں (خراب یا غلط سامان)۔</UP>
          <UStep n="۱">خریداری ← خریداری واپسی ← نئی واپسی پر جائیں۔</UStep>
          <UStep n="۲">چاہیں تو <strong>خریداری آرڈر کے مقابل</strong> منتخب کریں تاکہ اصل آئٹم، مقدار اور ریٹ خودبخود آ جائیں۔</UStep>
          <UStep n="۳">سپلائر، <strong>واپسی کی تاریخ</strong> اور <strong>مقام</strong> منتخب کریں، پھر آئٹم، مقدار اور ریٹ اور <strong>وجہ</strong> درج کریں۔</UStep>
          <UStep n="۴">محفوظ کریں۔ اسٹاک کم ہو جاتا ہے اور سپلائر کو دینے والی رقم گھٹ جاتی ہے۔</UStep>
          <UNote>اگر واپسی سے دستیاب اسٹاک صفر سے نیچے جائے تو سسٹم لین دین بلاک کر دے گا۔ سامان کی نقل و حرکت کے بغیر سپلائر کا بیلنس ایڈجسٹ کرنا ہو تو ڈیبٹ نوٹ استعمال کریں (سیکشن ۱۴)۔</UNote>

          <UH2 n="۹">فروخت</UH2>
          <UP>گاہک کو فروخت کیا گیا سامان ریکارڈ کریں۔</UP>
          <UStep n="۱">فروخت ← نئی فروخت پر جائیں۔</UStep>
          <UStep n="۲"><strong>گاہک</strong>، <strong>فروخت کی تاریخ</strong> اور <strong>روانگی کا مقام</strong> منتخب کریں — یعنی سامان کس گودام سے جا رہا ہے۔</UStep>
          <UStep n="۳">آئٹم، مقدار اور ریٹ شامل کریں۔ اگر اس گاہک کے لیے قیمت طے ہے تو ریٹ خودبخود آ جاتا ہے۔</UStep>
          <UStep n="۴">کرنسی منتخب کریں (روپیہ یا ڈالر)۔</UStep>
          <UStep n="۵">چاہیں تو <strong>مہلت کے دن</strong> درج کریں جس سے <strong>ادائیگی کی آخری تاریخ</strong> بن جاتی ہے، نیز <strong>پی او نمبر</strong>، <strong>ڈی سی نمبر</strong> اور نوٹس۔</UStep>
          <UStep n="۶">محفوظ کریں۔ اسٹاک اسی مقام سے کم ہوتا ہے اور گاہک کا بیلنس بڑھ جاتا ہے۔</UStep>
          <UUl>
            <ULi>آپ منتخب کردہ <em>مقام</em> پر موجود اسٹاک سے زیادہ فروخت نہیں کر سکتے — سسٹم &quot;ناکافی اسٹاک&quot; کی خرابی دکھا کر روک دیتا ہے۔</ULi>
            <ULi>اگر کوئی سطر لاگت سے کم قیمت پر ہو تو محفوظ کرنے سے پہلے تصدیق مانگی جاتی ہے۔</ULi>
            <ULi>محفوظ کرنے کے بعد مختصر واؤچر یا مکمل اے فور بل پرنٹ کیا جا سکتا ہے۔</ULi>
          </UUl>

          <UH2 n="۱۰">فروخت واپسی</UH2>
          <UP>گاہک کی طرف سے واپس کیا گیا سامان ریکارڈ کریں۔</UP>
          <UStep n="۱">فروخت ← فروخت واپسی ← نئی واپسی پر جائیں۔</UStep>
          <UStep n="۲">چاہیں تو <strong>فروخت آرڈر کے مقابل</strong> منتخب کریں تاکہ اصل آئٹم، مقدار اور ریٹ خودبخود آ جائیں۔</UStep>
          <UStep n="۳">گاہک، <strong>واپسی کی تاریخ</strong> اور <strong>مقام</strong> منتخب کریں، پھر آئٹم، مقدار، ریٹ اور <strong>وجہ</strong> درج کریں۔</UStep>
          <UStep n="۴">محفوظ کریں۔ اسٹاک بڑھ جاتا ہے اور گاہک کا بیلنس کم ہو جاتا ہے۔</UStep>
          <UNote>فروخت واپسی صرف مالک کر سکتا ہے — اسسٹنٹ یہ فارم نہیں کھول سکتا۔ سامان کی نقل و حرکت کے بغیر گاہک کا بیلنس کم کرنا ہو تو کریڈٹ نوٹ استعمال کریں (سیکشن ۱۴)۔</UNote>

          <UH2 n="۱۱">گیٹ پاس</UH2>
          <UP>گیٹ پاس آپ کے گودام کے دروازے پر سامان کی آمد و رفت کا ریکارڈ رکھتے ہیں۔</UP>
          <UH3>اندرونی گیٹ پاس</UH3>
          <UP>جب گاڑی خریدا ہوا سامان لے کر آئے تو اندرونی گیٹ پاس بنائیں۔ خریداری آرڈر سے منسلک کریں تاکہ معلوم رہے کتنا سامان آیا اور کتنا باقی ہے۔</UP>
          <UH3>بیرونی گیٹ پاس</UH3>
          <UP>جب گاڑی فروخت کیا ہوا سامان لے کر جائے تو بیرونی گیٹ پاس بنائیں۔ فروخت آرڈر سے منسلک کریں۔</UP>
          <UP>زیر التواء بیلنس رپورٹ ان تمام آرڈرز کو دکھاتی ہے جن کا گیٹ پاس ابھی تک نہیں ہوا۔</UP>

          <UH2 n="۱۲">گاہک اور وصولیاں</UH2>
          <UH3>گاہک</UH3>
          <UP>اپنے گاہک فروخت ← گاہک پر شامل کریں — نام، فون، پتہ اور حالت (فعال، غیر فعال، کم لین دین) کے ساتھ۔ سطر پر موجود پنسل سے گاہک میں ترمیم ہوتی ہے، بشمول اس کا <strong>ابتدائی بیلنس</strong> یعنی تاجر شروع کرنے سے پہلے کا واجب الادا۔</UP>
          <UP><strong>بقایا</strong> کالم ابتدائی بیلنس اور فروخت جمع کر کے، وصولیاں، فروخت واپسی اور کریڈٹ نوٹ منہا کر کے، اور ریفنڈ جمع کر کے بنتا ہے۔ سبز <em>کریڈٹ</em> کا نشان بتاتا ہے کہ رقم آپ کے ذمے ہے۔ مکمل بیان کے لیے گاہک کا <strong>لیجر</strong> کھولیں۔</UP>
          <UH3>بل واٹس ایپ پر بھیجنا</UH3>
          <UP>کسی بھی فروخت بل کے پرنٹ صفحے پر <strong>WhatsApp</strong> دبائیں۔ واٹس ایپ کھلتا ہے جس میں گاہک کا نمبر — اس کے <strong>فون</strong> سے — پہلے سے بھرا ہوتا ہے، اور ایک تیار پیغام جس میں بل نمبر، رقم اور ایک لنک ہوتا ہے جس سے گاہک لاگ ان کیے بغیر بل دیکھ یا ڈاؤن لوڈ کر سکتا ہے۔ بھیجنے کا بٹن آپ خود واٹس ایپ میں دباتے ہیں، اس لیے آپ کی مرضی کے بغیر کچھ نہیں جاتا۔</UP>
          <UH3>وصولیاں</UH3>
          <UP>گاہکوں سے ملنے والی رقم فروخت ← وصولیاں ← نئی وصولی پر ریکارڈ کریں۔</UP>
          <UUl>
            <ULi>گاہک، تاریخ اور رقم درج کریں۔</ULi>
            <ULi>ٹینڈر سطروں سے بتائیں رقم کیسے آئی — <strong>نقد</strong>، <strong>آن لائن</strong> یا <strong>PDC</strong> (مؤخر تاریخ چیک)۔ ایک ہی وصولی میں تینوں ملائے جا سکتے ہیں۔</ULi>
            <ULi><strong>وصولی کا حساب</strong> طے کرتا ہے کہ لیجر میں کون سا نقد یا بینک اکاؤنٹ ڈیبٹ ہوگا۔</ULi>
            <ULi>گاہک کا بقایا کم ہو جاتا ہے اور اندراج خودبخود حسابات کے لیجر میں چلا جاتا ہے۔</ULi>
          </UUl>

          <UH2 n="۱۳">سپلائر اور ادائیگیاں</UH2>
          <UH3>سپلائر</UH3>
          <UP>اپنے سپلائرز خریداری ← سپلائر پر شامل کریں — نام، فون اور رابطہ معلومات کے ساتھ۔ گاہکوں کی طرح یہاں بھی پنسل سے <strong>ابتدائی بیلنس</strong> سمیت ترمیم ہوتی ہے اور ہر سطر سے مکمل <strong>لیجر</strong> کھلتا ہے۔</UP>
          <UH3>ادائیگیاں</UH3>
          <UP>سپلائرز کو دی گئی رقم خریداری ← ادائیگیاں ← نئی ادائیگی پر ریکارڈ کریں۔</UP>
          <UUl>
            <ULi>سپلائر، تاریخ اور رقم درج کریں۔</ULi>
            <ULi>ٹینڈر سطریں <strong>نقد</strong>، <strong>آن لائن</strong> یا <strong>PDC</strong> میں تقسیم کریں، بالکل وصولی کی طرح۔ <strong>ادائیگی کا حساب</strong> طے کرتا ہے کون سا اکاؤنٹ کریڈٹ ہوگا۔</ULi>
            <ULi>گاہک سے ملا چیک یہیں سے سپلائر کو آگے دیا جا سکتا ہے — سیکشن ۱۶ میں &rdquo;منتقل شدہ&ldquo; دیکھیں۔</ULi>
            <ULi>ادائیگی محفوظ ہونے پر سپلائر کا بقایا کم ہو جاتا ہے۔</ULi>
          </UUl>

          <UH2 n="۱۴">کریڈٹ نوٹ اور ڈیبٹ نوٹ</UH2>
          <UP>نوٹ اس وقت استعمال ہوتے ہیں جب سامان کی نقل و حرکت کے بغیر فریق کا بیلنس ایڈجسٹ کرنا ہو — بل کے بعد طے شدہ رعایت، نقصان کا ازالہ، معمولی فرق یا رقم بٹے کھاتے ڈالنا۔ اگر سامان واقعی واپس آ رہا ہے تو واپسی استعمال کریں (سیکشن ۸ اور ۱۰)۔</UP>
          <UUl>
            <ULi><strong>کریڈٹ نوٹ</strong> — فروخت ← کریڈٹ نوٹ ← نیا۔ گاہک کے ذمے واجب رقم کم کرتا ہے۔</ULi>
            <ULi><strong>ڈیبٹ نوٹ</strong> — خریداری ← ڈیبٹ نوٹ ← نیا۔ سپلائر کو دینے والی رقم کم کرتا ہے۔</ULi>
          </UUl>
          <UP>دونوں فوراً لیجر میں درج ہوتے ہیں اور وصولیوں، ادائیگیوں اور ان کی بڑھاپا رپورٹوں میں شامل ہو جاتے ہیں۔</UP>

          <UH2 n="۱۵">ریفنڈ</UH2>
          <UP>ریفنڈ کاغذی ایڈجسٹمنٹ نہیں بلکہ اصل رقم کی واپسی ہے جس سے کریڈٹ بیلنس ختم ہوتا ہے۔</UP>
          <UUl>
            <ULi><strong>گاہک کو ریفنڈ</strong> — فروخت ← گاہک ← اس گاہک کا لیجر کھول کر <strong>ریفنڈ</strong> استعمال کریں۔ یہ اس وقت دستیاب ہوتا ہے جب گاہک کریڈٹ میں ہو، مثلاً ادا شدہ بل پر واپسی کے بعد۔</ULi>
            <ULi><strong>سپلائر سے ریفنڈ</strong> — خریداری ← سپلائر ← لیجر کھول کر <strong>سپلائر سے رقم وصول کریں</strong> استعمال کریں۔</ULi>
          </UUl>
          <UNote>ریفنڈ کے بعد فریق کے ذمے رقم دوبارہ بڑھ جاتی ہے، کیونکہ اس کے پاس موجود کریڈٹ ادا ہو چکا۔ فہرستیں اور بڑھاپا رپورٹیں دونوں اس کا حساب رکھتی ہیں۔</UNote>

          <UH2 n="۱۶">مؤخر تاریخ چیک (PDC)</UH2>
          <UP>مؤخر تاریخ چیک وہ چیک ہے جس پر آگے کی تاریخ درج ہو — یعنی ابھی رقم نہیں بلکہ ادائیگی کا وعدہ۔ تاجر ایسے چیک کو الگ حساب میں رکھتا ہے جب تک بینک اس پر عمل نہ کر لے، تاکہ آپ کی نقدی زیادہ ظاہر نہ ہو۔</UP>
          <UH3>چیک درج کرنا</UH3>
          <UStep n="۱">وصولی یا ادائیگی میں ایک ٹینڈر سطر شامل کریں اور اس کی قسم <strong>PDC</strong> منتخب کریں۔ ریفنڈ، ملازمین کے قرض اور مالک کے لین دین میں بھی PDC سطر دی جا سکتی ہے۔</UStep>
          <UStep n="۲"><strong>چیک نمبر</strong> اور <strong>مقررہ تاریخ</strong> دونوں لازمی ہیں — مقررہ تاریخ کے بغیر مؤخر چیک کی سطر محفوظ ہی نہیں ہوتی، اور بعد میں وصولی میں ترمیم سے یہ تاریخ کبھی مٹتی نہیں۔ کوئی پرانا چیک جس کی تاریخ نہ ہو، چیک رجسٹر میں نشان زد ہوتا ہے تاکہ درست کیا جا سکے۔</UStep>
          <UStep n="۳">بینک منتخب کریں اور محفوظ کریں۔ ایک ہی دستاویز میں نقد، آن لائن اور PDC سطریں ملائی جا سکتی ہیں۔</UStep>
          <UH3>حسابی اندراج</UH3>
          <UUl>
            <ULi>جو چیک آپ <strong>وصول</strong> کرتے ہیں وہ <strong>۱۱۱۲ وصول شدہ مؤخر چیک</strong> (اثاثہ) میں ڈیبٹ ہوتا ہے۔</ULi>
            <ULi>جو چیک آپ <strong>جاری</strong> کرتے ہیں وہ <strong>۲۱۱۵ جاری کردہ مؤخر چیک</strong> (واجب) میں کریڈٹ ہوتا ہے۔</ULi>
            <ULi>دونوں صورتوں میں گاہک یا سپلائر کا بیلنس اسی وقت طے ہو جاتا ہے، کیونکہ چیک ہاتھ بدل چکا ہے۔</ULi>
          </UUl>
          <UH3>چیک رجسٹر</UH3>
          <UP>رپورٹیں ← چیک رجسٹر میں ہر چیک اپنی مقررہ تاریخ، فریق، رقم اور حالت کے ساتھ نظر آتا ہے — قریب ترین تاریخ پہلے، اور زائد المیعاد چیک نمایاں۔ چیک یہیں سے نمٹائے جاتے ہیں۔</UP>
          <UUl>
            <ULi><strong>زیر التواء</strong> — بینک کے پاس ہے، ابھی پیش نہیں ہوا۔</ULi>
            <ULi><strong>کلیئر</strong> — رقم منتقل ہو گئی۔ رقم ۱۱۱۲ یا ۲۱۱۵ اور آپ کے بینک کے درمیان منتقل ہوتی ہے۔ فریق کا بیلنس نہیں بدلتا، کیونکہ وہ چیک لیتے وقت ہی طے ہو چکا تھا۔</ULi>
            <ULi><strong>باؤنس</strong> — چیک ناکام ہو گیا، اس لیے رقم دوبارہ فریق کے بیلنس پر آ جاتی ہے: وہ دوبارہ آپ کے مقروض ہو جاتے ہیں، یا آپ ان کے۔</ULi>
            <ULi><strong>منتقل شدہ</strong> — گاہک سے ملا چیک بینک میں جمع کرانے کے بجائے سپلائر کو آگے دے دیا گیا۔ اصل چیک ختم ہو جاتا ہے تاکہ وہ دوبارہ آپ کے کھاتے میں کلیئر نہ ہو سکے، مگر باؤنس پھر بھی ہو سکتا ہے۔</ULi>
          </UUl>
          <UH3>تاجر شروع کرنے سے پہلے کے چیک</UH3>
          <UP>جو چیک تاجر استعمال کرنے سے پہلے ہی باقی تھے، انہیں سیٹ اپ ← ابتدائی بیلنس ← مؤخر تاریخ چیک پر درج کریں — ہر چیک کی الگ سطر بمع نمبر، رقم، مقررہ تاریخ اور فریق۔ اس کے بعد وہ عام چیک کی طرح کلیئر، باؤنس یا منتقل کیے جا سکتے ہیں۔</UP>
          <UNote>فریق کا اپنا ابتدائی بیلنس ان چیکوں کو <strong>منہا کر کے</strong> درج کریں، ورنہ وہی رقم دو بار شمار ہوگی۔</UNote>

          <UH2 n="۱۷">ملازمین کے قرض اور ایڈوانس</UH2>
          <UP>ملازم کو دی گئی رقم خرچ نہیں بلکہ واپس ملنے والی رقم ہے۔ تاجر اسے <strong>۱۱۳۵ ملازمین کے قرض و ایڈوانس</strong> میں رکھتا ہے یہاں تک کہ وصول ہو جائے، اس لیے یہ نفع کم کرنے کے بجائے بیلنس شیٹ میں اثاثہ رہتی ہے۔</UP>
          <UH3>ملازم شامل کرنا</UH3>
          <UP>رقم ← ملازمین ← ملازم شامل کریں پر جا کر نام اور تفصیلات درج کریں۔</UP>
          <UH3>قرض یا ایڈوانس دینا</UH3>
          <UStep n="۱">ملازم کھولیں اور <strong>قرض / ایڈوانس دیں</strong> منتخب کریں۔</UStep>
          <UStep n="۲">رقم، تاریخ اور کرنسی درج کریں — ڈالر کی صورت میں ایکسچینج ریٹ بھی۔</UStep>
          <UStep n="۳">اگر واپسی قسطوں میں ہے تو <strong>اقساط</strong> اور <strong>پہلی مقررہ تاریخ</strong> مقرر کریں، اور ضرورت ہو تو نوٹ لکھیں۔</UStep>
          <UStep n="۴">رقم کس ذریعے جا رہی ہے — نقد، بینک یا PDC چیک — ٹینڈر سطروں میں منتخب کر کے محفوظ کریں۔</UStep>
          <UNote>تنخواہ کے عوض ایڈوانس اور قرض کا اندراج بالکل ایک ہی طرح ہوتا ہے — فرق صرف اقساط مقرر کرنے کا ہے۔</UNote>
          <UH3>وصولی</UH3>
          <UUl>
            <ULi><strong>ادائیگی درج کریں</strong> — ملازم نقد یا بینک کے ذریعے رقم واپس کرے۔</ULi>
            <ULi><strong>تنخواہ سے کٹوتی</strong> — رقم اس کی تنخواہ میں سے کاٹ لی جائے۔</ULi>
          </UUl>
          <UH3>نگرانی</UH3>
          <UP>رقم ← قرضے میں ہر قرض کی اصل رقم، ہر ملازم کی باقی رقم اور اقساط کا شیڈول نظر آتا ہے۔</UP>

          <UH2 n="۱۸">قیمت تعین</UH2>
          <UP>ہر گاہک کے لیے فی آئٹم طے شدہ فروخت قیمتیں فروخت ← قیمت تعین پر ترتیب دیں۔ اس گاہک کی فروخت بناتے وقت طے شدہ ریٹ خودبخود آ جاتا ہے، جسے آپ سطر میں تبدیل بھی کر سکتے ہیں۔</UP>

          <UH2 n="۱۹">اخراجات</UH2>
          <UP>کاروباری اخراجات (کرایہ، تنخواہ، بجلی، گیس، ٹرانسپورٹ وغیرہ) رقم ← اخراجات ← نیا اخراج پر ریکارڈ کریں۔</UP>
          <UUl>
            <ULi>اخراجات کا حساب (چارٹ آف اکاؤنٹس سے) منتخب کریں۔</ULi>
            <ULi>رقم، تاریخ، تفصیل اور ادائیگی کا ذریعہ درج کریں۔</ULi>
            <ULi>اخراجات نفع و نقصان رپورٹ میں ظاہر ہوتے ہیں اور خالص منافع پر اثر ڈالتے ہیں۔</ULi>
          </UUl>

          <UH2 n="۲۰">مالکان — سرمایہ اور برداشت</UH2>
          <UP>اگر کاروبار کے ایک یا زیادہ مالک یا شراکت دار ہیں تو انہیں سیٹ اپ ← مالکان پر درج کریں تاکہ ان کی رقم کاروبار کی اپنی رقم سے الگ ٹریک ہو۔</UP>
          <UUl>
            <ULi><strong>سرمایہ کاری</strong> — مالک رقم ڈالتا ہے، اس کا سرمایہ بڑھتا ہے۔</ULi>
            <ULi><strong>برداشت</strong> — مالک رقم نکالتا ہے، جو <strong>۳۴۰۰ مالک کی برداشت</strong> میں درج ہوتی ہے۔</ULi>
          </UUl>
          <UP>ہر لین دین کے ساتھ مالک کا نام محفوظ ہوتا ہے، اس لیے سرمایہ اور برداشت ہر شراکت دار کے حساب سے رپورٹ ہو سکتے ہیں۔ رقم نقد، بینک یا مؤخر چیک کے ذریعے آ جا سکتی ہے۔</UP>
          <UH3>منافع کی تقسیم</UH3>
          <UP>ہر مالک کا <strong>منافع میں حصہ ٪</strong> درج ہوتا ہے۔ سیٹ اپ ← مالکان ← منافع کی تقسیم پر مدت چنیں تو تاجر اس مدت کا خالص منافع اور حصوں کے مطابق اس کی تقسیم دکھاتا ہے؛ تصدیق کرنے پر وہ منافع <strong>۳۲۰۰ محفوظ منافع</strong> سے نکل کر ہر شراکت دار کے سرمائے میں چلا جاتا ہے۔ نقصان الٹی سمت جاتا ہے۔ جب تک مدت بند نہ ہو، تقسیم دوبارہ کھولی یا حذف کی جا سکتی ہے۔</UP>
          <UNote>شراکت دار شامل ہوتے رہیں تو حصوں کا مجموعہ ۱۰۰٪ نہ ہونا ٹھیک ہے، مگر تقسیم تبھی کریں جب ہو جائے — ورنہ منافع کا کچھ حصہ کسی کو نہیں ملتا۔</UNote>

          <UH2 n="۲۱">ایجنٹ اور کمیشن</UH2>
          <UP>ایجنٹ (آڑھتی / بروکر) دونوں طرف سودا لاتا ہے اور اس پر کمیشن پاتا ہے۔ تاجر ایجنٹ کو الگ فریق مانتا ہے — نہ گاہک نہ سپلائر — جس کا اپنا لیجر ہوتا ہے: کمیشن جو بنا اور جو ادا ہوا۔</UP>
          <UH3>ایجنٹ کا اندراج</UH3>
          <UP>رقم ← ایجنٹ ← Enrol Agent پر جائیں (یا سیٹ اپ وزرڈ کے &rdquo;مالکان اور عملہ&ldquo; مرحلے سے)۔ نام اور رابطے کے علاوہ فروخت اور خریداری کا کمیشن الگ الگ طے کریں، کیونکہ ایک ہی بروکر کو اکثر دونوں طرف مختلف بنیاد پر ادائیگی ہوتی ہے:</UP>
          <UUl>
            <ULi><strong>بل کی مالیت کا ٪</strong> — مثلاً فروخت کا ۱٪۔</ULi>
            <ULi><strong>فی یونٹ</strong> — فی کلو، بوری یا پیس ایک مقررہ رقم۔</ULi>
            <ULi><strong>فی بل مقررہ</strong> — بل چھوٹا ہو یا بڑا، ایک ہی رقم۔</ULi>
            <ULi><strong>کچھ نہیں</strong> — درج ہے مگر اس طرف کمیشن نہیں۔</ULi>
          </UUl>
          <UP><strong>ابتدائی بیلنس</strong> وہ کمیشن ہے جو شروع کے دن پہلے ہی اس کا واجب تھا، اور اس کے لیجر کی پہلی سطر بنتا ہے۔</UP>
          <UH3>بل پر کمیشن</UH3>
          <UP>فروخت یا خریداری کے بل پر <strong>ایجنٹ</strong> چنیں۔ اس کا طے شدہ ریٹ خود بھر جاتا ہے اور لکھتے لکھتے کمیشن دکھتا رہتا ہے؛ اس ایک بل کے لیے ریٹ بدلا جا سکتا ہے۔ محفوظ کرنے پر تاجر یہ رقم بل کے اپنے جرنل اندراج پر چڑھا دیتا ہے — آپ کے لیے خرچ، ایجنٹ کے لیے واجب الادا۔ مال بعد میں واپس ہو تو کمیشن کا اتنا حصہ واپسی پر خودبخود کٹ جاتا ہے، اسی ریٹ پر جو اصل بل پر تھا۔</UP>
          <UH3>ایجنٹ کو ادائیگی</UH3>
          <UP>ایجنٹ کے لیجر سے <strong>Record Payment</strong> کے ذریعے ادائیگی درج کریں — نقد، آن لائن یا مؤخر چیک، کسی بھی ادائیگی کی طرح۔ لیجر ہر بل، اس کا کمیشن، ہر ادائیگی اور باقی واجب رقم دکھاتا ہے۔</UP>

          <UH2 n="۲۲">حسابات کا چارٹ</UH2>
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
          <UP>رقم ← اکاؤنٹس ← اکاؤنٹ شامل کریں پر جائیں اور کوڈ، نام اور قسم درج کریں۔</UP>
          <UH3>اکاؤنٹ کا ابتدائی بیلنس</UH3>
          <UP>ہر اکاؤنٹ کا ابتدائی بیلنس اسی صفحے پر اس کی سطر سے مقرر کیا جا سکتا ہے۔ یہ ایک تاریخ شدہ جرنل اندراج کے طور پر <strong>۳۳۰۰ ابتدائی بیلنس ایکوئٹی</strong> کے مقابل درج ہوتا ہے، تاکہ ٹرائل بیلنس اور بیلنس شیٹ برابر رہیں۔ دوبارہ درج کرنے پر پرانی رقم بدل جاتی ہے، جمع نہیں ہوتی۔</UP>
          <UNote>گاہک اور سپلائر کے ابتدائی بیلنس (سیکشن ۲۵) فریق کے ذیلی کھاتے میں جاتے ہیں۔ بیلنس شیٹ درست رکھنے کے لیے یہاں <strong>۱۱۳۰ وصولیاں</strong> اور <strong>۲۱۱۰ ادائیگیاں</strong> کا ابتدائی بیلنس بھی مقرر کریں۔</UNote>
          <UH3>سی ایس وی اپلوڈ</UH3>
          <UP>اکاؤنٹس کثیر تعداد میں شامل کرنے کے لیے ایک CSV فائل تیار کریں جس میں <code>code, name, type</code> کالمز ہوں اور اکاؤنٹس صفحے پر اپلوڈ کریں۔</UP>

          <UH2 n="۲۳">واؤچر</UH2>
          <UP>واؤچر دستی جرنل اندراجات ہیں جو خریداری، فروخت یا وصولیوں سے ہٹ کر حسابی ایڈجسٹمنٹ کے لیے استعمال ہوتے ہیں۔</UP>
          <UStep n="۱">رقم ← واؤچر ← نیا واؤچر پر جائیں۔</UStep>
          <UStep n="۲">ڈیبٹ اور کریڈٹ سطریں شامل کریں — ہر سطر میں حساب اور رقم۔</UStep>
          <UStep n="۳">کل ڈیبٹ = کل کریڈٹ ہونا ضروری ہے۔ سسٹم یہ قانون نافذ کرتا ہے۔</UStep>
          <UStep n="۴">محفوظ کریں۔ واؤچر فوری طور پر جنرل لیجر میں درج ہو جاتا ہے۔</UStep>

          <UH2 n="۲۴">رپورٹیں</UH2>
          <UP>تمام رپورٹیں رپورٹیں ← تمام رپورٹیں سے دستیاب ہیں۔ ہر رپورٹ پر تاریخ کے فلٹر موجود ہیں، ہر رپورٹ پرنٹ یا پی ڈی ایف میں محفوظ کی جا سکتی ہے، اور اکثر ایکسل میں ایکسپورٹ بھی ہو سکتی ہیں۔</UP>
          <UReportTable rows={UR_REPORTS} />
          <UNote>رپورٹوں میں لاگت کے اعداد و شمار (COGS) ہر آئٹم کی <em>آخری خرید قیمت</em> کی بنیاد پر ہیں۔ ابتدائی بیلنس والے اسٹاک کے لیے ابتدائی ریٹ استعمال ہوتا ہے۔</UNote>

          <UH2 n="۲۵">سیٹ اپ اور ترتیبات</UH2>
          <UP><strong>سیٹ اپ</strong> گروپ صرف مالک کو نظر آتا ہے۔</UP>
          <UH3>سیٹ اپ وزرڈ</UH3>
          <UP>سیٹ اپ ← سیٹ اپ وزرڈ ہر اس بنیادی ریکارڈ سے گزارتا ہے جس پر لین دین کا دارومدار ہے — کاروباری پروفائل، حسابات کا چارٹ، اقسام، گودام، آئٹمز، گاہک، سپلائر، بینک، پھر اختیاری مالکان، عملہ، ایجنٹ اور ٹیم لاگ ان — اسی ترتیب سے جس میں ان کی ضرورت پڑتی ہے۔ یہ دکھاتا ہے کہ پہلے سے کیا موجود ہے، کئی سطریں ایک ساتھ لیتا ہے، اور آخر میں چیک لسٹ اور ابتدائی بیلنس کا راستہ دیتا ہے۔ سیکشن ۲ میں ہر مرحلے کی تفصیل ہے؛ نیچے کے صفحات وہی ڈیٹا ایک ایک کر کے ہیں۔</UP>
          <UH3>کاروباری پروفائل</UH3>
          <UP>سیٹ اپ ← کاروبار پر اپنے کاروبار کا نام، پتہ اور این ٹی این درج کریں۔ یہ چھپے ہوئے بلوں اور واؤچروں پر ظاہر ہوتے ہیں۔</UP>
          <UH3>ماڈیولز</UH3>
          <UP>سیٹ اپ ← ماڈیولز سے خصوصیات آن یا آف کریں۔ بند ماڈیول سب کے مینو سے غائب ہو جاتا ہے — اگر آپ گیٹ پاس، قیمت تعین یا قرض استعمال نہیں کرتے تو ایپ کو سادہ رکھنے کا اچھا طریقہ ہے۔</UP>
          <UH3>ابتدائی بیلنس</UH3>
          <UP>سیٹ اپ ← ابتدائی بیلنس وہ جگہ ہے جہاں آپ اپنا موجودہ کاروبار کھاتوں میں لاتے ہیں۔ اس کے چار حصے ہیں:</UP>
          <UUl>
            <ULi><strong>اسٹاک کی مقدار</strong> — ہر آئٹم کی مقدار، لاگت ریٹ اور مقام۔</ULi>
            <ULi><strong>گاہکوں کا ابتدائی بیلنس</strong> — ہر گاہک کے ذمے پہلے سے واجب رقم۔ اگر اس نے ایڈوانس دیا ہوا ہے تو منفی درج کریں۔</ULi>
            <ULi><strong>سپلائرز کا ابتدائی بیلنس</strong> — ہر سپلائر کو دینے والی رقم۔ ایڈوانس دیا ہو تو منفی۔</ULi>
            <ULi><strong>مؤخر تاریخ چیک</strong> — ہر اس چیک کی الگ سطر جو پہلے سے آپ کے پاس ہے یا آپ نے جاری کیا ہے، بمع نمبر، رقم اور مقررہ تاریخ۔</ULi>
          </UUl>
          <UNote>فریق کا ابتدائی بیلنس اس کے چیکوں کو <strong>منہا کر کے</strong> درج کریں، ورنہ وہی رقم دو بار شمار ہوگی۔</UNote>
          <UH3>آئٹم اقسام</UH3>
          <UP>اسٹاک آئٹمز کے لیے زمرے۔ سیٹ اپ ← آئٹم اقسام پر شامل، نام تبدیل یا حذف کریں۔</UP>
          <UH3>ٹیم انتظام</UH3>
          <UP>ٹیم کے اراکین کو سیٹ اپ ← ٹیم ← رکن مدعو کریں پر مدعو کریں۔</UP>
          <UUl>
            <ULi><strong>مالک</strong> — تمام خصوصیات اور ترتیبات تک مکمل رسائی۔</ULi>
            <ULi><strong>اسسٹنٹ</strong> — خریداری، فروخت، گیٹ پاس وغیرہ کر سکتا ہے لیکن سیٹ اپ، فروخت واپسی یا دوسرے صارفین کے ریکارڈ نہیں کھول سکتا۔ طے شدہ طور پر اسسٹنٹ کو صرف لین دین کے ماڈیول نظر آتے ہیں — فروخت، خریداری، واپسی، وصولی، ادائیگی، اسٹاک، گیٹ پاس، ملازمین اور قرض — اور مالک ٹیم کے صفحے سے طے کرتا ہے کہ ہر اسسٹنٹ کو کون سے ماڈیول ملیں۔</ULi>
          </UUl>
          <UH3>بینک</UH3>
          <UP>بینک اکاؤنٹس سیٹ اپ ← بینک پر شامل کریں۔ یہ کیش بک، بینک اسٹیٹمنٹ اور چارٹ آف اکاؤنٹس میں ظاہر ہوتے ہیں۔ ہر بینک کا اپنا ابتدائی بیلنس بھی ہوتا ہے جو بینک اسٹیٹمنٹ رپورٹ کی بنیاد بنتا ہے۔</UP>
          <UH3>کھاتے بند کرنا</UH3>
          <UP>مکمل ہو چکی مدت سیٹ اپ ← کھاتے بند کریں پر مقفل کریں۔ اس تاریخ یا اس سے پہلے کا کوئی اندراج نہ بن سکتا ہے، نہ بدل سکتا ہے، نہ حذف — فروخت، خریداری، وصولی، ادائیگی، واپسی، نوٹ اور واؤچر سب شامل۔ بعد کی تاریخوں پر کام معمول کے مطابق چلتا رہتا ہے۔ یہ اصول ڈیٹابیس میں ہے، اس لیے موبائل ایپ سمیت ہر جگہ لاگو ہوتا ہے۔</UP>
          <UH3>آڈٹ لاگ</UH3>
          <UP>سسٹم میں ہر تبدیلی سیٹ اپ ← آڈٹ لاگ پر ریکارڈ ہوتی ہے — تاریخ، صارف، عمل اور تبدیل شدہ ڈیٹا کے ساتھ۔ غلطیاں تلاش کرنے کے لیے بہت مفید ہے۔</UP>
          <UH3>ڈیمو پلے گراؤنڈ</UH3>
          <UP>سیٹ اپ ← ڈیمو پلے گراؤنڈ نمونے کا ڈیٹا بناتا ہے تاکہ آپ خصوصیات محفوظ طریقے سے آزما سکیں، اور ایک کلک سے اسے ہٹا بھی دیتا ہے۔ عملے کی تربیت کے لیے مفید ہے۔</UP>

          <UH2 n="۲۶">معاونت</UH2>
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

'use client'

import { useState } from 'react'
import { BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

type QA = { q: string; a: string }

/* ─── English Q&A — Reports & Accounting ──────────── */
const EN: QA[] = [
  { q: 'Does Tajir do accounting automatically?',
    a: 'Yes. Every sale, purchase, receipt, payment and refund automatically posts a double-entry journal entry to your books — you don’t have to record entries by hand.' },
  { q: 'What is the Chart of Accounts?',
    a: 'The list of accounts your business uses (cash, bank, receivables, payables, sales, cost of sales, expenses, equity…). Set it up under Accounts before posting.' },
  { q: 'What is a voucher number?',
    a: 'A reference on each posted journal entry (e.g. RC-2026-0001), grouped by type — receipt, payment, refund and so on.' },
  { q: 'What is the difference between Profit & Loss and Balance Sheet?',
    a: 'Profit & Loss shows income and expenses over a period and the net profit. The Balance Sheet shows assets, liabilities and equity at a single point in time.' },
  { q: 'What is the Trial Balance?',
    a: 'A list of every account balance that verifies total debits equal total credits — a quick health check on your books.' },
  { q: 'What is the General Ledger report?',
    a: 'The full double-entry ledger with a running balance per account, filterable by date range and account.' },
  { q: 'How do I see cash movement for a single day?',
    a: 'Use the Daily Cashbook — cash in, cash out and the closing balance across your cash and bank accounts, with opening and closing figures.' },
  { q: 'What is the Bank Statement report?',
    a: 'All deposits, withdrawals and a running balance for one selected bank account over a date range. Printable.' },
  { q: 'What are Receivables and Payables Aging?',
    a: 'Outstanding customer (receivables) and supplier (payables) balances bucketed by 0–30, 31–60, 61–90 and 90+ days, so you can chase overdue amounts.' },
  { q: 'How do I record opening balances?',
    a: 'Go to Accounts → Opening Balances to set the starting balances for GL accounts, customers and suppliers when you begin using Tajir.' },
  { q: 'What is the Consolidated Ledger?',
    a: 'For a party that is both a customer and a supplier, it shows one net statement that combines their receivable and payable sides.' },
  { q: 'What money accounts does Tajir use?',
    a: 'Cash in Hand, Cash at Bank, and Post-dated Cheques (PDC). Receipts and payments post to whichever you choose.' },
  { q: 'Can I print or export reports?',
    a: 'Yes — most reports have Print and Export buttons so you can save or share them.' },
  { q: 'What do Customer and Item Profit & Loss show?',
    a: 'Gross profit per customer or per item, comparing the sale value against the purchase cost.' },
]

/* ─── Urdu Q&A (RTL) — رپورٹس اور اکاؤنٹنگ ──────────── */
const UR: QA[] = [
  { q: 'کیا تاجر خودکار اکاؤنٹنگ کرتا ہے؟',
    a: 'جی ہاں۔ ہر فروخت، خریداری، وصولی، ادائیگی اور ریفنڈ خودکار طور پر دہرا اندراج (double-entry) جرنل میں پوسٹ ہو جاتی ہے — اندراج ہاتھ سے کرنے کی ضرورت نہیں۔' },
  { q: 'چارٹ آف اکاؤنٹس (Chart of Accounts) کیا ہے؟',
    a: 'ان حسابات کی فہرست جو آپ کا کاروبار استعمال کرتا ہے (نقد، بینک، وصولیاں، واجبات، فروخت، لاگت، اخراجات، ایکوئٹی…)۔ پوسٹنگ سے پہلے Accounts میں ترتیب دیں۔' },
  { q: 'واؤچر نمبر کیا ہے؟',
    a: 'ہر پوسٹ شدہ جرنل اندراج پر حوالہ (مثلاً RC-2026-0001)، قسم کے مطابق — رسید، ادائیگی، ریفنڈ وغیرہ۔' },
  { q: 'Profit & Loss اور Balance Sheet میں کیا فرق ہے؟',
    a: 'Profit & Loss ایک مدت کی آمدنی، اخراجات اور خالص نفع دکھاتی ہے۔ Balance Sheet کسی ایک لمحے کے اثاثے، واجبات اور ایکوئٹی دکھاتی ہے۔' },
  { q: 'Trial Balance کیا ہے؟',
    a: 'تمام حسابات کے بیلنس کی فہرست جو تصدیق کرتی ہے کہ کل ڈیبٹ = کل کریڈٹ — کھاتوں کی فوری جانچ۔' },
  { q: 'General Ledger رپورٹ کیا ہے؟',
    a: 'ہر حساب کا مکمل دہرا اندراج لیجر بمع رننگ بیلنس، تاریخ اور اکاؤنٹ کے فلٹر کے ساتھ۔' },
  { q: 'ایک دن کی نقدی حرکت کہاں دیکھوں؟',
    a: 'Daily Cashbook استعمال کریں — نقد آمد، نقد اخراج اور اختتامی بیلنس (نقد و بینک)، بمع ابتدائی و اختتامی رقم۔' },
  { q: 'Bank Statement رپورٹ کیا ہے؟',
    a: 'منتخب بینک اکاؤنٹ کی تمام جمع، اخراج اور رننگ بیلنس، مقررہ مدت کے لیے۔ پرنٹ ہو سکتی ہے۔' },
  { q: 'Receivables اور Payables Aging کیا ہیں؟',
    a: 'گاہک (وصولیاں) اور سپلائر (واجبات) کے بقایا بیلنس ۰–۳۰، ۳۱–۶۰، ۶۱–۹۰ اور ۹۰+ دن کے حساب سے، تاکہ زائد المیعاد رقم کا تعاقب ہو سکے۔' },
  { q: 'ابتدائی بیلنس کیسے درج کروں؟',
    a: 'Accounts → Opening Balances میں جا کر حسابات، گاہکوں اور سپلائرز کے ابتدائی بیلنس مقرر کریں (جب آپ تاجر استعمال شروع کریں)۔' },
  { q: 'Consolidated Ledger کیا ہے؟',
    a: 'جو فریق بیک وقت گاہک اور سپلائر ہو، اس کا ایک مشترکہ بیان جو اس کی وصولی اور واجبات دونوں کو ملا دیتا ہے۔' },
  { q: 'تاجر کون سے منی اکاؤنٹس استعمال کرتا ہے؟',
    a: 'Cash in Hand، Cash at Bank، اور Post-dated Cheques (PDC)۔ وصولیاں اور ادائیگیاں آپ کے منتخب کردہ اکاؤنٹ میں پوسٹ ہوتی ہیں۔' },
  { q: 'کیا میں رپورٹس پرنٹ یا ایکسپورٹ کر سکتا ہوں؟',
    a: 'جی ہاں — اکثر رپورٹس میں Print اور Export کے بٹن موجود ہیں تاکہ آپ انہیں محفوظ یا شیئر کر سکیں۔' },
  { q: 'Customer اور Item Profit & Loss کیا دکھاتی ہیں؟',
    a: 'فی گاہک یا فی آئٹم مجموعی نفع، فروخت کی قیمت کا خرید لاگت سے موازنہ۔' },
]

export function ReportsGuide() {
  const [lang, setLang] = useState<'en' | 'ur'>('en')
  const items = lang === 'en' ? EN : UR
  const rtl = lang === 'ur'

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="min-h-[44px]">
          <BookOpen className="h-4 w-4 mr-2" />
          User Guide
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&display=swap');
          .urdu-guide { font-family: 'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', 'Nafees Web Naskh', serif; line-height: 2.1; }
        `}</style>

        <SheetHeader>
          <SheetTitle>Reports &amp; Accounting — Guide</SheetTitle>
          <SheetDescription>
            Common questions about reports and accounting. / رپورٹس اور اکاؤنٹنگ کے بارے میں عام سوالات۔
          </SheetDescription>
        </SheetHeader>

        {/* Language switcher */}
        <div className="mt-4 flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
          <button
            onClick={() => setLang('en')}
            className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${lang === 'en' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            English
          </button>
          <button
            onClick={() => setLang('ur')}
            className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${lang === 'ur' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            اردو
          </button>
        </div>

        <div dir={rtl ? 'rtl' : 'ltr'} className={`mt-5 space-y-4 ${rtl ? 'urdu-guide text-right' : ''}`}>
          {items.map((it, i) => (
            <div key={i} className="border-b border-border pb-3 last:border-0">
              <p className="font-bold text-sm text-foreground mb-1 flex items-start gap-2">
                <span className="shrink-0 h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-extrabold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <span>{it.q}</span>
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">{it.a}</p>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}

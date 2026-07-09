'use client'

import { useState } from 'react'
import { BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

type QA = { q: string; a: string }

/* ─── English Q&A — Sales & Customers ─────────────── */
const EN: QA[] = [
  { q: 'How do I add a new customer?',
    a: 'On the Customers page click “Add Customer”, enter the name (and an optional opening balance), then save.' },
  { q: 'What is an opening balance?',
    a: 'The amount a customer already owed you before you started using Tajir. Enter it when creating the customer — it becomes the starting point of their ledger.' },
  { q: 'What does “Outstanding” mean on the customer list?',
    a: 'The net amount the customer currently owes you: opening balance + sales − receipts − sale returns − credit notes + refunds. Amber means they owe you; a green credit balance means you owe them.' },
  { q: 'How do I see a customer’s full transaction history?',
    a: 'Click “Ledger” next to the customer. It lists every sale, receipt, return, credit note and refund with a running balance, and you can Print or Export it.' },
  { q: 'How do I record a payment received from a customer?',
    a: 'Open the customer’s Ledger and click “Record Receipt” (or use the Receipts page). Enter the amount, date and where the money was received — Cash, Bank, or Post-dated Cheque.' },
  { q: 'What is the “Received in” / money account?',
    a: 'Where the money landed — Cash in Hand, Cash at Bank, or Post-dated Cheques (PDC). It decides which account is debited in your books.' },
  { q: 'What is the serial number on a receipt or voucher?',
    a: 'An automatic reference assigned when you save (e.g. RCP-2026-0001). Receipts, payments, refunds and invoices each have their own yearly sequence.' },
  { q: 'How do I create a sales invoice?',
    a: 'Go to Sales → New Sale, pick the customer and the items with quantity and rate, then save. Each invoice gets a serial like SI-2026-0001.' },
  { q: 'Can I edit or delete a sales invoice?',
    a: 'Yes. Open the invoice to edit its lines, or delete it (owner only). Deleting reverses the related stock and ledger entries.' },
  { q: 'What is a sale return?',
    a: 'When a customer returns goods. Record it under Sale Returns — it reduces what they owe and puts the stock back into inventory.' },
  { q: 'What is the difference between a sale return and a credit note?',
    a: 'A sale return brings goods back into stock. A credit note reduces the customer’s balance without any stock movement — for example a price adjustment or discount.' },
  { q: 'A customer paid more than they owed — what happens?',
    a: 'Their balance becomes a Credit Balance (shown in green), meaning you owe them. You can hold it against future sales or pay it back with a refund.' },
  { q: 'How do I refund a customer?',
    a: 'When a customer is in credit, open their Ledger and click “Issue Refund” (owner only). Enter the amount and method (Cash/Bank). It reduces their credit and records the payout with a serial like REF-2026-0001.' },
  { q: 'Which reports help me track customers?',
    a: 'Receivables Aging (who owes what, by 0–30 / 31–60 / 61–90 / 90+ days), Customer Profit & Loss (profit per customer), and each customer’s Ledger.' },
  { q: 'Can I print or share a customer’s statement?',
    a: 'Yes — open the customer’s Ledger and use Print, or Export to download it.' },
  { q: 'Do I need to add a customer as a supplier too?',
    a: 'No. If you pick a customer in a purchase or payment, Tajir mirrors them automatically, so you never create duplicate parties.' },
]

/* ─── Urdu Q&A (RTL) — سیلز اور گاہک ────────────────── */
const UR: QA[] = [
  { q: 'نیا گاہک کیسے شامل کروں؟',
    a: 'گاہک صفحہ پر “Add Customer” پر کلک کریں، نام (اور چاہیں تو ابتدائی بیلنس) درج کریں اور محفوظ کریں۔' },
  { q: 'ابتدائی بیلنس (Opening Balance) کیا ہے؟',
    a: 'وہ رقم جو گاہک پر تاجر استعمال کرنے سے پہلے واجب الادا تھی۔ گاہک بناتے وقت درج کریں — یہ اس کے لیجر کا نقطۂ آغاز بن جاتی ہے۔' },
  { q: 'فہرست میں “Outstanding” کا کیا مطلب ہے؟',
    a: 'گاہک پر اس وقت واجب کل رقم: ابتدائی بیلنس + فروخت − وصولیاں − سیل ریٹرن − کریڈٹ نوٹ + ریفنڈ۔ کہربائی (amber) رنگ = گاہک کے ذمے رقم؛ سبز کریڈٹ بیلنس = آپ کے ذمے رقم۔' },
  { q: 'گاہک کی مکمل لین دین کی تفصیل کہاں دیکھوں؟',
    a: 'گاہک کے سامنے “Ledger” پر کلک کریں۔ اس میں ہر فروخت، وصولی، واپسی، کریڈٹ نوٹ اور ریفنڈ بمع رننگ بیلنس نظر آتا ہے، اور آپ Print یا Export کر سکتے ہیں۔' },
  { q: 'گاہک سے موصول رقم کیسے درج کروں؟',
    a: 'گاہک کا Ledger کھولیں اور “Record Receipt” پر کلک کریں (یا Receipts صفحہ استعمال کریں)۔ رقم، تاریخ اور رقم کہاں موصول ہوئی (نقد، بینک یا PDC) درج کریں۔' },
  { q: '“Received in” یا منی اکاؤنٹ کیا ہے؟',
    a: 'رقم کہاں آئی — نقد (Cash in Hand)، بینک (Cash at Bank)، یا پوسٹ ڈیٹڈ چیک (PDC)۔ اس سے طے ہوتا ہے کہ کھاتوں میں کون سا اکاؤنٹ ڈیبٹ ہوگا۔' },
  { q: 'رسید یا واؤچر پر سیریل نمبر کیا ہے؟',
    a: 'محفوظ کرتے وقت خودکار طور پر ملنے والا حوالہ نمبر (مثلاً RCP-2026-0001)۔ رسید، ادائیگی، ریفنڈ اور انوائس سب کا اپنا سالانہ سلسلہ ہوتا ہے۔' },
  { q: 'فروخت کا انوائس کیسے بناؤں؟',
    a: 'Sales → New Sale پر جائیں، گاہک اور آئٹمز کو مقدار اور ریٹ کے ساتھ منتخب کریں، پھر محفوظ کریں۔ ہر انوائس کو SI-2026-0001 جیسا سیریل ملتا ہے۔' },
  { q: 'کیا میں انوائس میں ترمیم یا حذف کر سکتا ہوں؟',
    a: 'جی ہاں۔ انوائس کھول کر اس کی لائنیں تبدیل کریں، یا حذف کریں (صرف مالک)۔ حذف کرنے پر متعلقہ اسٹاک اور لیجر کے اندراج واپس ہو جاتے ہیں۔' },
  { q: 'سیل ریٹرن (Sale Return) کیا ہے؟',
    a: 'جب گاہک مال واپس کرے۔ اسے Sale Returns میں درج کریں — اس سے گاہک کا واجب کم ہوتا ہے اور اسٹاک دوبارہ انوینٹری میں آ جاتا ہے۔' },
  { q: 'سیل ریٹرن اور کریڈٹ نوٹ میں کیا فرق ہے؟',
    a: 'سیل ریٹرن مال کو دوبارہ اسٹاک میں لاتا ہے۔ کریڈٹ نوٹ بغیر کسی اسٹاک حرکت کے گاہک کا بیلنس کم کرتا ہے — مثلاً قیمت میں رعایت یا ڈسکاؤنٹ۔' },
  { q: 'گاہک نے واجب سے زیادہ رقم ادا کر دی — کیا ہوتا ہے؟',
    a: 'اس کا بیلنس کریڈٹ بیلنس بن جاتا ہے (سبز رنگ)، یعنی رقم آپ کے ذمے ہے۔ آپ اسے آئندہ فروخت کے مقابل رکھ سکتے ہیں یا ریفنڈ کے ذریعے واپس کر سکتے ہیں۔' },
  { q: 'گاہک کو ریفنڈ کیسے دوں؟',
    a: 'جب گاہک کریڈٹ میں ہو تو اس کا Ledger کھول کر “Issue Refund” پر کلک کریں (صرف مالک)۔ رقم اور طریقہ (نقد/بینک) درج کریں۔ اس سے کریڈٹ کم ہوتا ہے اور ادائیگی REF-2026-0001 جیسے سیریل کے ساتھ درج ہوتی ہے۔' },
  { q: 'گاہکوں کی نگرانی کے لیے کون سی رپورٹس مددگار ہیں؟',
    a: 'Receivables Aging (کس پر کتنا واجب، ۰–۳۰ / ۳۱–۶۰ / ۶۱–۹۰ / ۹۰+ دن)، Customer Profit & Loss (فی گاہک نفع)، اور ہر گاہک کا Ledger۔' },
  { q: 'کیا میں گاہک کا اسٹیٹمنٹ پرنٹ یا شیئر کر سکتا ہوں؟',
    a: 'جی ہاں — گاہک کا Ledger کھول کر Print کریں، یا Export سے ڈاؤن لوڈ کریں۔' },
  { q: 'کیا گاہک کو سپلائر کے طور پر الگ سے شامل کرنا ہوگا؟',
    a: 'نہیں۔ اگر آپ خریداری یا ادائیگی میں گاہک منتخب کریں تو تاجر خودکار طور پر انہیں مِرر کر دیتا ہے، اس لیے نقل (duplicate) نہیں بنتی۔' },
]

export function CustomerGuide() {
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
          <SheetTitle>Sales &amp; Customers — Guide</SheetTitle>
          <SheetDescription>
            Common questions about managing customers and sales. / گاہک اور سیلز کے بارے میں عام سوالات۔
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

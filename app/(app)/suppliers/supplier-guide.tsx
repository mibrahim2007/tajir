'use client'

import { useState } from 'react'
import { BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

type QA = { q: string; a: string }

/* ─── English Q&A — Suppliers & Purchases ─────────── */
const EN: QA[] = [
  { q: 'How do I add a new supplier?',
    a: 'On the Suppliers page click “Add Supplier”, enter the name (and an optional opening balance), then save.' },
  { q: 'What is an opening balance?',
    a: 'The amount you already owed a supplier before you started using Tajir. Enter it when creating the supplier — it becomes the starting point of their ledger.' },
  { q: 'What does “Outstanding” mean on the supplier list?',
    a: 'The net amount you currently owe the supplier: opening balance + purchases − payments − purchase returns − debit notes + payments received back. Amber means you owe them; a green credit balance means they owe you.' },
  { q: 'How do I see a supplier’s full transaction history?',
    a: 'Click “Ledger” next to the supplier. It lists every purchase, payment, return, debit note and received payment with a running balance, and you can Print or Export it.' },
  { q: 'How do I record a payment made to a supplier?',
    a: 'Open the supplier’s Ledger and click “Record Payment” (or use the Payments page). Enter the amount, date and where the money was paid from — Cash, Bank, or Post-dated Cheque.' },
  { q: 'What is the “Paid from” / money account?',
    a: 'Which account the money left — Cash in Hand, Cash at Bank, or Post-dated Cheques (PDC). It decides which account is credited in your books.' },
  { q: 'What is “Receive Payment”?',
    a: 'Use it when a supplier returns money to you — an overpayment return, refund or reimbursement. It reduces what you owe (or restores your balance) and is recorded with a serial like RCV-2026-0001.' },
  { q: 'What is the serial number on a voucher?',
    a: 'An automatic reference assigned when you save (e.g. PAY-2026-0001). Payments, received payments, purchases and purchase returns each have their own yearly sequence.' },
  { q: 'How do I record a purchase?',
    a: 'Go to Purchases → New Purchase, pick the supplier and the items with quantity and rate, add any advance paid, then save. Each purchase gets a serial like PO-2026-0001.' },
  { q: 'Can I edit or delete a purchase?',
    a: 'Yes. Open the purchase to edit its lines, or delete it (owner only). Deleting reverses the related stock and ledger entries.' },
  { q: 'What is a purchase return?',
    a: 'When you return goods to a supplier. Record it under Purchase Returns — it reduces what you owe and removes the stock from inventory.' },
  { q: 'What is the difference between a purchase return and a debit note?',
    a: 'A purchase return takes goods out of stock. A debit note reduces the supplier’s balance without any stock movement — for example a price adjustment or discount you received.' },
  { q: 'I paid a supplier more than I owed — what happens?',
    a: 'Their balance becomes a credit (shown in green), meaning they owe you. You can hold it against future purchases or get it back using “Receive Payment”.' },
  { q: 'Which reports help me track suppliers?',
    a: 'Payables Aging (what you owe, by 0–30 / 31–60 / 61–90 / 90+ days), Purchase & Sales, and each supplier’s Ledger.' },
  { q: 'Can I print or share a supplier’s statement?',
    a: 'Yes — open the supplier’s Ledger and use Print, or Export to download it.' },
  { q: 'Do I need to add a supplier as a customer too?',
    a: 'No. If you pick a supplier in a sale or receipt, Tajir mirrors them automatically, so you never create duplicate parties.' },
]

/* ─── Urdu Q&A (RTL) — سپلائر اور خریداری ────────────── */
const UR: QA[] = [
  { q: 'نیا سپلائر کیسے شامل کروں؟',
    a: 'سپلائر صفحہ پر “Add Supplier” پر کلک کریں، نام (اور چاہیں تو ابتدائی بیلنس) درج کریں اور محفوظ کریں۔' },
  { q: 'ابتدائی بیلنس (Opening Balance) کیا ہے؟',
    a: 'وہ رقم جو تاجر استعمال کرنے سے پہلے سپلائر کو آپ کے ذمے واجب الادا تھی۔ سپلائر بناتے وقت درج کریں — یہ اس کے لیجر کا نقطۂ آغاز بن جاتی ہے۔' },
  { q: 'فہرست میں “Outstanding” کا کیا مطلب ہے؟',
    a: 'سپلائر کو اس وقت آپ کے ذمے واجب کل رقم: ابتدائی بیلنس + خریداری − ادائیگیاں − پرچیز ریٹرن − ڈیبٹ نوٹ + واپس موصول رقم۔ کہربائی (amber) رنگ = آپ کے ذمے رقم؛ سبز کریڈٹ بیلنس = سپلائر کے ذمے رقم۔' },
  { q: 'سپلائر کی مکمل لین دین کی تفصیل کہاں دیکھوں؟',
    a: 'سپلائر کے سامنے “Ledger” پر کلک کریں۔ اس میں ہر خریداری، ادائیگی، واپسی، ڈیبٹ نوٹ اور موصول رقم بمع رننگ بیلنس نظر آتی ہے، اور آپ Print یا Export کر سکتے ہیں۔' },
  { q: 'سپلائر کو کی گئی ادائیگی کیسے درج کروں؟',
    a: 'سپلائر کا Ledger کھولیں اور “Record Payment” پر کلک کریں (یا Payments صفحہ استعمال کریں)۔ رقم، تاریخ اور رقم کہاں سے ادا ہوئی (نقد، بینک یا PDC) درج کریں۔' },
  { q: '“Paid from” یا منی اکاؤنٹ کیا ہے؟',
    a: 'رقم کہاں سے نکلی — نقد (Cash in Hand)، بینک (Cash at Bank)، یا پوسٹ ڈیٹڈ چیک (PDC)۔ اس سے طے ہوتا ہے کہ کھاتوں میں کون سا اکاؤنٹ کریڈٹ ہوگا۔' },
  { q: '“Receive Payment” کیا ہے؟',
    a: 'جب سپلائر آپ کو رقم واپس کرے — زائد ادائیگی کی واپسی، ریفنڈ یا معاوضہ۔ اس سے آپ کے ذمے واجب کم ہوتا ہے (یا بیلنس بحال ہوتا ہے) اور یہ RCV-2026-0001 جیسے سیریل کے ساتھ درج ہوتی ہے۔' },
  { q: 'واؤچر پر سیریل نمبر کیا ہے؟',
    a: 'محفوظ کرتے وقت خودکار طور پر ملنے والا حوالہ نمبر (مثلاً PAY-2026-0001)۔ ادائیگی، موصول رقم، خریداری اور پرچیز ریٹرن سب کا اپنا سالانہ سلسلہ ہوتا ہے۔' },
  { q: 'خریداری کیسے درج کروں؟',
    a: 'Purchases → New Purchase پر جائیں، سپلائر اور آئٹمز کو مقدار اور ریٹ کے ساتھ منتخب کریں، کوئی ایڈوانس ادا کیا ہو تو درج کریں، پھر محفوظ کریں۔ ہر خریداری کو PO-2026-0001 جیسا سیریل ملتا ہے۔' },
  { q: 'کیا میں خریداری میں ترمیم یا حذف کر سکتا ہوں؟',
    a: 'جی ہاں۔ خریداری کھول کر اس کی لائنیں تبدیل کریں، یا حذف کریں (صرف مالک)۔ حذف کرنے پر متعلقہ اسٹاک اور لیجر کے اندراج واپس ہو جاتے ہیں۔' },
  { q: 'پرچیز ریٹرن (Purchase Return) کیا ہے؟',
    a: 'جب آپ سپلائر کو مال واپس کریں۔ اسے Purchase Returns میں درج کریں — اس سے آپ کے ذمے واجب کم ہوتا ہے اور اسٹاک انوینٹری سے نکل جاتا ہے۔' },
  { q: 'پرچیز ریٹرن اور ڈیبٹ نوٹ میں کیا فرق ہے؟',
    a: 'پرچیز ریٹرن مال کو اسٹاک سے نکالتا ہے۔ ڈیبٹ نوٹ بغیر کسی اسٹاک حرکت کے سپلائر کا بیلنس کم کرتا ہے — مثلاً قیمت میں رعایت یا حاصل شدہ ڈسکاؤنٹ۔' },
  { q: 'میں نے سپلائر کو واجب سے زیادہ ادا کر دیا — کیا ہوتا ہے؟',
    a: 'اس کا بیلنس کریڈٹ بن جاتا ہے (سبز رنگ)، یعنی رقم سپلائر کے ذمے ہے۔ آپ اسے آئندہ خریداری کے مقابل رکھ سکتے ہیں یا “Receive Payment” کے ذریعے واپس لے سکتے ہیں۔' },
  { q: 'سپلائرز کی نگرانی کے لیے کون سی رپورٹس مددگار ہیں؟',
    a: 'Payables Aging (آپ کے ذمے کتنا واجب، ۰–۳۰ / ۳۱–۶۰ / ۶۱–۹۰ / ۹۰+ دن)، Purchase & Sales، اور ہر سپلائر کا Ledger۔' },
  { q: 'کیا میں سپلائر کا اسٹیٹمنٹ پرنٹ یا شیئر کر سکتا ہوں؟',
    a: 'جی ہاں — سپلائر کا Ledger کھول کر Print کریں، یا Export سے ڈاؤن لوڈ کریں۔' },
  { q: 'کیا سپلائر کو گاہک کے طور پر الگ سے شامل کرنا ہوگا؟',
    a: 'نہیں۔ اگر آپ فروخت یا وصولی میں سپلائر منتخب کریں تو تاجر خودکار طور پر انہیں مِرر کر دیتا ہے، اس لیے نقل (duplicate) نہیں بنتی۔' },
]

export function SupplierGuide() {
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
          <SheetTitle>Suppliers &amp; Purchases — Guide</SheetTitle>
          <SheetDescription>
            Common questions about managing suppliers and purchases. / سپلائر اور خریداری کے بارے میں عام سوالات۔
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

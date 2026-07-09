'use client'

import { useState } from 'react'
import { BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

type QA = { q: string; a: string }

/* ─── English Q&A — Inventory & Stock ─────────────── */
const EN: QA[] = [
  { q: 'What is a “stock item” or “lot”?',
    a: 'A single product record you buy and sell (for example a fabric lot). Each one has a name, a code/SKU and a unit of measure.' },
  { q: 'How do I add a stock item?',
    a: 'On the Inventory page click “Add Lot” (or “Add Items by Type”), fill in the name, unit, item type and details, then save.' },
  { q: 'What are item types?',
    a: 'Categories that group items and define their attributes. Pick an item type when creating a new item.' },
  { q: 'How is the current quantity calculated?',
    a: 'Automatically: purchases (and returns from customers) add stock, while sales (and returns to suppliers) and outward transfers reduce it. You never edit quantity by hand.' },
  { q: 'How do I bring in opening stock?',
    a: 'Record it as a purchase (or set it up when creating the item) so both the quantity and its value are tracked from the start.' },
  { q: 'What are SKU, code and count?',
    a: 'Identifiers for the item — SKU/code are used for lookup and labels, and count is an attribute of the item (e.g. yarn count).' },
  { q: 'How do I print barcode labels?',
    a: 'Tick the checkboxes next to the items you want, then use the label print to generate barcode stickers for them.' },
  { q: 'Can I edit or delete a stock item?',
    a: 'Yes — open it to edit, or delete it (owner only). An item that already has transactions cannot be deleted.' },
  { q: 'What are locations and stock transfers?',
    a: 'Locations are your warehouses or shops. Stock Transfers move quantity from one location to another without changing your total stock.' },
  { q: 'Which reports show my stock?',
    a: 'Stock Summary (quantities), Stock Valuation (value in PKR), Location-wise Stock, and Item Ledger (full movement history).' },
  { q: 'How is my stock valued?',
    a: 'Stock Valuation multiplies each item’s quantity by its latest purchase rate (or opening rate) to give the total value in PKR.' },
  { q: 'How do I see all movement for one item?',
    a: 'Open the Item Ledger report — it lists every purchase, sale, return and transfer for that item with a running balance.' },
  { q: 'How do I filter the inventory list?',
    a: 'Use the filters above the table (type, count, fiber, lot) to narrow down the list.' },
  { q: 'What is the unit of measure?',
    a: 'How the item is counted — pieces, kg, meters, etc. It is used consistently across purchases, sales and reports.' },
]

/* ─── Urdu Q&A (RTL) — انوینٹری اور اسٹاک ───────────── */
const UR: QA[] = [
  { q: '“اسٹاک آئٹم” یا “لاٹ” کیا ہے؟',
    a: 'ایک پروڈکٹ کا ریکارڈ جو آپ خریدتے اور بیچتے ہیں (مثلاً کپڑے کی لاٹ)۔ ہر ایک کا نام، کوڈ/SKU اور یونٹ ہوتا ہے۔' },
  { q: 'اسٹاک آئٹم کیسے شامل کروں؟',
    a: 'Inventory صفحہ پر “Add Lot” (یا “Add Items by Type”) پر جائیں، نام، یونٹ، آئٹم ٹائپ اور تفصیل بھریں، پھر محفوظ کریں۔' },
  { q: 'آئٹم ٹائپ (Item Types) کیا ہیں؟',
    a: 'زمرے جو آئٹمز کو گروپ کرتے اور ان کی خصوصیات طے کرتے ہیں۔ نیا آئٹم بناتے وقت ایک ٹائپ منتخب کریں۔' },
  { q: 'موجودہ مقدار کیسے شمار ہوتی ہے؟',
    a: 'خودکار طور پر: خریداری (اور گاہک سے واپسی) اسٹاک بڑھاتی ہے، جبکہ فروخت (اور سپلائر کو واپسی) اور باہر جانے والے ٹرانسفر کم کرتے ہیں۔ مقدار ہاتھ سے تبدیل نہیں کی جاتی۔' },
  { q: 'ابتدائی اسٹاک کیسے درج کروں؟',
    a: 'اسے خریداری کے طور پر درج کریں (یا آئٹم بناتے وقت)، تاکہ شروع ہی سے مقدار اور قیمت دونوں ٹریک ہوں۔' },
  { q: 'SKU، کوڈ اور کاؤنٹ کیا ہیں؟',
    a: 'آئٹم کے شناختی نمبر — تلاش اور لیبل کے لیے SKU/کوڈ، اور کاؤنٹ آئٹم کی ایک خصوصیت (مثلاً دھاگے کا کاؤنٹ)۔' },
  { q: 'بارکوڈ لیبل کیسے پرنٹ کروں؟',
    a: 'مطلوبہ آئٹمز کے سامنے چیک باکس منتخب کریں، پھر لیبل پرنٹ سے ان کے بارکوڈ اسٹیکر بنائیں۔' },
  { q: 'کیا میں اسٹاک آئٹم میں ترمیم یا حذف کر سکتا ہوں؟',
    a: 'جی ہاں — کھول کر ترمیم کریں، یا حذف کریں (صرف مالک)۔ جس آئٹم پر پہلے سے لین دین ہو اسے حذف نہیں کیا جا سکتا۔' },
  { q: 'Locations اور Stock Transfers کیا ہیں؟',
    a: 'Locations آپ کے گودام یا دکانیں ہیں۔ Stock Transfers مقدار کو ایک مقام سے دوسرے مقام منتقل کرتے ہیں بغیر کل اسٹاک تبدیل کیے۔' },
  { q: 'میرا اسٹاک کون سی رپورٹس دکھاتی ہیں؟',
    a: 'Stock Summary (مقدار)، Stock Valuation (PKR میں قیمت)، Location-wise Stock، اور Item Ledger (مکمل حرکت کی تاریخ)۔' },
  { q: 'میرے اسٹاک کی قیمت کیسے لگتی ہے؟',
    a: 'Stock Valuation ہر آئٹم کی مقدار کو اس کے آخری خرید ریٹ (یا ابتدائی ریٹ) سے ضرب دے کر PKR میں کل قیمت نکالتی ہے۔' },
  { q: 'ایک آئٹم کی تمام حرکت کہاں دیکھوں؟',
    a: 'Item Ledger رپورٹ کھولیں — اس میں اُس آئٹم کی ہر خریداری، فروخت، واپسی اور ٹرانسفر بمع رننگ بیلنس نظر آتی ہے۔' },
  { q: 'انوینٹری فہرست کو فلٹر کیسے کروں؟',
    a: 'ٹیبل کے اوپر موجود فلٹرز (ٹائپ، کاؤنٹ، فائبر، لاٹ) استعمال کر کے فہرست محدود کریں۔' },
  { q: 'یونٹ آف میژر (Unit of Measure) کیا ہے؟',
    a: 'آئٹم کیسے گنا جاتا ہے — عدد، کلو، میٹر وغیرہ۔ یہ خریداری، فروخت اور رپورٹس میں یکساں استعمال ہوتا ہے۔' },
]

export function InventoryGuide() {
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
          <SheetTitle>Inventory &amp; Stock — Guide</SheetTitle>
          <SheetDescription>
            Common questions about managing stock and inventory. / اسٹاک اور انوینٹری کے بارے میں عام سوالات۔
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

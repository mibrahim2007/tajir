// Converts a number to English words using the South-Asian (lakh/crore)
// numbering system, then wraps it as a PKR currency phrase for invoices.

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
]
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

// Words for 0–99
function twoDigits(n: number): string {
  if (n < 20) return ONES[n]
  const t = Math.floor(n / 10)
  const o = n % 10
  return TENS[t] + (o ? ' ' + ONES[o] : '')
}

// Words for 0–999
function threeDigits(n: number): string {
  const h = Math.floor(n / 100)
  const rest = n % 100
  const parts: string[] = []
  if (h) parts.push(ONES[h] + ' Hundred')
  if (rest) parts.push(twoDigits(rest))
  return parts.join(' ')
}

// Whole number → words (lakh/crore grouping)
export function integerToWords(num: number): string {
  if (num === 0) return 'Zero'
  let n = Math.floor(Math.abs(num))
  const parts: string[] = []

  const crore = Math.floor(n / 10000000); n %= 10000000
  const lakh = Math.floor(n / 100000);    n %= 100000
  const thousand = Math.floor(n / 1000);  n %= 1000
  const hundreds = n

  if (crore) parts.push(integerToWords(crore) + ' Crore')
  if (lakh) parts.push(twoDigits(lakh) + ' Lakh')
  if (thousand) parts.push(twoDigits(thousand) + ' Thousand')
  if (hundreds) parts.push(threeDigits(hundreds))

  return (num < 0 ? 'Minus ' : '') + parts.join(' ')
}

// e.g. 3450.5 → "Rupees Three Thousand Four Hundred Fifty and Fifty Paisa Only"
export function amountToWordsPKR(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0
  let rupees = Math.floor(Math.abs(safe))
  let paisa = Math.round((Math.abs(safe) - rupees) * 100)
  if (paisa === 100) { rupees += 1; paisa = 0 }

  const rupeeWords = integerToWords(rupees)
  const paisaWords = paisa > 0 ? ` and ${twoDigits(paisa)} Paisa` : ''
  return `Rupees ${rupeeWords}${paisaWords} Only`
}

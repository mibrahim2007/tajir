export type Currency = 'PKR' | 'USD'

export function roundMonetary(amount: number): number {
  return Math.round(amount * 100) / 100
}

export function formatCurrency(amount: number, currency: Currency): string {
  if (currency === 'PKR') {
    return formatPKR(amount)
  }
  return formatUSD(amount)
}

export function formatPKR(amount: number): string {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function toPkrEquivalent(amount: number, exchangeRate: number): number {
  return roundMonetary(amount * exchangeRate)
}

// Customer status: a manual classification set on the customer form, shown on
// the customers list and detail page, and used as a list filter.

export const CUSTOMER_STATUSES = ['active', 'inactive', 'low_transaction'] as const
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number]

export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
  active: 'Active',
  inactive: 'In-active',
  low_transaction: 'Low Transaction',
}

// Normalise an unknown/legacy value to a valid status (defaults to active).
export function toCustomerStatus(value?: string | null): CustomerStatus {
  return (CUSTOMER_STATUSES as readonly string[]).includes(value ?? '')
    ? (value as CustomerStatus)
    : 'active'
}

export function customerStatusLabel(value?: string | null): string {
  return CUSTOMER_STATUS_LABELS[toCustomerStatus(value)]
}

// Tailwind classes for the coloured status pill.
export const CUSTOMER_STATUS_BADGE: Record<CustomerStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  inactive: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400',
  low_transaction: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
}

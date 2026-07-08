// The five GL account types allowed by the chart_of_accounts CHECK constraint.
// Kept in a plain module (not a 'use server' file) so it can be imported by
// both server actions and client components.
export const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'revenue', 'expense'] as const

export type AccountType = (typeof ACCOUNT_TYPES)[number]

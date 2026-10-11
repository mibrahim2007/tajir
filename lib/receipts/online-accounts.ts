import { createAdminClient } from '@/lib/supabase/admin'

// Where an Online receipt may land. It is money arriving, so only asset
// accounts that can hold money qualify: Cash in Hand, Cash at Bank, and the
// tenant's own asset accounts (a GL account per bank, a mobile wallet…).
// System control accounts — Receivables, PDC, Stock, Employee Loans, Freight
// Clearing — are excluded: a cash debit there would corrupt the sub-ledger
// that account summarises. Header (grouping) and inactive accounts can't be
// posted to at all.
//
// The same rule feeds the form's dropdown and the server check in
// create/edit-ar-receipt, so the list and the validation can't drift apart.

export const ONLINE_DEFAULT_KEY = 'cash_at_bank'
const MONEY_SYSTEM_KEYS = ['cash_at_bank', 'cash_in_hand']

export type OnlineAccount = { id: string; code: string; name: string; isDefault: boolean }

type Admin = ReturnType<typeof createAdminClient>

export async function listOnlineReceiptAccounts(admin: Admin, tenantId: string): Promise<OnlineAccount[]> {
  const { data, error } = await admin
    .from('chart_of_accounts')
    .select('id, code, name, system_key')
    .eq('tenant_id', tenantId)
    .eq('account_type', 'asset')
    .eq('is_active', true)
    .eq('is_header', false)
    .order('code')
  if (error) throw new Error(`listOnlineReceiptAccounts: ${error.message}`)

  return (data ?? [])
    .filter((a) => !a.system_key || MONEY_SYSTEM_KEYS.includes(a.system_key))
    .map((a) => ({ id: a.id, code: a.code, name: a.name, isDefault: a.system_key === ONLINE_DEFAULT_KEY }))
}

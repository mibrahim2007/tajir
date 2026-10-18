import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MONEY_KEYS = new Set(['cash_in_hand', 'cash_at_bank', 'post_dated_cheques', 'post_dated_cheques_payable'])
const PROCESS_FOR: Record<string, string> = { sale_order: 'sale_invoice', purchase_order: 'purchase_invoice' }

type GlLine = {
  accountSystemKey: string
  debit: number
  credit: number
  customerId?: string
  supplierId?: string
  stockItemId?: string
}

export async function postGl(
  admin: SupabaseClient,
  tenantId: string,
  date: string,
  description: string,
  sourceType: string,
  sourceId: string,
  prefix: string,
  lines: GlLine[],
): Promise<void> {
  const keys = [...new Set(lines.map((l) => l.accountSystemKey))]
  const { data: accounts } = await admin
    .from('chart_of_accounts')
    .select('id, system_key')
    .eq('tenant_id', tenantId)
    .in('system_key', keys)

  if (!accounts || accounts.length < keys.length) return // CoA not fully set up — skip silently

  const accountMap = new Map(accounts.map((a: { id: string; system_key: string }) => [a.system_key, a.id]))

  // Heads the tenant redirected in Settings → Posting Accounts, keyed by the
  // web process the mobile document corresponds to. Mirrors
  // lib/accounting/posting-rules.ts: the cash / bank leg is never overridden.
  const process = PROCESS_FOR[sourceType] ?? sourceType
  const overridable = keys.filter((k) => !MONEY_KEYS.has(k))
  if (overridable.length > 0) {
    const { data: overrides } = await admin
      .from('posting_account_overrides')
      .select('system_key, account_id')
      .eq('tenant_id', tenantId)
      .eq('process', process)
      .in('system_key', overridable)
    for (const o of (overrides ?? []) as { system_key: string; account_id: string }[]) accountMap.set(o.system_key, o.account_id)
  }

  const { data: voucherRow } = await admin.rpc('get_next_voucher_number', {
    p_tenant_id: tenantId,
    p_prefix: prefix,
  })
  if (!voucherRow) return

  const { data: entry, error } = await admin
    .from('tajir_journal_entries')
    .insert({ tenant_id: tenantId, voucher_number: voucherRow, date, description, source_type: sourceType, source_id: sourceId })
    .select('id')
    .single()

  if (error || !entry) return

  await admin.from('tajir_journal_entry_lines').insert(
    lines.map((l) => ({
      journal_entry_id: entry.id,
      tenant_id: tenantId,
      account_id: accountMap.get(l.accountSystemKey)!,
      debit: String(l.debit),
      credit: String(l.credit),
      customer_id: l.customerId ?? null,
      supplier_id: l.supplierId ?? null,
      stock_item_id: l.stockItemId ?? null,
    })),
  )
}

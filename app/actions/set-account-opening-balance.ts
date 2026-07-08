'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  accountId: z.string().uuid('Invalid account'),
  amount:    z.coerce.number().min(0, 'Amount must be 0 or greater'),
  date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
})

export type SetAccountOpeningBalanceInput = z.infer<typeof schema>

// Sets (or clears) the opening balance of a single GL account. Because every
// report derives balances from journal lines, an opening balance is posted as a
// dedicated `opening_balance` journal entry: the target account on its normal
// side, offset against the "Opening Balance Equity" contra account. Re-running
// replaces the prior entry for the account (idempotent); amount 0 clears it.
export async function setAccountOpeningBalanceAction(input: unknown): Promise<ActionResult<{ amount: number }>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Only owners can set opening balances', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { accountId, amount, date } = parsed.data
  const admin = createAdminClient()

  // Load the target account
  const { data: account } = await admin
    .from('chart_of_accounts')
    .select('id, code, name, account_type, is_header, system_key')
    .eq('id', accountId)
    .eq('tenant_id', tenantId)
    .single()

  if (!account) return { success: false, error: 'Account not found', code: 'NOT_FOUND' }
  if (account.is_header) return { success: false, error: 'Header accounts cannot hold a balance', code: 'VALIDATION_ERROR' }
  if (account.system_key === 'opening_balance_equity') {
    return { success: false, error: 'The Opening Balance Equity account balances automatically', code: 'VALIDATION_ERROR' }
  }

  // Resolve (or lazily create) the Opening Balance Equity contra account
  const obe = await resolveOpeningBalanceEquity(admin, tenantId)
  if (!obe) return { success: false, error: 'Could not set up the Opening Balance Equity account', code: 'INTERNAL_ERROR' }
  if (obe.id === accountId) {
    return { success: false, error: 'The Opening Balance Equity account balances automatically', code: 'VALIDATION_ERROR' }
  }

  // Remove any previous opening-balance voucher for this account (replace-in-place).
  // Lines cascade when the header is deleted.
  const { data: priorEntries } = await admin
    .from('tajir_journal_entries')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('source_type', 'opening_balance')
    .eq('source_id', accountId)

  const priorIds = (priorEntries ?? []).map((e) => e.id)
  if (priorIds.length > 0) {
    await admin.from('tajir_journal_entries').delete().in('id', priorIds)
  }

  if (amount > 0) {
    // Asset/expense carry a debit-normal balance; liability/equity/revenue credit-normal.
    const isDebitNormal = account.account_type === 'asset' || account.account_type === 'expense'

    const { data: voucherNumber } = await admin.rpc('get_next_voucher_number', {
      p_tenant_id: tenantId,
      p_prefix:    'OB',
    })
    if (!voucherNumber) return { success: false, error: 'Failed to generate voucher number', code: 'INTERNAL_ERROR' }

    const { data: entry, error: entryError } = await admin
      .from('tajir_journal_entries')
      .insert({
        tenant_id:      tenantId,
        voucher_number: voucherNumber as string,
        date,
        description:    `Opening balance — ${account.name}`,
        reference:      null,
        source_type:    'opening_balance',
        source_id:      accountId,
      })
      .select('id')
      .single()

    if (entryError || !entry) return { success: false, error: 'Failed to create opening balance entry', code: 'INTERNAL_ERROR' }

    const lineRows = [
      {
        journal_entry_id: entry.id,
        tenant_id:        tenantId,
        account_id:       accountId,
        description:      'Opening balance',
        debit:            isDebitNormal ? amount : 0,
        credit:           isDebitNormal ? 0 : amount,
      },
      {
        journal_entry_id: entry.id,
        tenant_id:        tenantId,
        account_id:       obe.id,
        description:      'Opening balance (contra)',
        debit:            isDebitNormal ? 0 : amount,
        credit:           isDebitNormal ? amount : 0,
      },
    ]

    const { error: linesError } = await admin.from('tajir_journal_entry_lines').insert(lineRows)
    if (linesError) {
      await admin.from('tajir_journal_entries').delete().eq('id', entry.id)
      return { success: false, error: 'Failed to save opening balance lines', code: 'INTERNAL_ERROR' }
    }
  }

  await createAuditEntry({
    tenantId, userId: user.id, action: 'set_opening_balance',
    entity: 'chart_of_accounts', entityId: accountId,
    after: { amount, date, accountCode: account.code },
  })

  return { success: true, data: { amount } }
}

type AdminClient = ReturnType<typeof createAdminClient>

// Finds the tenant's Opening Balance Equity account, creating it under the
// EQUITY (3000) header if it does not exist yet (e.g. an older, hand-built CoA).
async function resolveOpeningBalanceEquity(admin: AdminClient, tenantId: string): Promise<{ id: string } | null> {
  const { data: existing } = await admin
    .from('chart_of_accounts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('system_key', 'opening_balance_equity')
    .maybeSingle()
  if (existing) return existing

  const { data: equityHeader } = await admin
    .from('chart_of_accounts')
    .select('code')
    .eq('tenant_id', tenantId)
    .eq('code', '3000')
    .maybeSingle()

  const { data: created } = await admin
    .from('chart_of_accounts')
    .insert({
      tenant_id:    tenantId,
      code:         '3300',
      name:         'Opening Balance Equity',
      account_type: 'equity',
      parent_code:  equityHeader ? '3000' : null,
      is_header:    false,
      is_system:    true,
      system_key:   'opening_balance_equity',
      is_active:    true,
    })
    .select('id')
    .single()
  if (created) return created

  // A concurrent call (or a pre-existing code 3300) may have won the race — re-read.
  const { data: fallback } = await admin
    .from('chart_of_accounts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('system_key', 'opening_balance_equity')
    .maybeSingle()
  return fallback ?? null
}

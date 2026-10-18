'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { isOverridable, POSTING_PROCESSES } from '@/lib/accounting/posting-rules'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  // The complete set of overrides after the edit; anything left out goes back
  // to the standard head.
  overrides: z.array(z.object({
    process:   z.string().min(1),
    systemKey: z.string().min(1),
    accountId: z.string().uuid(),
  })).max(200),
})

// Saves which account each business process debits / credits — owner only.
//
// An override must point at an active, postable account of the SAME type as the
// standard head it replaces (an asset for Accounts Receivable, revenue for Sales
// Revenue, …), so the Balance Sheet and P&L keep classifying the amounts the
// same way. Choosing the standard account itself simply clears the override.
export async function savePostingAccountsAction(input: unknown): Promise<ActionResult<{ saved: number }>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Only owners can change posting accounts', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }

  const { overrides } = parsed.data
  const seen = new Set<string>()
  for (const o of overrides) {
    if (!isOverridable(o.process, o.systemKey)) {
      return { success: false, error: `That account cannot be changed for ${o.process}`, code: 'VALIDATION_ERROR' }
    }
    const k = `${o.process}:${o.systemKey}`
    if (seen.has(k)) return { success: false, error: 'Duplicate posting rule', code: 'VALIDATION_ERROR' }
    seen.add(k)
  }

  const admin = createAdminClient()
  const { data: accounts } = await admin
    .from('chart_of_accounts')
    .select('id, name, account_type, system_key, is_active, is_header')
    .eq('tenant_id', tenantId)
  const byId  = new Map((accounts ?? []).map((a) => [a.id, a]))
  const byKey = new Map((accounts ?? []).filter((a) => a.system_key).map((a) => [a.system_key!, a]))

  const rows: { process: string; system_key: string; account_id: string }[] = []
  for (const o of overrides) {
    const standard = byKey.get(o.systemKey)
    const target   = byId.get(o.accountId)
    const label    = POSTING_PROCESSES.find((p) => p.process === o.process)?.label ?? o.process
    if (!standard) return { success: false, error: `Standard account "${o.systemKey}" is missing from the chart of accounts`, code: 'COA_NOT_SEEDED' }
    if (!target || !target.is_active || target.is_header) {
      return { success: false, error: `${label}: choose an active, non-header account`, code: 'VALIDATION_ERROR' }
    }
    if (target.account_type !== standard.account_type) {
      return {
        success: false,
        error: `${label}: "${target.name}" is ${target.account_type}, but ${standard.name} needs a ${standard.account_type} account`,
        code: 'VALIDATION_ERROR',
      }
    }
    if (target.id === standard.id) continue // same as standard — no override needed
    rows.push({ process: o.process, system_key: o.systemKey, account_id: target.id })
  }

  // Who made the change, as it should read in the history even if the user
  // is later renamed or removed.
  const { data: member } = await admin
    .from('tenant_users').select('username').eq('tenant_id', tenantId).eq('user_id', user.id).maybeSingle()
  const userLabel = member?.username || user.email || null

  // One transaction: only the heads that actually changed are inserted,
  // updated or deleted, and each change lands in posting_account_override_history.
  const { data: result, error } = await admin.rpc('save_posting_account_overrides', {
    p_tenant_id:  tenantId,
    p_user_id:    user.id,
    p_user_label: userLabel ?? '',
    p_rows:       rows,
  })
  if (error) {
    console.error(`[savePostingAccounts] ${error.message} (tenant=${tenantId})`)
    return { success: false, error: 'Failed to save posting accounts', code: 'INTERNAL_ERROR' }
  }
  const counts = result as { inserted: number; updated: number; deleted: number }

  if (counts.inserted + counts.updated + counts.deleted > 0) {
    await createAuditEntry({
      tenantId, userId: user.id, action: 'update', entity: 'posting_account_overrides', entityId: tenantId,
      after: { ...counts, overrides: rows },
    })
  }

  return { success: true, data: { saved: rows.length } }
}

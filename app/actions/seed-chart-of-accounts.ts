'use server'

import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult } from '@/lib/types'

export async function seedChartOfAccountsAction(): Promise<ActionResult<{ count: number }>> {
  const { role, tenantId } = await requireAuth()
  if (role !== 'owner') {
    return { success: false, error: 'Only owners can manage accounts', code: 'UNAUTHORIZED' }
  }

  const admin = createAdminClient()
  const { error } = await admin.rpc('seed_standard_coa', { p_tenant_id: tenantId })

  if (error) {
    return { success: false, error: 'Failed to seed chart of accounts', code: 'INTERNAL_ERROR' }
  }

  const { count } = await admin
    .from('chart_of_accounts')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)

  return { success: true, data: { count: count ?? 0 } }
}

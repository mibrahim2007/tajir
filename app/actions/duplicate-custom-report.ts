'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult } from '@/lib/types'
import { fetchReportDefinition } from '@/lib/reports/custom-report'
import { saveCustomReportAction } from './save-custom-report'

const schema = z.object({ id: z.string().uuid() })

// Copies an existing layout under a new name, so a tenant can fork a working
// statement (e.g. "P&L" → "P&L — management view") without rebuilding it.
export async function duplicateCustomReportAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Invalid report', code: 'VALIDATION_ERROR' }

  const { role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Only owners can manage report layouts', code: 'UNAUTHORIZED' }

  const admin = createAdminClient()
  const definition = await fetchReportDefinition({ admin, tenantId, reportId: parsed.data.id })
  if (!definition) return { success: false, error: 'Report not found', code: 'NOT_FOUND' }

  // Names are unique per tenant, so find the first free "(copy N)" suffix.
  const { data: existing } = await admin
    .from('custom_reports')
    .select('name')
    .eq('tenant_id', tenantId)
  const taken = new Set((existing ?? []).map((r) => (r.name as string).toLowerCase()))

  let name = `${definition.name} (copy)`
  for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${definition.name} (copy ${n})`

  const result = await saveCustomReportAction({
    name,
    description: definition.description ?? undefined,
    basis: definition.basis,
    hideZeroRows: definition.hideZeroRows,
    lines: definition.lines.map((l) => ({
      lineType: l.lineType,
      label: l.label,
      ref: l.ref ?? undefined,
      indent: l.indent,
      sign: l.sign,
      includeChildren: l.includeChildren,
      showDetail: l.showDetail,
      isBold: l.isBold,
      underline: l.underline,
      formula: l.formula ?? undefined,
      accountCodes: l.accountCodes,
    })),
  })

  if (!result.success) return result

  revalidatePath('/reports/custom')
  return result
}

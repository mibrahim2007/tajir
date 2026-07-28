'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult } from '@/lib/types'

const schema = z.object({ id: z.string().uuid() })

// Deletes a custom report layout. Lines and their account mappings go with it
// via ON DELETE CASCADE. No accounting data is touched — a layout holds none.
export async function deleteCustomReportAction(input: unknown): Promise<ActionResult> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Invalid report', code: 'VALIDATION_ERROR' }

  const { role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Only owners can manage report layouts', code: 'UNAUTHORIZED' }

  const admin = createAdminClient()

  const { error, count } = await admin
    .from('custom_reports')
    .delete({ count: 'exact' })
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId)

  if (error) return { success: false, error: 'Failed to delete report', code: 'INTERNAL_ERROR' }
  if (count === 0) return { success: false, error: 'Report not found', code: 'NOT_FOUND' }

  revalidatePath('/reports/custom')
  return { success: true, data: undefined }
}

'use server'

import { requireAuth } from '@/lib/auth/require-auth'
import { listBatches } from '@/lib/playground/generate'
import type { DemoBatchInfo } from '@/lib/playground/types'

/** Owner-only list of not-yet-removed demo batches (for the cleanup panel). */
export async function listDemoBatchesAction(): Promise<DemoBatchInfo[]> {
  const { role, tenantId } = await requireAuth()
  if (role !== 'owner') return []
  return listBatches(tenantId)
}

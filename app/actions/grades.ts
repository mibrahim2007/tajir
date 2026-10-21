'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult } from '@/lib/types'

// Per-tenant grade list (AA-Even, A-Uneven, …), used on the lines of items
// whose item type tracks grade (migration 0072).

export type GradeOption = { id: string; name: string }

export async function listGradesAction(): Promise<ActionResult<GradeOption[]>> {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('grades').select('id, name').eq('tenant_id', tenantId)
    .order('sort_order').order('name')
  if (error) return { success: false, error: 'Failed to load grades', code: 'INTERNAL_ERROR' }
  return { success: true, data: data ?? [] }
}

const createSchema = z.object({ name: z.string().trim().min(1, 'Name is required').max(60) })

export async function createGradeAction(input: unknown): Promise<ActionResult<GradeOption>> {
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('grades').insert({ tenant_id: tenantId, name: parsed.data.name }).select('id, name').single()
  if (error || !data) {
    if (error?.code === '23505') return { success: false, error: 'A grade with this name already exists', code: 'DUPLICATE' }
    return { success: false, error: 'Failed to create grade', code: 'INTERNAL_ERROR' }
  }
  return { success: true, data }
}

const renameSchema = z.object({ id: z.string().uuid(), name: z.string().trim().min(1, 'Name is required').max(60) })

export async function renameGradeAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = renameSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }
  const { tenantId, role } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }
  const admin = createAdminClient()
  const { error } = await admin
    .from('grades').update({ name: parsed.data.name }).eq('id', parsed.data.id).eq('tenant_id', tenantId)
  if (error) {
    if (error.code === '23505') return { success: false, error: 'A grade with this name already exists', code: 'DUPLICATE' }
    return { success: false, error: 'Failed to rename grade', code: 'INTERNAL_ERROR' }
  }
  return { success: true, data: undefined }
}

export async function deleteGradeAction(id: string): Promise<ActionResult<void>> {
  const { tenantId, role } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Permission denied', code: 'UNAUTHORIZED' }
  const admin = createAdminClient()
  const { error } = await admin.from('grades').delete().eq('id', id).eq('tenant_id', tenantId)
  if (error) {
    // grade_id is ON DELETE RESTRICT on every line table.
    if (error.code === '23503') return { success: false, error: 'This grade is used on invoices or stock and can’t be deleted', code: 'IN_USE' }
    return { success: false, error: 'Failed to delete grade', code: 'INTERNAL_ERROR' }
  }
  return { success: true, data: undefined }
}

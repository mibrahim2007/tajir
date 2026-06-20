'use server'

import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult } from '@/lib/types'

const MAX_SIZE = 5 * 1024 * 1024

export async function saveAttachmentAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const { tenantId } = await requireAuth()

  const file = formData.get('file') as File | null
  const entryId = formData.get('entryId') as string | null
  const entityType = formData.get('entityType') as string | null

  if (!file || !entryId || !entityType) {
    return { success: false, error: 'Missing required fields', code: 'VALIDATION_ERROR' }
  }
  if (file.size > MAX_SIZE) {
    return { success: false, error: `${file.name} exceeds the 5 MB limit`, code: 'FILE_TOO_LARGE' }
  }

  const admin = createAdminClient()
  const ext = file.name.split('.').pop() ?? 'bin'
  const uniqueId = crypto.randomUUID()
  const storagePath = `${tenantId}/${entityType}/${entryId}/${uniqueId}.${ext}`

  const buffer = await file.arrayBuffer()

  const { error: uploadError } = await admin.storage
    .from('tajir-attachments')
    .upload(storagePath, buffer, { contentType: file.type || 'application/octet-stream', upsert: false })

  if (uploadError) {
    return { success: false, error: 'Upload failed: ' + uploadError.message, code: 'UPLOAD_ERROR' }
  }

  const { data: rec, error: dbError } = await admin
    .from('tajir_attachments')
    .insert({
      tenant_id:    tenantId,
      entry_id:     entryId,
      entity_type:  entityType,
      storage_path: storagePath,
      filename:     file.name,
      size:         file.size,
    })
    .select('id')
    .single()

  if (dbError || !rec) {
    await admin.storage.from('tajir-attachments').remove([storagePath])
    return { success: false, error: 'Failed to record attachment metadata', code: 'INTERNAL_ERROR' }
  }

  return { success: true, data: rec }
}

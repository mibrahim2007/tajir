'use server'

import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult } from '@/lib/types'

const VALID_TYPES = new Set(['asset', 'liability', 'equity', 'revenue', 'expense'])

function parseBool(v: string | undefined): boolean {
  if (!v) return false
  return ['true', 'yes', '1'].includes(v.toLowerCase().trim())
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const nonEmpty = lines.map(l => l.trim()).filter(Boolean)
  if (nonEmpty.length < 2) return []
  const headers = nonEmpty[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'))
  return nonEmpty.slice(1).map(line => {
    /* Handle quoted fields containing commas */
    const values: string[] = []
    let cur = '', inQ = false
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ }
      else if (ch === ',' && !inQ) { values.push(cur.trim()); cur = '' }
      else { cur += ch }
    }
    values.push(cur.trim())
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']))
  })
}

export async function uploadChartOfAccountsAction(
  formData: FormData,
): Promise<ActionResult<{ inserted: number; skipped: number }>> {
  const { role, tenantId } = await requireAuth()
  if (role !== 'owner') {
    return { success: false, error: 'Only owners can manage accounts', code: 'UNAUTHORIZED' }
  }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) {
    return { success: false, error: 'No file provided', code: 'VALIDATION_ERROR' }
  }
  if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
    return { success: false, error: 'Only CSV files are supported', code: 'VALIDATION_ERROR' }
  }

  const text = await file.text()
  const rows = parseCSV(text)
  if (rows.length === 0) {
    return { success: false, error: 'CSV is empty or has no data rows', code: 'VALIDATION_ERROR' }
  }

  /* Validate required columns exist */
  const firstRow = rows[0]
  if (!('code' in firstRow) || !('name' in firstRow) || !('type' in firstRow)) {
    return {
      success: false,
      error: 'CSV must have columns: code, name, type (and optional: parent_code, is_header, system_key)',
      code: 'VALIDATION_ERROR',
    }
  }

  const admin = createAdminClient()

  /* Fetch existing codes for this tenant to detect conflicts */
  const { data: existing } = await admin
    .from('chart_of_accounts')
    .select('code')
    .eq('tenant_id', tenantId)
  const existingCodes = new Set((existing ?? []).map(a => a.code))

  const toInsert: {
    tenant_id: string; code: string; name: string; account_type: string
    parent_code: string | null; is_header: boolean; is_system: boolean
    system_key: string | null; is_active: boolean
  }[] = []
  const errors: string[] = []
  let skipped = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2 // 1-indexed + header row

    const code = row.code?.trim()
    const name = row.name?.trim()
    const type = row.type?.trim().toLowerCase()

    if (!code) { errors.push(`Row ${rowNum}: code is required`); continue }
    if (!name)  { errors.push(`Row ${rowNum}: name is required`); continue }
    if (!VALID_TYPES.has(type)) {
      errors.push(`Row ${rowNum}: type must be one of asset, liability, equity, revenue, expense`)
      continue
    }

    if (existingCodes.has(code)) { skipped++; continue }

    const systemKey = row.system_key?.trim() || null

    toInsert.push({
      tenant_id:    tenantId,
      code,
      name,
      account_type: type,
      parent_code:  row.parent_code?.trim() || null,
      is_header:    parseBool(row.is_header),
      is_system:    !!systemKey,
      system_key:   systemKey,
      is_active:    true,
    })
  }

  if (errors.length > 0) {
    return {
      success: false,
      error: `Validation errors in CSV:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n…and ${errors.length - 5} more` : ''}`,
      code: 'VALIDATION_ERROR',
    }
  }

  if (toInsert.length === 0) {
    return { success: true, data: { inserted: 0, skipped } }
  }

  const { error: insertError } = await admin.from('chart_of_accounts').insert(toInsert)
  if (insertError) {
    return { success: false, error: `Insert failed: ${insertError.message}`, code: 'INTERNAL_ERROR' }
  }

  return { success: true, data: { inserted: toInsert.length, skipped } }
}

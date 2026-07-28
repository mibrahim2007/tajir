'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult } from '@/lib/types'
import { BASES, LINE_TYPES, SIGNS, evaluateFormula } from '@/lib/reports/custom-report'

const lineSchema = z.object({
  lineType: z.enum(LINE_TYPES),
  label: z.string().trim().max(120).default(''),
  ref: z.string().trim().max(12).optional(),
  indent: z.number().int().min(0).max(4).default(0),
  sign: z.enum(SIGNS).default('natural'),
  includeChildren: z.boolean().default(true),
  showDetail: z.boolean().default(false),
  isBold: z.boolean().default(false),
  underline: z.boolean().default(false),
  formula: z.string().trim().max(200).optional(),
  accountCodes: z.array(z.string().trim().max(10)).default([]),
})

const schema = z.object({
  /** Omit to create; supply to replace an existing definition. */
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, 'Report name is required').max(120),
  description: z.string().trim().max(500).optional(),
  basis: z.enum(BASES),
  hideZeroRows: z.boolean().default(true),
  lines: z.array(lineSchema).min(1, 'Add at least one line'),
})

// Saves a custom financial report LAYOUT (headers, the account codes mapped to
// each, and each line's behaviour). Never stores amounts — those are computed
// from the journal every time the report is viewed.
//
// Update replaces all lines rather than diffing them: a layout is small, and a
// wholesale replace cannot leave a half-applied reorder behind.
export async function saveCustomReportAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Only owners can manage report layouts', code: 'UNAUTHORIZED' }

  const { id, name, description, basis, hideZeroRows, lines } = parsed.data
  const admin = createAdminClient()

  // --- Validate the layout before touching the database ---------------------

  const refs = new Set<string>()
  const known = new Map<string, number>()   // refs available to a formula, in line order

  for (const [i, line] of lines.entries()) {
    const position = `Line ${i + 1}`

    if (line.lineType !== 'spacer' && !line.label) {
      return { success: false, error: `${position}: a label is required`, code: 'VALIDATION_ERROR' }
    }

    const ref = line.ref?.toUpperCase() ?? ''
    if (ref) {
      if (!/^[A-Z][A-Z0-9_]*$/.test(ref)) {
        return { success: false, error: `${position}: reference "${line.ref}" must start with a letter and use only letters, digits and _`, code: 'VALIDATION_ERROR' }
      }
      if (refs.has(ref)) {
        return { success: false, error: `${position}: reference "${ref}" is already used`, code: 'VALIDATION_ERROR' }
      }
      refs.add(ref)
    }

    if (line.lineType === 'accounts') {
      if (line.accountCodes.length === 0) {
        return { success: false, error: `${position} ("${line.label}"): select at least one account`, code: 'VALIDATION_ERROR' }
      }
    }

    if (line.lineType === 'subtotal') {
      if (!line.formula) {
        return { success: false, error: `${position} ("${line.label}"): a formula is required`, code: 'VALIDATION_ERROR' }
      }
      // Checked against refs defined ABOVE this line only, so a formula can
      // never depend on a value that has not been computed yet.
      const check = evaluateFormula(line.formula, known)
      if ('error' in check) {
        return { success: false, error: `${position} ("${line.label}"): ${check.error}`, code: 'VALIDATION_ERROR' }
      }
    }

    if (ref) known.set(ref, 0)
  }

  // Every mapped code must exist in this tenant's chart of accounts, or the
  // report would quietly total nothing for that header.
  const allCodes = [...new Set(lines.flatMap((l) => l.accountCodes))]
  if (allCodes.length > 0) {
    const { data: found } = await admin
      .from('chart_of_accounts')
      .select('code')
      .eq('tenant_id', tenantId)
      .in('code', allCodes)
    const foundCodes = new Set((found ?? []).map((a) => a.code as string))
    const missing = allCodes.filter((c) => !foundCodes.has(c))
    if (missing.length > 0) {
      return { success: false, error: `Unknown account code(s): ${missing.join(', ')}`, code: 'ACCOUNT_NOT_FOUND' }
    }
  }

  // --- Persist --------------------------------------------------------------

  let reportId = id

  if (reportId) {
    const { data: existing } = await admin
      .from('custom_reports')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('id', reportId)
      .maybeSingle()
    if (!existing) return { success: false, error: 'Report not found', code: 'NOT_FOUND' }

    const { error } = await admin
      .from('custom_reports')
      .update({
        name,
        description: description || null,
        basis,
        hide_zero_rows: hideZeroRows,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reportId)
      .eq('tenant_id', tenantId)

    if (error) {
      if (error.code === '23505') return { success: false, error: `A report named "${name}" already exists`, code: 'DUPLICATE' }
      return { success: false, error: 'Failed to save report', code: 'INTERNAL_ERROR' }
    }

    // Cascades to custom_report_line_accounts.
    const { error: delErr } = await admin.from('custom_report_lines').delete().eq('report_id', reportId)
    if (delErr) return { success: false, error: 'Failed to replace report lines', code: 'INTERNAL_ERROR' }
  } else {
    const { data, error } = await admin
      .from('custom_reports')
      .insert({
        tenant_id: tenantId,
        name,
        description: description || null,
        basis,
        hide_zero_rows: hideZeroRows,
        created_by: user.id,
      })
      .select('id')
      .single()

    if (error || !data) {
      if (error?.code === '23505') return { success: false, error: `A report named "${name}" already exists`, code: 'DUPLICATE' }
      return { success: false, error: 'Failed to create report', code: 'INTERNAL_ERROR' }
    }
    reportId = data.id as string
  }

  const { data: insertedLines, error: lineErr } = await admin
    .from('custom_report_lines')
    .insert(lines.map((line, i) => ({
      report_id: reportId,
      tenant_id: tenantId,
      sort_order: i,
      line_type: line.lineType,
      label: line.label,
      ref: line.ref ? line.ref.toUpperCase() : null,
      indent: line.indent,
      sign: line.sign,
      include_children: line.includeChildren,
      show_detail: line.showDetail,
      is_bold: line.isBold,
      underline: line.underline,
      formula: line.lineType === 'subtotal' ? (line.formula ?? null) : null,
    })))
    .select('id, sort_order')

  if (lineErr || !insertedLines) {
    // A definition with no lines renders as an empty page. Only a brand-new
    // report can be cleaned up safely — an edit still has its old lines gone,
    // so say so rather than pretending the save worked.
    if (!id) await admin.from('custom_reports').delete().eq('id', reportId).eq('tenant_id', tenantId)
    return { success: false, error: 'Failed to save report lines', code: 'INTERNAL_ERROR' }
  }

  // Match rows back by sort_order rather than array position — RETURNING order
  // is not something to bet a report's account mapping on.
  const idBySortOrder = new Map(insertedLines.map((l) => [l.sort_order as number, l.id as string]))

  const accountRows = lines.flatMap((line, i) => {
    if (line.lineType !== 'accounts') return []
    const lineId = idBySortOrder.get(i)
    if (!lineId) return []
    return [...new Set(line.accountCodes)].map((code) => ({
      line_id: lineId,
      tenant_id: tenantId,
      account_code: code,
    }))
  })

  if (accountRows.length > 0) {
    const { error: accErr } = await admin.from('custom_report_line_accounts').insert(accountRows)
    if (accErr) return { success: false, error: 'Failed to save account mappings', code: 'INTERNAL_ERROR' }
  }

  revalidatePath('/reports/custom')
  revalidatePath(`/reports/custom/${reportId}`)

  return { success: true, data: { id: reportId as string } }
}

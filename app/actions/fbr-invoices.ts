'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { documentDateSchema } from '@/lib/validation/document-date'
import { nextDocumentSerial } from '@/lib/serials/next-serial'
import { lineTotals, invoiceTotals } from '@/lib/fbr/calc'
import { scenarioById } from '@/lib/fbr/scenarios'
import { buildFbrPayload } from '@/lib/fbr/payload'
import { fbrCall, loadToken, interpretResponse, FBR_ENDPOINTS, type FbrEnv } from '@/lib/fbr/client'
import type { ActionResult } from '@/lib/types'

type Admin = ReturnType<typeof createAdminClient>

const money = z.coerce.number().min(0).default(0)
const lineSchema = z.object({
  hsCode:                   z.string().trim().regex(/^\d{4}\.\d{4}$/, 'HS code must look like 5205.1200'),
  productDescription:       z.string().trim().min(2, 'Product description is required').max(500),
  uom:                      z.string().trim().min(1, 'Unit is required'),
  quantity:                 z.coerce.number().positive('Quantity must be more than 0'),
  unitPrice:                z.coerce.number().min(0),
  discount:                 money,
  rate:                     z.string().trim().min(1, 'Tax rate is required'),
  retailPrice:              money,
  extraTax:                 money,
  fedPayable:               money,
  salesTaxWithheldAtSource: money,
  furtherTaxOverride:       z.coerce.number().min(0).nullable().default(null),
  sroScheduleNo:            z.string().trim().max(100).default(''),
  sroItemSerialNo:          z.string().trim().max(100).default(''),
})

const invoiceSchema = z.object({
  id:                    z.string().uuid().optional(),
  invoiceType:           z.enum(['Sale Invoice', 'Debit Note']),
  invoiceDate:           documentDateSchema,
  buyerRegistrationType: z.enum(['Registered', 'Unregistered']),
  buyerNtnCnic:          z.string().trim().transform((s) => s.replace(/[-\s]/g, '')).default(''),
  buyerBusinessName:     z.string().trim().min(2, 'Buyer name is required').max(200),
  buyerProvince:         z.string().trim().min(2, 'Buyer province is required'),
  buyerAddress:          z.string().trim().min(3, 'Buyer address is required').max(300),
  customerId:            z.string().uuid().nullable().optional(),
  invoiceRefNo:          z.string().trim().default(''),
  scenarioId:            z.string().regex(/^SN\d{3}$/, 'Choose a scenario'),
  lines:                 z.array(lineSchema).min(1, 'Add at least one line').max(200),
}).superRefine((v, ctx) => {
  // Spec §4.1: buyer NTN/CNIC is required for Registered, optional for Unregistered.
  if (v.buyerRegistrationType === 'Registered' && !/^(\d{7}|\d{13})$/.test(v.buyerNtnCnic)) {
    ctx.addIssue({ code: 'custom', path: ['buyerNtnCnic'], message: 'Registered buyer needs NTN (7 digits) or CNIC (13 digits)' })
  }
  if (v.buyerRegistrationType === 'Unregistered' && v.buyerNtnCnic && !/^(\d{7}|\d{13})$/.test(v.buyerNtnCnic)) {
    ctx.addIssue({ code: 'custom', path: ['buyerNtnCnic'], message: 'Buyer NTN must be 7 digits or CNIC 13 digits (or leave it blank)' })
  }
  // Debit note must cite the FBR number of the original invoice: 22 chars (NTN) / 28 (CNIC).
  if (v.invoiceType === 'Debit Note' && !/^.{22}$|^.{28}$/.test(v.invoiceRefNo)) {
    ctx.addIssue({ code: 'custom', path: ['invoiceRefNo'], message: 'Debit note needs the original FBR invoice number (22 or 28 characters)' })
  }
  const sc = scenarioById(v.scenarioId)
  if (!sc) ctx.addIssue({ code: 'custom', path: ['scenarioId'], message: 'Unknown scenario' })
  if (sc?.retailPrice) v.lines.forEach((l, i) => {
    if (!(l.retailPrice > 0)) ctx.addIssue({ code: 'custom', path: ['lines', i, 'retailPrice'], message: `Line ${i + 1}: retail price is required for 3rd Schedule goods` })
  })
})

const LOCKED = new Set(['posting', 'posted'])

async function context() {
  const ctx = await requireAuth()
  const tenant = await getTenant(ctx.tenantId)
  if (tenant.subscriptionStatus === 'locked') return { error: { success: false as const, error: 'Account locked', code: 'TENANT_LOCKED' } }
  const admin = createAdminClient()
  const { data: settings } = await admin.from('fbr_settings').select('*').eq('tenant_id', ctx.tenantId).maybeSingle()
  if (!settings?.enabled) return { error: { success: false as const, error: 'FBR Digital Invoicing is not enabled — set it up in Setup → FBR Digital Invoicing', code: 'NOT_ENABLED' } }
  return { ctx, admin, settings }
}

export async function saveFbrInvoiceAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = invoiceSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }
  const c = await context()
  if (c.error) return c.error
  const { ctx: { user, tenantId }, admin, settings } = c
  const v = parsed.data
  const scenario = scenarioById(v.scenarioId)!

  const computed = v.lines.map((l) => ({
    input: l,
    totals: lineTotals(
      { ...l, furtherTaxOverride: l.furtherTaxOverride ?? null },
      { buyer: v.buyerRegistrationType, furtherTaxRate: Number(settings.further_tax_rate), retailPrice: !!scenario.retailPrice },
    ),
  }))
  const totals = invoiceTotals(computed.map((x) => x.totals))

  const header = {
    tenant_id:               tenantId,
    environment:             settings.environment,
    invoice_type:            v.invoiceType,
    invoice_date:            v.invoiceDate,
    buyer_registration_type: v.buyerRegistrationType,
    buyer_ntn_cnic:          v.buyerNtnCnic || null,
    buyer_business_name:     v.buyerBusinessName,
    buyer_province:          v.buyerProvince,
    buyer_address:           v.buyerAddress,
    customer_id:             v.customerId ?? null,
    invoice_ref_no:          v.invoiceType === 'Debit Note' ? v.invoiceRefNo : null,
    scenario_id:             v.scenarioId,
    total_value_excl_st:     totals.value,
    total_sales_tax:         totals.salesTax,
    total_further_tax:       totals.furtherTax,
    total_amount:            totals.total,
    status:                  'draft',
    last_error:              null,
    updated_at:              new Date().toISOString(),
  }

  let id = v.id
  if (id) {
    const { data: existing } = await admin.from('fbr_invoices').select('status').eq('id', id).eq('tenant_id', tenantId).maybeSingle()
    if (!existing) return { success: false, error: 'Invoice not found', code: 'NOT_FOUND' }
    if (LOCKED.has(existing.status)) return { success: false, error: 'This invoice has been posted to FBR and can no longer be changed', code: 'LOCKED' }
    const { error } = await admin.from('fbr_invoices').update(header).eq('id', id).eq('tenant_id', tenantId)
    if (error) return { success: false, error: 'Failed to save the invoice', code: 'INTERNAL_ERROR' }
    await admin.from('fbr_invoice_items').delete().eq('invoice_id', id)
  } else {
    const serial = await nextDocumentSerial(admin, tenantId, 'fbr_invoice', v.invoiceDate)
    const { data: created, error } = await admin.from('fbr_invoices')
      .insert({ ...header, serial_number: serial, created_by: user.id }).select('id').single()
    if (error || !created) return { success: false, error: 'Failed to save the invoice', code: 'INTERNAL_ERROR' }
    id = created.id
  }

  const { error: itemsErr } = await admin.from('fbr_invoice_items').insert(computed.map(({ input: l, totals: t }, i) => ({
    tenant_id:                            tenantId,
    invoice_id:                           id!,
    line_no:                              i + 1,
    hs_code:                              l.hsCode,
    product_description:                  l.productDescription,
    rate:                                 l.rate,
    uom:                                  l.uom,
    quantity:                             l.quantity,
    unit_price:                           l.unitPrice,
    value_sales_excluding_st:             t.valueSalesExcludingST,
    fixed_notified_value_or_retail_price: t.fixedNotifiedValueOrRetailPrice,
    sales_tax_applicable:                 t.salesTaxApplicable,
    sales_tax_withheld_at_source:         l.salesTaxWithheldAtSource,
    extra_tax:                            l.extraTax,
    further_tax:                          t.furtherTax,
    fed_payable:                          l.fedPayable,
    discount:                             l.discount,
    total_values:                         t.totalValues,
    sale_type:                            scenario.saleType,
    sro_schedule_no:                      l.sroScheduleNo || null,
    sro_item_serial_no:                   l.sroItemSerialNo || null,
  })))
  if (itemsErr) {
    if (!v.id) await admin.from('fbr_invoices').delete().eq('id', id!)
    return { success: false, error: `Failed to save the invoice lines: ${itemsErr.message}`, code: 'INTERNAL_ERROR' }
  }

  await createAuditEntry({
    tenantId, userId: user.id, action: v.id ? 'update' : 'create', entity: 'fbr_invoices', entityId: id!,
    after: { ...header, lines: v.lines.length },
  })
  return { success: true, data: { id: id! } }
}

export async function deleteFbrInvoiceAction(id: string): Promise<ActionResult<void>> {
  const c = await context()
  if (c.error) return c.error
  const { ctx: { user, tenantId }, admin } = c
  const { data: inv } = await admin.from('fbr_invoices').select('status, serial_number').eq('id', id).eq('tenant_id', tenantId).maybeSingle()
  if (!inv) return { success: false, error: 'Invoice not found', code: 'NOT_FOUND' }
  if (LOCKED.has(inv.status)) return { success: false, error: 'A posted FBR invoice cannot be deleted — issue a Debit Note instead', code: 'LOCKED' }
  const { error } = await admin.from('fbr_invoices').delete().eq('id', id).eq('tenant_id', tenantId)
  if (error) return { success: false, error: 'Failed to delete', code: 'INTERNAL_ERROR' }
  await createAuditEntry({ tenantId, userId: user.id, action: 'delete', entity: 'fbr_invoices', entityId: id, before: inv })
  return { success: true, data: undefined }
}

async function loadForSending(admin: Admin, tenantId: string, id: string) {
  const [{ data: inv }, { data: items }] = await Promise.all([
    admin.from('fbr_invoices').select('*').eq('id', id).eq('tenant_id', tenantId).maybeSingle(),
    admin.from('fbr_invoice_items').select('*').eq('invoice_id', id).eq('tenant_id', tenantId),
  ])
  return { inv, items: items ?? [] }
}

type SendResult = ActionResult<{ status: string; errors: string[]; fbrInvoiceNumber?: string | null }>

// Dry run: FBR checks the invoice without recording it.
export async function validateFbrInvoiceAction(id: string): Promise<SendResult> {
  const c = await context()
  if (c.error) return c.error
  const { ctx: { tenantId }, admin, settings } = c
  const { inv, items } = await loadForSending(admin, tenantId, id)
  if (!inv) return { success: false, error: 'Invoice not found', code: 'NOT_FOUND' }
  if (LOCKED.has(inv.status)) return { success: false, error: 'Already posted to FBR', code: 'LOCKED' }

  const env = inv.environment as FbrEnv
  const token = await loadToken(admin, tenantId, env).catch(() => null)
  if (!token) return { success: false, error: `No ${env} token saved — add it in Setup → FBR Digital Invoicing`, code: 'NO_TOKEN' }

  const payload = buildFbrPayload(settings, inv, items, env)
  const res = await fbrCall({ admin, tenantId, env, token, method: 'POST', url: FBR_ENDPOINTS.validate(env), payload, fbrInvoiceId: id })
  const verdict = res.ok ? interpretResponse(res.body) : { valid: false, errors: [res.error ?? 'FBR call failed'], invoiceNumber: null, itemNumbers: {} }
  const status = res.ok ? (verdict.valid ? 'valid' : 'invalid') : inv.status

  await admin.from('fbr_invoices').update({
    status,
    last_request:  payload as never,
    last_response: (res.body ?? null) as never,
    last_error:    verdict.errors.join('\n') || null,
    updated_at:    new Date().toISOString(),
  }).eq('id', id)

  return { success: true, data: { status, errors: verdict.errors } }
}

// Records the invoice with FBR. Claimed atomically (status → 'posting') so a
// double click or two tabs can never post the same invoice twice.
export async function postFbrInvoiceAction(id: string): Promise<SendResult> {
  const c = await context()
  if (c.error) return c.error
  const { ctx: { user, tenantId }, admin, settings } = c

  const { data: claimed } = await admin.from('fbr_invoices')
    .update({ status: 'posting', updated_at: new Date().toISOString() })
    .eq('id', id).eq('tenant_id', tenantId).in('status', ['draft', 'valid', 'invalid', 'failed'])
    .select('id')
  if (!claimed?.length) return { success: false, error: 'This invoice is already posted (or being posted)', code: 'LOCKED' }

  const { inv, items } = await loadForSending(admin, tenantId, id)
  const env = inv!.environment as FbrEnv
  const token = await loadToken(admin, tenantId, env).catch(() => null)
  if (!token) {
    await admin.from('fbr_invoices').update({ status: 'failed', last_error: 'No token saved' }).eq('id', id)
    return { success: false, error: `No ${env} token saved — add it in Setup → FBR Digital Invoicing`, code: 'NO_TOKEN' }
  }

  const payload = buildFbrPayload(settings, inv!, items, env)
  const res = await fbrCall({ admin, tenantId, env, token, method: 'POST', url: FBR_ENDPOINTS.post(env), payload, fbrInvoiceId: id })
  const verdict = res.ok ? interpretResponse(res.body) : null
  const posted = !!verdict?.valid && !!verdict.invoiceNumber

  const status = posted ? 'posted' : verdict ? 'invalid' : 'failed'
  const errors = verdict ? verdict.errors : [res.error ?? 'FBR call failed']
  if (!posted && verdict?.valid && !verdict.invoiceNumber) errors.push('FBR accepted the data but returned no invoice number')

  await admin.from('fbr_invoices').update({
    status,
    fbr_invoice_number: posted ? verdict!.invoiceNumber : null,
    fbr_dated:          posted ? ((res.body as { dated?: string }).dated ?? null) : null,
    posted_at:          posted ? new Date().toISOString() : null,
    last_request:       payload as never,
    last_response:      (res.body ?? null) as never,
    last_error:         errors.join('\n') || null,
    updated_at:         new Date().toISOString(),
  }).eq('id', id)

  if (posted) {
    for (const [lineNo, no] of Object.entries(verdict!.itemNumbers)) {
      await admin.from('fbr_invoice_items').update({ fbr_item_invoice_no: no }).eq('invoice_id', id).eq('line_no', Number(lineNo))
    }
    await createAuditEntry({
      tenantId, userId: user.id, action: 'post', entity: 'fbr_invoices', entityId: id,
      after: { environment: env, fbr_invoice_number: verdict!.invoiceNumber },
    })
  }

  return { success: true, data: { status, errors, fbrInvoiceNumber: posted ? verdict!.invoiceNumber : null } }
}

// FBR's registration lookup (reference API 5.12), to confirm a buyer's type.
export async function checkBuyerRegistrationAction(ntnCnic: string): Promise<ActionResult<{ registrationType: string | null; message: string }>> {
  const c = await context()
  if (c.error) return c.error
  const { ctx: { tenantId }, admin, settings } = c
  const regNo = ntnCnic.replace(/[-\s]/g, '')
  if (!/^(\d{7}|\d{13})$/.test(regNo)) return { success: false, error: 'Enter a 7-digit NTN or 13-digit CNIC', code: 'VALIDATION_ERROR' }
  const env = settings.environment as FbrEnv
  const token = await loadToken(admin, tenantId, env).catch(() => null)
  if (!token) return { success: false, error: 'Save your FBR token first', code: 'NO_TOKEN' }

  const res = await fbrCall({ admin, tenantId, env, token, method: 'POST', url: FBR_ENDPOINTS.regType, payload: { Registration_No: regNo } })
  if (!res.ok) return { success: false, error: res.error ?? 'FBR lookup failed', code: 'FBR_ERROR' }
  const body = (res.body ?? {}) as { REGISTRATION_TYPE?: string }
  const type = body.REGISTRATION_TYPE ?? null
  return {
    success: true,
    data: {
      registrationType: type ? (type.toLowerCase() === 'registered' ? 'Registered' : 'Unregistered') : null,
      message: type ? `FBR says: ${type}` : 'FBR returned no registration type',
    },
  }
}

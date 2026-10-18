'use server'

import { z } from 'zod'
import { get } from 'node:https'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import { encryptToken, tokenKeyConfigured } from '@/lib/fbr/crypto'
import { fbrCall, loadToken, FBR_ENDPOINTS } from '@/lib/fbr/client'
import { BUSINESS_ACTIVITIES, SECTORS } from '@/lib/fbr/scenarios'
import { ALL_MODULES, parseTenantFeatures } from '@/lib/modules'
import type { ActionResult } from '@/lib/types'

const ntnCnic = z.string().trim().transform((s) => s.replace(/[-\s]/g, ''))
  .refine((s) => /^(\d{7}|\d{13})$/.test(s), 'NTN must be 7 digits or CNIC 13 digits')

const settingsSchema = z.object({
  enabled:            z.boolean(),
  sellerNtnCnic:      ntnCnic,
  sellerBusinessName: z.string().trim().min(2, 'Business name is required').max(200),
  sellerProvince:     z.string().trim().min(2, 'Province is required'),
  sellerAddress:      z.string().trim().min(3, 'Address is required').max(300),
  businessActivity:   z.enum(BUSINESS_ACTIVITIES),
  sector:             z.enum(SECTORS),
  furtherTaxRate:     z.coerce.number().min(0).max(100),
})

async function ownerContext() {
  const ctx = await requireAuth()
  if (ctx.role !== 'owner') return { error: { success: false as const, error: 'Only owners can change FBR settings', code: 'UNAUTHORIZED' } }
  const tenant = await getTenant(ctx.tenantId)
  if (tenant.subscriptionStatus === 'locked') return { error: { success: false as const, error: 'Account locked', code: 'TENANT_LOCKED' } }
  return { ctx }
}

// Seller identity + business activity. Phase 1 always runs in sandbox.
export async function saveFbrSettingsAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = settingsSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }
  const { ctx, error } = await ownerContext()
  if (error) return error
  const { user, tenantId } = ctx
  const v = parsed.data
  const admin = createAdminClient()

  const { error: upErr } = await admin.from('fbr_settings').upsert({
    tenant_id:            tenantId,
    enabled:              v.enabled,
    environment:          'sandbox',
    seller_ntn_cnic:      v.sellerNtnCnic,
    seller_business_name: v.sellerBusinessName,
    seller_province:      v.sellerProvince,
    seller_address:       v.sellerAddress,
    business_activity:    v.businessActivity,
    sector:               v.sector,
    further_tax_rate:     v.furtherTaxRate,
    updated_at:           new Date().toISOString(),
    updated_by:           user.id,
  }, { onConflict: 'tenant_id' })
  if (upErr) return { success: false, error: 'Failed to save FBR settings', code: 'INTERNAL_ERROR' }

  // Show / hide "FBR Tax Invoices" in the menu with the switch.
  const { data: tenant } = await admin.from('tenants').select('features').eq('id', tenantId).single()
  const features = parseTenantFeatures((tenant as { features?: unknown } | null)?.features)
  if (v.enabled) features.add('fbr_invoices')
  else features.delete('fbr_invoices')
  await admin.from('tenants').update({ features: ALL_MODULES.filter((m) => features.has(m)) }).eq('id', tenantId)

  await createAuditEntry({
    tenantId, userId: user.id, action: 'update', entity: 'fbr_settings', entityId: tenantId,
    after: { ...v, environment: 'sandbox' },
  })
  return { success: true, data: undefined }
}

const tokenSchema = z.object({
  environment: z.literal('sandbox'),
  token:       z.string().trim().min(20, 'That does not look like a PRAL token').max(2000),
})

export async function saveFbrTokenAction(input: unknown): Promise<ActionResult<{ last4: string }>> {
  const parsed = tokenSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }
  const { ctx, error } = await ownerContext()
  if (error) return error
  if (!tokenKeyConfigured()) return { success: false, error: 'Token encryption is not configured on the server', code: 'INTERNAL_ERROR' }

  const token = parsed.data.token.replace(/^Bearer\s+/i, '')
  const last4 = token.slice(-4)
  const admin = createAdminClient()
  const { error: upErr } = await admin.from('fbr_credentials').upsert({
    tenant_id:   ctx.tenantId,
    environment: parsed.data.environment,
    token_enc:   encryptToken(token),
    token_last4: last4,
    updated_at:  new Date().toISOString(),
    updated_by:  ctx.user.id,
  }, { onConflict: 'tenant_id,environment' })
  if (upErr) return { success: false, error: 'Failed to save the token', code: 'INTERNAL_ERROR' }

  // Never the token itself — only that it changed.
  await createAuditEntry({
    tenantId: ctx.tenantId, userId: ctx.user.id, action: 'update', entity: 'fbr_credentials', entityId: ctx.tenantId,
    after: { environment: parsed.data.environment, token_last4: last4 },
  })
  return { success: true, data: { last4 } }
}

/** This server's public IPv4 — the address the taxpayer must whitelist in IRIS. */
function egressIp(): Promise<string | null> {
  return new Promise((resolve) => {
    const req = get('https://api.ipify.org', { family: 4, timeout: 8000 }, (res) => {
      let t = ''
      res.on('data', (c) => { t += c })
      res.on('end', () => resolve(/^\d+\.\d+\.\d+\.\d+$/.test(t.trim()) ? t.trim() : null))
    })
    req.on('timeout', () => req.destroy())
    req.on('error', () => resolve(null))
  })
}

export async function getServerIpAction(): Promise<ActionResult<{ ip: string | null }>> {
  await requireAuth()
  return { success: true, data: { ip: await egressIp() } }
}

// Calls FBR's province and UoM reference APIs with the tenant's token. A 200
// proves the token and the IP whitelisting both work; the lists are cached for
// the invoice form so it uses FBR's exact spellings.
export async function testFbrConnectionAction(): Promise<ActionResult<{ ok: boolean; message: string; ip: string | null }>> {
  const { ctx, error } = await ownerContext()
  if (error) return error
  const { tenantId } = ctx
  const admin = createAdminClient()
  const env = 'sandbox' as const

  const [ip, token] = await Promise.all([egressIp(), loadToken(admin, tenantId, env).catch(() => null)])
  if (!token) return { success: false, error: 'Save your sandbox token first', code: 'VALIDATION_ERROR' }

  const provinces = await fbrCall({ admin, tenantId, env, token, method: 'GET', url: FBR_ENDPOINTS.provinces })
  let message: string
  let cache: Record<string, unknown> | undefined
  if (provinces.ok && Array.isArray(provinces.body)) {
    const uoms = await fbrCall({ admin, tenantId, env, token, method: 'GET', url: FBR_ENDPOINTS.uom })
    cache = {
      provinces: (provinces.body as { stateProvinceDesc?: string }[]).map((p) => p.stateProvinceDesc).filter(Boolean),
      uoms: uoms.ok && Array.isArray(uoms.body)
        ? (uoms.body as { description?: string }[]).map((u) => u.description).filter(Boolean)
        : undefined,
      fetched_at: new Date().toISOString(),
    }
    message = `Connected to FBR. ${(cache.provinces as string[]).length} provinces${cache.uoms ? ` and ${(cache.uoms as string[]).length} units` : ''} loaded.`
  } else {
    message = provinces.error ?? 'FBR did not return the province list'
  }

  await admin.from('fbr_settings').update({
    last_test_at:      new Date().toISOString(),
    last_test_ok:      provinces.ok,
    last_test_message: message,
    ...(cache ? { reference_cache: cache as never } : {}),
  }).eq('tenant_id', tenantId)

  return { success: true, data: { ok: provinces.ok, message, ip } }
}

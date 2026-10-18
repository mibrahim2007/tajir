import 'server-only'
import { request } from 'node:https'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptToken } from './crypto'

/*
 * The one place that talks to FBR / PRAL.
 *
 * PRAL only accepts calls from IP addresses the taxpayer has whitelisted in
 * IRIS, so every call goes out from this server — never from the browser — and
 * is forced onto IPv4: the VPS also has an IPv6 address, and a call leaving on
 * that would come from an address nobody whitelisted.
 *
 * Every call is written to fbr_api_log (request, response, status, timing).
 */

export type FbrEnv = 'sandbox' | 'production'
type Admin = ReturnType<typeof createAdminClient>

const GW = 'https://gw.fbr.gov.pk'
export const FBR_ENDPOINTS = {
  validate: (env: FbrEnv) => `${GW}/di_data/v1/di/validateinvoicedata${env === 'sandbox' ? '_sb' : ''}`,
  post:     (env: FbrEnv) => `${GW}/di_data/v1/di/postinvoicedata${env === 'sandbox' ? '_sb' : ''}`,
  provinces: `${GW}/pdi/v1/provinces`,
  uom:       `${GW}/pdi/v1/uom`,
  regType:   `${GW}/dist/v1/Get_Reg_Type`,
}

export type FbrCallResult = {
  ok: boolean
  status: number | null
  body: unknown
  error?: string
}

function httpsJson(method: 'GET' | 'POST', url: string, token: string, payload?: unknown, timeoutMs = 30_000) {
  return new Promise<{ status: number; text: string }>((resolve, reject) => {
    const data = payload === undefined ? undefined : JSON.stringify(payload)
    const req = request(url, {
      method,
      family: 4,
      timeout: timeoutMs,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    }, (res) => {
      let text = ''
      res.setEncoding('utf8')
      res.on('data', (c) => { text += c })
      res.on('end', () => resolve({ status: res.statusCode ?? 0, text }))
    })
    req.on('timeout', () => req.destroy(new Error(`FBR did not respond within ${timeoutMs / 1000}s`)))
    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })
}

/** Loads and decrypts the tenant's token for an environment, or null. */
export async function loadToken(admin: Admin, tenantId: string, env: FbrEnv): Promise<string | null> {
  const { data } = await admin
    .from('fbr_credentials').select('token_enc').eq('tenant_id', tenantId).eq('environment', env).maybeSingle()
  return data ? decryptToken(data.token_enc) : null
}

export async function fbrCall(params: {
  admin: Admin
  tenantId: string
  env: FbrEnv
  token: string
  method: 'GET' | 'POST'
  url: string
  payload?: unknown
  fbrInvoiceId?: string
}): Promise<FbrCallResult> {
  const { admin, tenantId, env, token, method, url, payload, fbrInvoiceId } = params
  const started = Date.now()
  let result: FbrCallResult
  try {
    const { status, text } = await httpsJson(method, url, token, payload)
    let body: unknown = text
    try { body = text ? JSON.parse(text) : null } catch { /* keep raw text */ }
    result = {
      ok: status >= 200 && status < 300,
      status,
      body,
      error: status === 401
        ? 'FBR refused the token (401). Check the token, and that this server’s IP is whitelisted in IRIS.'
        : status >= 300 ? `FBR returned HTTP ${status}` : undefined,
    }
  } catch (e) {
    result = { ok: false, status: null, body: null, error: e instanceof Error ? e.message : String(e) }
  }

  await admin.from('fbr_api_log').insert({
    tenant_id:      tenantId,
    fbr_invoice_id: fbrInvoiceId ?? null,
    environment:    env,
    method,
    endpoint:       url.replace(GW, ''),
    http_status:    result.status,
    duration_ms:    Date.now() - started,
    request:        (payload ?? null) as never,
    // Reference lists are large and identical for everyone — keep a summary only.
    response:       (Array.isArray(result.body) ? { items: result.body.length } : result.body ?? null) as never,
    error:          result.error ?? null,
  })

  return result
}

// ── Response shape (spec §4.1.3 – 4.2.4) ──
export type FbrValidationResponse = {
  invoiceNumber?: string
  dated?: string
  validationResponse?: {
    statusCode?: string
    status?: string
    errorCode?: string | null
    error?: string | null
    invoiceStatuses?: { itemSNo?: string; statusCode?: string; status?: string; invoiceNo?: string | null; errorCode?: string | null; error?: string | null }[] | null
  }
}

/** Valid only when the header AND every item say "00". */
export function interpretResponse(body: unknown): { valid: boolean; errors: string[]; invoiceNumber: string | null; itemNumbers: Record<number, string> } {
  const r = (body ?? {}) as FbrValidationResponse
  const vr = r.validationResponse
  const errors: string[] = []
  if (!vr) return { valid: false, errors: ['FBR returned no validation response'], invoiceNumber: null, itemNumbers: {} }
  if (vr.statusCode !== '00') errors.push(`${vr.errorCode ? `[${vr.errorCode}] ` : ''}${vr.error || vr.status || 'Invalid'}`)
  const itemNumbers: Record<number, string> = {}
  for (const s of vr.invoiceStatuses ?? []) {
    if (s.statusCode !== '00') errors.push(`Line ${s.itemSNo ?? '?'}: ${s.errorCode ? `[${s.errorCode}] ` : ''}${s.error || s.status || 'Invalid'}`)
    if (s.invoiceNo && s.itemSNo) itemNumbers[Number(s.itemSNo)] = s.invoiceNo
  }
  return { valid: errors.length === 0, errors, invoiceNumber: r.invoiceNumber ?? null, itemNumbers }
}

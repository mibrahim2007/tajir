export const runtime = 'nodejs'

import { requireApiKey, logApiRequest } from '@/lib/api-keys/require-api-key'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildSupplierLedger } from '@/lib/api/v1/party-ledger'
import { parseDateRange, badRequest, ok } from '@/lib/api/v1/params'

// GET /api/v1/suppliers/:id/ledger            scope: ledger:read
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD            optional, inclusive
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiKey(req, 'ledger:read')
  if (!auth.ok) return auth.response
  const { ctx } = auth

  const { from, to, error } = parseDateRange(new URL(req.url))
  if (error) return badRequest(error)

  const { id } = await params
  const ledger = await buildSupplierLedger(createAdminClient(), ctx.tenantId, id, from, to)

  if (!ledger) {
    await logApiRequest(req, ctx, 404)
    return Response.json({ error: 'Supplier not found' }, { status: 404 })
  }

  await logApiRequest(req, ctx, 200, ledger.lines.length)
  const { party, ...rest } = ledger
  return ok({ supplier: party, ...rest })
}

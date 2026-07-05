import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { postGl } from '../_shared/gl.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!tenantId) return new Response('No tenant', { status: 403, headers: corsHeaders })

  const body = await req.json()
  const { customerId, stockItemId, quantity, rate, date, reason, locationId } = body as {
    customerId: string; stockItemId: string; quantity: number; rate: number; date: string; reason?: string; locationId: string
  }

  if (!customerId || !stockItemId || !quantity || !rate || !date || !locationId) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const pkrEquivalent = quantity * rate

  const { data: serialNumber } = await admin.rpc('next_document_serial', {
    p_tenant_id: tenantId, p_doc_type: 'sale_return', p_date: date,
  })

  const { data: ret, error } = await admin.from('sale_returns').insert({
    tenant_id: tenantId, serial_number: serialNumber, customer_id: customerId, stock_item_id: stockItemId,
    quantity: String(quantity), rate: String(rate), currency_code: 'PKR',
    exchange_rate: '1', pkr_equivalent: String(pkrEquivalent), date,
    reason: reason ?? null, location_id: locationId,
  }).select('id').single()

  if (error || !ret) {
    return new Response(JSON.stringify({ error: 'Failed to create sale return' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  await admin.rpc('adjust_inventory_quantity', { p_lot_id: stockItemId, p_delta: quantity })

  await postGl(admin, tenantId, date, 'Sale Return (Mobile)', 'sale_return', ret.id, 'SR', [
    { accountSystemKey: 'accounts_receivable', debit: 0, credit: pkrEquivalent, customerId },
    { accountSystemKey: 'sales_revenue',       debit: pkrEquivalent, credit: 0, customerId },
    { accountSystemKey: 'inventory',           debit: pkrEquivalent, credit: 0, stockItemId },
    { accountSystemKey: 'cogs',                debit: 0, credit: pkrEquivalent, stockItemId },
  ])

  return new Response(JSON.stringify({ success: true, id: ret.id }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})

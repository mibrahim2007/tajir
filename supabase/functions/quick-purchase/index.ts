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
  const { supplierId, stockItemId, quantity, rate, date, locationId, paymentDueDate } = body as {
    supplierId: string; stockItemId: string; quantity: number; rate: number; date: string; locationId: string; paymentDueDate?: string
  }

  if (!supplierId || !stockItemId || !quantity || !rate || !date || !locationId) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const pkrEquivalent = quantity * rate

  const { data: serialNumber } = await admin.rpc('next_document_serial', {
    p_tenant_id: tenantId, p_doc_type: 'purchase_order', p_date: date,
  })

  const { data: order, error } = await admin.from('purchase_orders').insert({
    tenant_id: tenantId, serial_number: serialNumber, supplier_id: supplierId, stock_item_id: stockItemId,
    quantity: String(quantity), rate: String(rate), currency_code: 'PKR',
    exchange_rate: '1', pkr_equivalent: String(pkrEquivalent), advance_paid: '0', date,
    confirmed_at: new Date().toISOString(), location_id: locationId,
    payment_due_date: paymentDueDate ?? null,
  }).select('id').single()

  if (error || !order) {
    return new Response(JSON.stringify({ error: 'Failed to create purchase' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  await admin.rpc('adjust_inventory_quantity', { p_lot_id: stockItemId, p_delta: quantity })

  await postGl(admin, tenantId, date, 'Purchase (Mobile)', 'purchase_order', order.id, 'PI', [
    { accountSystemKey: 'inventory',        debit: pkrEquivalent, credit: 0, stockItemId },
    { accountSystemKey: 'accounts_payable', debit: 0, credit: pkrEquivalent, supplierId },
  ])

  return new Response(JSON.stringify({ success: true, id: order.id }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})

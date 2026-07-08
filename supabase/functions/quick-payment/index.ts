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
  const { supplierId, amount, date, notes } = body as {
    supplierId: string; amount: number; date: string; notes?: string
  }

  if (!supplierId || !amount || !date) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: payment, error } = await admin.from('ap_payments').insert({
    tenant_id: tenantId, supplier_id: supplierId,
    amount: String(amount), currency_code: 'PKR', pkr_equivalent: String(amount),
    payment_method_note: notes ?? 'Mobile', date,
  }).select('id').single()

  if (error || !payment) {
    return new Response(JSON.stringify({ error: 'Failed to record payment' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  await postGl(admin, tenantId, date, `Payment (Mobile)${notes ? ` — ${notes}` : ''}`, 'ap_payment', payment.id, 'PV', [
    { accountSystemKey: 'accounts_payable', debit: amount, credit: 0, supplierId },
    { accountSystemKey: 'cash_in_hand',     debit: 0, credit: amount },
  ])

  return new Response(JSON.stringify({ success: true, id: payment.id }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})

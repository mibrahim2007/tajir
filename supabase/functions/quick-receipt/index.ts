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
  const { customerId, amount, date, notes } = body as {
    customerId: string; amount: number; date: string; notes?: string
  }

  if (!customerId || !amount || !date) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: receipt, error } = await admin.from('ar_receipts').insert({
    tenant_id: tenantId, customer_id: customerId,
    amount: String(amount), currency_code: 'PKR', pkr_equivalent: String(amount),
    payment_method_note: notes ?? 'Mobile', date,
  }).select('id').single()

  if (error || !receipt) {
    return new Response(JSON.stringify({ error: 'Failed to record receipt' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  await postGl(admin, tenantId, date, `Receipt (Mobile)${notes ? ` — ${notes}` : ''}`, 'ar_receipt', receipt.id, 'RC', [
    { accountSystemKey: 'cash_in_hand',       debit: amount, credit: 0 },
    { accountSystemKey: 'accounts_receivable', debit: 0, credit: amount, customerId },
  ])

  return new Response(JSON.stringify({ success: true, id: receipt.id }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})

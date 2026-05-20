import { createClient } from 'jsr:@supabase/supabase-js@2'

// Payment webhook payload shape (adapt to your payment processor's format)
interface WebhookPayload {
  type: 'payment.succeeded' | 'payment.failed' | 'subscription.cancelled'
  tenantId: string
  expiresAt?: string // ISO timestamp, present for succeeded/cancelled
}

const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

Deno.serve(async (req: Request) => {
  // Verify webhook signature
  const signature = req.headers.get('x-webhook-signature')
  if (!signature || signature !== WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  let payload: WebhookPayload
  try {
    payload = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const { type, tenantId, expiresAt } = payload
  if (!tenantId) {
    return new Response('Missing tenantId', { status: 400 })
  }

  // Use service_role key to bypass RLS
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  let newStatus: string
  let newExpiresAt: string | null

  switch (type) {
    case 'payment.succeeded':
      newStatus = 'active'
      newExpiresAt = expiresAt ?? null
      break
    case 'payment.failed':
      newStatus = 'grace_period'
      // Grace period expires 7 days from now
      newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      break
    case 'subscription.cancelled':
      newStatus = 'cancelled'
      // Data retention window: 90 days from cancellation
      newExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
      break
    default:
      return new Response('Unknown event type', { status: 400 })
  }

  const { error } = await supabase
    .from('tenants')
    .update({
      subscription_status: newStatus,
      subscription_expires_at: newExpiresAt,
    })
    .eq('id', tenantId)

  if (error) {
    console.error('Failed to update tenant:', error)
    return new Response('Internal server error', { status: 500 })
  }

  // Audit the transition
  await supabase.from('audit_log').insert({
    tenant_id: tenantId,
    user_id: '00000000-0000-0000-0000-000000000000', // system actor
    action: 'subscription_transition',
    entity: 'tenants',
    entity_id: tenantId,
    before: null,
    after: { subscription_status: newStatus, subscription_expires_at: newExpiresAt },
  })

  return new Response(JSON.stringify({ ok: true, status: newStatus }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})

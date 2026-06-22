import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { CreateGatepassForm } from './create-gatepass-form'

export default async function NewGatepassPage() {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const [
    { data: rawLots },
    { count: gpCount },
  ] = await Promise.all([
    admin.from('inventory_lots').select('id, name, count').eq('tenant_id', tenantId).order('name'),
    admin.from('gatepasses').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
  ])

  const nextGpNumber = `GP-${String((gpCount ?? 0) + 1).padStart(4, '0')}`
  const lots = (rawLots ?? []).map((l) => ({ id: l.id, name: l.name, count: String(l.count ?? 0) }))

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">New Gatepass</h1>
        <p className="text-sm text-muted-foreground mt-1">Issue a gatepass for goods in or out.</p>
      </div>
      <CreateGatepassForm today={today} nextGpNumber={nextGpNumber} lots={lots} />
    </div>
  )
}

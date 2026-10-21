import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { PageHeader } from '@/components/page-header'
import { GradesManager } from './grades-manager'

export default async function GradesPage() {
  const { tenantId, role } = await requireAuth()
  const admin = createAdminClient()
  const { data } = await admin
    .from('grades').select('id, name').eq('tenant_id', tenantId)
    .order('sort_order').order('name')

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <PageHeader
        title="Grades"
        subtitle="Quality grades (e.g. AA-Even, A-Uneven) for items whose item type tracks grade"
      />
      <GradesManager grades={data ?? []} isOwner={role === 'owner'} />
    </div>
  )
}

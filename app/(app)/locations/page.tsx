import Link from 'next/link'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { PageHeader } from '@/components/page-header'
import { TableCard, Th, Td, EmptyState } from '@/components/table-card'
import { Button } from '@/components/ui/button'
import { formatPKTDate } from '@/lib/utils/dates'
import { LocationActions } from './location-actions'

export default async function LocationsPage() {
  const { tenantId, role } = await requireAuth()
  const admin = createAdminClient()
  const isOwner = role === 'owner'

  const { data: locations } = await admin
    .from('locations')
    .select('id, name, address, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Locations"
        subtitle="Warehouses, shops, or storage points"
        action={isOwner ? (
          <Link href="/locations/new">
            <Button size="sm" className="min-h-[36px]">+ Add Location</Button>
          </Link>
        ) : undefined}
      />
      <TableCard>
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <Th>Location</Th>
              <Th>Address</Th>
              <Th>Created</Th>
              {isOwner && <Th className="w-20" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(locations ?? []).length === 0 ? (
              <tr>
                <td colSpan={isOwner ? 4 : 3}>
                  <EmptyState message="No locations yet. Add one to start tracking stock by location." />
                </td>
              </tr>
            ) : (locations ?? []).map((loc) => (
              <tr key={loc.id} className="hover:bg-secondary/50 transition-colors">
                <Td strong>{loc.name}</Td>
                <Td muted>{loc.address ?? '—'}</Td>
                <Td muted>{formatPKTDate(loc.created_at)}</Td>
                {isOwner && <Td><LocationActions id={loc.id} name={loc.name} /></Td>}
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
    </div>
  )
}

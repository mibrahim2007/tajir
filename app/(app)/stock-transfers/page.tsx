import Link from 'next/link'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { PageHeader } from '@/components/page-header'
import { TableCard, Th, Td, EmptyState } from '@/components/table-card'
import { Button } from '@/components/ui/button'
import { formatPKTDate } from '@/lib/utils/dates'

export default async function StockTransfersPage() {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()

  const { data: transfers } = await admin
    .from('stock_transfers')
    .select('id, date, quantity, notes, from_location_id, to_location_id, stock_item_id, created_at')
    .eq('tenant_id', tenantId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  const [{ data: locs }, { data: items }] = await Promise.all([
    admin.from('locations').select('id, name').eq('tenant_id', tenantId),
    admin.from('inventory_lots').select('id, name').eq('tenant_id', tenantId),
  ])

  const locMap  = new Map((locs  ?? []).map(l => [l.id, l.name]))
  const itemMap = new Map((items ?? []).map(i => [i.id, i.name]))

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Stock Transfers"
        subtitle="Move stock between locations"
        action={
          <Link href="/stock-transfers/new">
            <Button size="sm" className="min-h-[36px]">+ New Transfer</Button>
          </Link>
        }
      />
      <TableCard>
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <Th>Date</Th>
              <Th>Item</Th>
              <Th>From</Th>
              <Th>To</Th>
              <Th right>Quantity</Th>
              <Th>Notes</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(transfers ?? []).length === 0 ? (
              <tr>
                <td colSpan={6}><EmptyState message="No stock transfers yet." /></td>
              </tr>
            ) : (transfers ?? []).map((t) => (
              <tr key={t.id} className="hover:bg-secondary/50 transition-colors">
                <Td muted>{formatPKTDate(t.date as string)}</Td>
                <Td strong>{itemMap.get(t.stock_item_id as string) ?? '—'}</Td>
                <Td>{locMap.get(t.from_location_id as string) ?? '—'}</Td>
                <Td>{locMap.get(t.to_location_id as string) ?? '—'}</Td>
                <Td right mono>{t.quantity.toLocaleString('en-PK')}</Td>
                <Td muted>{(t.notes as string | null) ?? '—'}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
    </div>
  )
}

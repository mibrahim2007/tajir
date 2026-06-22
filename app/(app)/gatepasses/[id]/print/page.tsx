import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'
import { PrintButton } from './print-button'
import { formatPKTDate } from '@/lib/utils/dates'

export default async function PrintGatepassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()

  const { data: gatepass } = await admin
    .from('gatepasses')
    .select('id, gatepass_number, type, date, vehicle_number, driver_name, remarks')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!gatepass) notFound()

  const { data: rawItems } = await admin
    .from('gatepass_items')
    .select('id, stock_item_id, quantity')
    .eq('gatepass_id', id)
    .order('created_at')

  const items = rawItems ?? []

  /* Resolve stock item names in one batch */
  const stockItemIds = [...new Set(items.map(i => i.stock_item_id).filter(Boolean))] as string[]
  const { data: rawLots } = stockItemIds.length > 0
    ? await admin.from('inventory_lots').select('id, name').in('id', stockItemIds)
    : { data: [] }

  const lotMap = new Map((rawLots ?? []).map(l => [l.id, l.name]))

  const gpNumber = gatepass.gatepass_number || gatepass.id.slice(0, 8).toUpperCase()
  const totalQty = items.reduce((s, i) => s + Number(i.quantity ?? 0), 0)

  return (
    <div className="min-h-screen bg-white">
      {/* Toolbar — hidden when printing */}
      <div className="print:hidden flex items-center gap-3 px-6 py-4 border-b bg-background sticky top-0">
        <Link href="/gatepasses">
          <Button variant="ghost" size="sm">← Back</Button>
        </Link>
        <span className="text-sm text-muted-foreground flex-1">Gatepass #{gpNumber}</span>
        <PrintButton />
      </div>

      {/* Printable document */}
      <div className="max-w-2xl mx-auto px-8 py-10 print:px-0 print:py-0 print:max-w-none">

        {/* Header */}
        <div className="text-center mb-8 border-b-2 border-black pb-4">
          <h1 className="text-3xl font-bold tracking-widest uppercase">Gatepass</h1>
        </div>

        {/* Meta row */}
        <div className="flex justify-between mb-6 text-sm flex-wrap gap-2">
          <div>
            <span className="text-muted-foreground print:text-gray-500">No: </span>
            <span className="font-mono font-semibold">{gpNumber}</span>
          </div>
          <div>
            <span className="text-muted-foreground print:text-gray-500">Date: </span>
            <span className="font-semibold">{formatPKTDate(new Date(gatepass.date))}</span>
          </div>
          <div>
            <span className="text-muted-foreground print:text-gray-500">Type: </span>
            <span className="font-semibold capitalize">
              {gatepass.type === 'purchase' ? 'Inward (Purchase)' : 'Outward (Sale)'}
            </span>
          </div>
        </div>

        {/* Vehicle / Driver / Remarks */}
        {(gatepass.vehicle_number || gatepass.driver_name || gatepass.remarks) && (
          <table className="w-full text-sm mb-6 border border-gray-300">
            <tbody>
              {gatepass.vehicle_number && <Row label="Vehicle No." value={gatepass.vehicle_number} />}
              {gatepass.driver_name    && <Row label="Driver"      value={gatepass.driver_name} />}
              {gatepass.remarks        && <Row label="Remarks"     value={gatepass.remarks} />}
            </tbody>
          </table>
        )}

        {/* Items table */}
        <table className="w-full text-sm mb-8 border border-gray-300">
          <thead className="bg-gray-50 print:bg-gray-100">
            <tr>
              <th className="text-left px-3 py-2 border-b border-r border-gray-300 font-semibold text-[11px] uppercase tracking-wide w-8">#</th>
              <th className="text-left px-3 py-2 border-b border-r border-gray-300 font-semibold text-[11px] uppercase tracking-wide">Stock Item</th>
              <th className="text-right px-3 py-2 border-b border-gray-300 font-semibold text-[11px] uppercase tracking-wide w-28">Quantity</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={item.id} className="border-b border-gray-200 last:border-0">
                <td className="px-3 py-2.5 border-r border-gray-200 text-muted-foreground print:text-gray-500 tabular-nums">{i + 1}</td>
                <td className="px-3 py-2.5 border-r border-gray-200">
                  {item.stock_item_id ? (lotMap.get(item.stock_item_id) ?? '—') : '—'}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {item.quantity != null ? Number(item.quantity).toLocaleString(undefined, { maximumFractionDigits: 3 }) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-gray-300 bg-gray-50 print:bg-gray-100">
            <tr>
              <td colSpan={2} className="px-3 py-2 text-right font-semibold text-[11px] uppercase tracking-wide border-r border-gray-300">Total</td>
              <td className="px-3 py-2 text-right font-bold tabular-nums">
                {totalQty.toLocaleString(undefined, { maximumFractionDigits: 3 })}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Signature section */}
        <div className="flex justify-between mt-16 pt-4 text-sm text-center">
          <div className="w-40">
            <div className="border-t border-black pt-2 text-muted-foreground print:text-gray-500">Gate Officer</div>
          </div>
          <div className="w-40">
            <div className="border-t border-black pt-2 text-muted-foreground print:text-gray-500">Driver</div>
          </div>
          <div className="w-40">
            <div className="border-t border-black pt-2 text-muted-foreground print:text-gray-500">Authorized By</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-gray-200 last:border-0">
      <td className="px-4 py-2.5 font-medium text-muted-foreground print:text-gray-500 w-36 bg-gray-50 print:bg-gray-100 border-r border-gray-200">
        {label}
      </td>
      <td className="px-4 py-2.5">{value}</td>
    </tr>
  )
}

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
    .select('id, type, date, entry_date, vehicle_number, driver_name, remarks, purchase_order_id, sales_order_id')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!gatepass) notFound()

  const [
    { data: rawSuppliers },
    { data: rawCustomers },
    { data: rawLots },
    { data: rawPurchase },
    { data: rawSale },
  ] = await Promise.all([
    admin.from('suppliers').select('id, name').eq('tenant_id', tenantId),
    admin.from('tajir_customers').select('id, name').eq('tenant_id', tenantId),
    admin.from('inventory_lots').select('id, name').eq('tenant_id', tenantId),
    gatepass.purchase_order_id
      ? admin.from('purchase_orders').select('supplier_id, stock_item_id, quantity').eq('id', gatepass.purchase_order_id).single()
      : Promise.resolve({ data: null }),
    gatepass.sales_order_id
      ? admin.from('sales_orders').select('customer_id, stock_item_id, quantity').eq('id', gatepass.sales_order_id).single()
      : Promise.resolve({ data: null }),
  ])

  const supplierMap = new Map((rawSuppliers ?? []).map((s) => [s.id, s.name]))
  const customerMap = new Map((rawCustomers ?? []).map((c) => [c.id, c.name]))
  const lotMap     = new Map((rawLots ?? []).map((l) => [l.id, l.name]))

  let partyLabel = ''
  let partyName  = '—'
  let itemName   = '—'
  let quantity   = '—'

  if (gatepass.type === 'purchase' && rawPurchase) {
    partyLabel = 'Supplier'
    partyName  = supplierMap.get(rawPurchase.supplier_id) ?? '—'
    itemName   = lotMap.get(rawPurchase.stock_item_id) ?? '—'
    quantity   = String(rawPurchase.quantity)
  } else if (gatepass.type === 'sale' && rawSale) {
    partyLabel = 'Customer'
    partyName  = customerMap.get(rawSale.customer_id) ?? '—'
    itemName   = lotMap.get(rawSale.stock_item_id) ?? '—'
    quantity   = String(rawSale.quantity)
  }

  const gpNumber = gatepass.id.slice(0, 8).toUpperCase()

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
        <div className="flex justify-between mb-8 text-sm">
          <div>
            <span className="text-muted-foreground print:text-gray-500">No: </span>
            <span className="font-mono font-semibold">{gpNumber}</span>
          </div>
          <div>
            <span className="text-muted-foreground print:text-gray-500">Gatepass Date: </span>
            <span className="font-semibold">{formatPKTDate(new Date(gatepass.date))}</span>
          </div>
          <div>
            <span className="text-muted-foreground print:text-gray-500">Type: </span>
            <span className="font-semibold capitalize">{gatepass.type}</span>
          </div>
        </div>

        {/* Details grid */}
        <table className="w-full text-sm mb-8 border border-gray-300">
          <tbody>
            <Row label={partyLabel || 'Party'} value={partyName} />
            <Row label="Stock Item"             value={itemName} />
            <Row label="Quantity"               value={quantity} />
            <Row label="Entry Date"             value={formatPKTDate(new Date(gatepass.entry_date))} />
            <Row label="Vehicle No."            value={gatepass.vehicle_number} />
            <Row label="Driver"                 value={gatepass.driver_name} />
            {gatepass.remarks && <Row label="Remarks" value={gatepass.remarks} />}
          </tbody>
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

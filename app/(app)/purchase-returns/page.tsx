import Link from 'next/link'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'
import { DeleteButton } from '@/components/delete-button'
import { RoleGate } from '@/components/role-gate'
import { deletePurchaseReturnAction } from '@/app/actions/delete-purchase-return'
import { EditPurchaseReturnForm } from './edit-purchase-return-form'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'

export default async function PurchaseReturnsPage() {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()

  const [{ data: rawReturns }, { data: rawSuppliers }, { data: rawLots }, { data: rawLocs }] = await Promise.all([
    admin.from('purchase_returns')
      .select('id, serial_number, date, quantity, rate, currency_code, exchange_rate, pkr_equivalent, supplier_id, stock_item_id, purchase_order_id, reason, location_id')
      .eq('tenant_id', tenantId)
      .order('date', { ascending: false })
      .limit(200),
    admin.from('suppliers').select('id, name').eq('tenant_id', tenantId).order('name'),
    admin.from('inventory_lots').select('id, name, unit_of_measure').eq('tenant_id', tenantId).order('name'),
    admin.from('locations').select('id, name').eq('tenant_id', tenantId).order('name'),
  ])

  const returns = rawReturns ?? []
  const supplierList = rawSuppliers ?? []
  const supplierMap = new Map(supplierList.map((s) => [s.id, s.name]))
  const lotList = (rawLots ?? []).map((l) => ({ id: l.id, name: l.name, unitOfMeasure: l.unit_of_measure ?? null }))
  const lotMap = new Map(lotList.map((l) => [l.id, l.name]))
  const locationList = rawLocs ?? []
  const locationMap = new Map(locationList.map((l) => [l.id, l.name]))

  const rowActions = (r: (typeof returns)[number]) => (
    <RoleGate allowedRoles={['owner']}>
      <div className="flex items-center gap-1">
        <EditPurchaseReturnForm
          ret={{ id: r.id, supplierId: r.supplier_id, stockItemId: r.stock_item_id, quantity: r.quantity, rate: r.rate, currencyCode: r.currency_code, exchangeRate: r.exchange_rate, date: r.date, reason: r.reason ?? null, locationId: r.location_id ?? null }}
          suppliers={supplierList}
          lots={lotList}
          locations={locationList}
        />
        <DeleteButton
          description="Delete this purchase return? Stock quantity will be restored."
          onDelete={deletePurchaseReturnAction.bind(null, { id: r.id })}
        />
      </div>
    </RoleGate>
  )

  return (
    <div className="p-3 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Purchase Returns</h1>
          <p className="text-sm text-muted-foreground mt-1">{returns.length} record{returns.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/purchase-returns/new">
          <Button className="min-h-[44px]">New Purchase Return</Button>
        </Link>
      </div>

      {returns.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed py-16 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">No purchase returns yet.</p>
        </div>
      ) : (
        <>
          {/* Mobile (< md): stacked cards — everything fits, actions always visible */}
          <div className="md:hidden divide-y divide-border rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            {returns.map((r) => (
              <div key={r.id} className="p-4 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium tabular-nums break-words">{r.serial_number ?? '—'}</div>
                    <div className="text-xs text-muted-foreground">{formatPKTDate(new Date(r.date))}</div>
                  </div>
                  <div className="shrink-0">{rowActions(r)}</div>
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">Supplier</dt>
                  <dd className="text-right break-words">{supplierMap.get(r.supplier_id) ?? '—'}</dd>
                  <dt className="text-muted-foreground">Item</dt>
                  <dd className="text-right break-words">{lotMap.get(r.stock_item_id) ?? '—'} × {r.quantity}</dd>
                  <dt className="text-muted-foreground">Rate</dt>
                  <dd className="text-right tabular-nums">{r.currency_code} {r.rate}</dd>
                  <dt className="text-muted-foreground">Amount</dt>
                  <dd className="text-right font-semibold tabular-nums">{formatPKR(r.pkr_equivalent)}</dd>
                  {r.location_id && (
                    <>
                      <dt className="text-muted-foreground">Location</dt>
                      <dd className="text-right break-words">{locationMap.get(r.location_id) ?? '—'}</dd>
                    </>
                  )}
                  {r.reason && (
                    <>
                      <dt className="text-muted-foreground">Reason</dt>
                      <dd className="text-right break-words">{r.reason}</dd>
                    </>
                  )}
                </dl>
              </div>
            ))}
          </div>

          {/* Desktop (>= md): table. px-2 keeps it inside the page width; Rate/Location/Reason appear at xl. */}
          <div className="max-md:hidden bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-2 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Serial #</th>
                  <th className="text-left px-2 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Date</th>
                  <th className="text-left px-2 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Supplier</th>
                  <th className="text-left px-2 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Item</th>
                  <th className="text-right px-2 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Qty</th>
                  <th className="max-xl:hidden text-right px-2 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Rate</th>
                  <th className="text-right px-2 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">PKR Total</th>
                  <th className="max-xl:hidden text-left px-2 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Location</th>
                  <th className="max-xl:hidden text-left px-2 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Reason</th>
                  <th className="px-2 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {returns.map((r) => (
                  <tr key={r.id} className="hover:bg-secondary/50 transition-colors align-top">
                    <td className="px-2 py-3 font-medium tabular-nums whitespace-nowrap">{r.serial_number ?? '—'}</td>
                    <td className="px-2 py-3 whitespace-nowrap">{formatPKTDate(new Date(r.date))}</td>
                    <td className="px-2 py-3 break-words">{supplierMap.get(r.supplier_id) ?? '—'}</td>
                    <td className="px-2 py-3 break-words">{lotMap.get(r.stock_item_id) ?? '—'}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{r.quantity}</td>
                    <td className="max-xl:hidden px-2 py-3 text-right tabular-nums whitespace-nowrap">{r.currency_code} {r.rate}</td>
                    <td className="px-2 py-3 text-right tabular-nums whitespace-nowrap">{formatPKR(r.pkr_equivalent)}</td>
                    <td className="max-xl:hidden px-2 py-3 text-muted-foreground text-xs break-words">{r.location_id ? locationMap.get(r.location_id) ?? '—' : '—'}</td>
                    <td className="max-xl:hidden px-2 py-3 text-muted-foreground text-xs break-words">{r.reason ?? '—'}</td>
                    <td className="px-2 py-3">{rowActions(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

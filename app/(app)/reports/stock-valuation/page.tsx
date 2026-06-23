import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { PrintButton } from '@/components/print-button'
import { getTenant } from '@/lib/auth/get-tenant'

export default async function StockValuationPage() {
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()

  const [
    { data: rawLots },
    { data: rawPurchases },
    tenant,
  ] = await Promise.all([
    admin
      .from('inventory_lots')
      .select('id, name, code, count, current_quantity, opening_rate, item_type_id, item_types(name)')
      .eq('tenant_id', tenantId)
      .order('name'),
    admin
      .from('purchase_orders')
      .select('stock_item_id, rate, currency_code, exchange_rate, date')
      .eq('tenant_id', tenantId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false }),
    getTenant(tenantId),
  ])

  // Build latest purchase rate per lot (first match = most recent)
  const latestPurchaseRate = new Map<string, { pkrRate: number; date: string }>()
  for (const p of (rawPurchases ?? [])) {
    const id = p.stock_item_id as string
    if (!latestPurchaseRate.has(id)) {
      const r  = parseFloat(String(p.rate))
      const er = parseFloat(String(p.exchange_rate ?? 1))
      latestPurchaseRate.set(id, {
        pkrRate: (p.currency_code as string) === 'USD' ? r * er : r,
        date: p.date as string,
      })
    }
  }

  const parse = (v: unknown) => parseFloat(String(v ?? 0)) || 0

  const rows = (rawLots ?? []).map(lot => {
    const qty         = parse(lot.current_quantity)
    const openingRate = parse(lot.opening_rate)
    const purchased   = latestPurchaseRate.get(lot.id as string)
    const effectiveRate = purchased ? purchased.pkrRate : openingRate
    const rateSource  = purchased ? 'purchase' : (openingRate > 0 ? 'opening' : 'none')
    const value       = qty * effectiveRate
    const typeName    = Array.isArray(lot.item_types)
      ? (lot.item_types[0] as { name: string } | undefined)?.name ?? '—'
      : (lot.item_types as { name: string } | null)?.name ?? '—'
    return { id: String(lot.id), name: String(lot.name), code: lot.code ? String(lot.code) : null, count: lot.count ? String(lot.count) : null, typeName, qty, effectiveRate, rateSource, value }
  })

  const withStock  = rows.filter(r => r.qty > 0)
  const totalValue = withStock.reduce((s, r) => s + r.value, 0)
  const totalQty   = withStock.reduce((s, r) => s + r.qty, 0)

  const printDate = new Date().toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' })

  function fmtPKR(n: number) {
    return n.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  function fmtQty(n: number) {
    return n.toLocaleString('en-PK', { maximumFractionDigits: 3 })
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Toolbar — hidden on print */}
      <div className="print:hidden flex items-center gap-3 px-6 py-4 border-b sticky top-0 bg-background z-10">
        <div className="flex-1">
          <h1 className="text-xl font-bold">Stock Valuation</h1>
          <p className="text-xs text-muted-foreground">
            {withStock.length} item{withStock.length !== 1 ? 's' : ''} in stock
            &nbsp;·&nbsp; Rate from latest purchase (fallback: opening rate)
          </p>
        </div>
        <PrintButton />
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 print:px-0 print:py-0 print:max-w-none">

        {/* Print header */}
        <div className="hidden print:block text-center mb-6 pb-4 border-b-2 border-black">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">{tenant.name}</p>
          <h1 className="text-2xl font-bold">Stock Valuation Report</h1>
          <p className="text-xs text-gray-500 mt-1">As of {printDate}</p>
        </div>

        {withStock.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center print:hidden">
            <p className="text-muted-foreground text-sm">No stock on hand.</p>
          </div>
        ) : (
          <>
            {/* Summary cards — screen only */}
            <div className="print:hidden grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Items in Stock</p>
                <p className="text-2xl font-extrabold tabular-nums">{withStock.length}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Total Qty</p>
                <p className="text-2xl font-extrabold tabular-nums">{fmtQty(totalQty)}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 shadow-sm col-span-2 md:col-span-1">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Total Value (PKR)</p>
                <p className="text-2xl font-extrabold tabular-nums text-primary">Rs {fmtPKR(totalValue)}</p>
              </div>
            </div>

            <div className="rounded-lg border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 print:bg-gray-100 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-[11px] uppercase tracking-wide">#</th>
                      <th className="text-left px-4 py-3 font-semibold text-[11px] uppercase tracking-wide">Item</th>
                      <th className="text-left px-4 py-3 font-semibold text-[11px] uppercase tracking-wide">Count</th>
                      <th className="text-left px-4 py-3 font-semibold text-[11px] uppercase tracking-wide">Type</th>
                      <th className="text-right px-4 py-3 font-semibold text-[11px] uppercase tracking-wide">Qty</th>
                      <th className="text-right px-4 py-3 font-semibold text-[11px] uppercase tracking-wide">Rate (PKR)</th>
                      <th className="text-right px-4 py-3 font-semibold text-[11px] uppercase tracking-wide">Value (PKR)</th>
                      <th className="text-center px-4 py-3 font-semibold text-[11px] uppercase tracking-wide print:hidden">Rate Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {withStock.map((row, i) => (
                      <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground tabular-nums text-xs">{i + 1}</td>
                        <td className="px-4 py-3 font-medium">{row.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{row.count ?? '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{row.typeName}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{fmtQty(row.qty)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {row.effectiveRate > 0 ? fmtPKR(row.effectiveRate) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold">
                          {row.value > 0 ? fmtPKR(row.value) : <span className="text-muted-foreground font-normal">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center print:hidden">
                          {row.rateSource === 'purchase' && (
                            <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">Purchase</span>
                          )}
                          {row.rateSource === 'opening' && (
                            <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800">Opening</span>
                          )}
                          {row.rateSource === 'none' && (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 bg-muted/30 print:bg-gray-100">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-muted-foreground print:text-gray-600">Total</td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums">{fmtQty(totalQty)}</td>
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3 text-right font-extrabold tabular-nums text-primary print:text-black">
                        Rs {fmtPKR(totalValue)}
                      </td>
                      <td className="print:hidden" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Print footer */}
            <div className="hidden print:flex justify-between mt-8 pt-4 border-t border-gray-300 text-xs text-gray-400">
              <span>Tajir · {tenant.name}</span>
              <span>Printed: {printDate}</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

'use client'

import { Fragment } from 'react'
import { MapPin, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StockOpeningForm } from './stock-opening-form'

/** One warehouse's share of an item's opening stock. */
export type OpeningLine = { locationId: string; locationName: string; quantity: number; rate: number }
export type OpeningLot  = { id: string; name: string; lines: OpeningLine[] }
export type LocationOption = { id: string; name: string }

function fmt(n: number) {
  return n.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 4 })
}

function fmtPKR(n: number) {
  return n.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function lotQty(lot: OpeningLot) {
  return lot.lines.reduce((s, l) => s + l.quantity, 0)
}

function lotValue(lot: OpeningLot) {
  return lot.lines.reduce((s, l) => s + l.quantity * l.rate, 0)
}

export function StockBalanceTable({ lots, locations }: { lots: OpeningLot[]; locations: LocationOption[] }) {
  if (lots.length === 0) {
    return <p className="text-sm text-muted-foreground">No stock items yet. Add items from the Inventory page first.</p>
  }

  const grandValue = lots.reduce((s, l) => s + lotValue(l), 0)

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Item / Location</th>
              <th className="text-right px-4 py-3 font-medium">Quantity</th>
              <th className="text-right px-4 py-3 font-medium">Rate (PKR)</th>
              <th className="text-right px-4 py-3 font-medium">Value (PKR)</th>
              <th className="px-4 py-3 w-16" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {lots.map((lot) => {
              const qty   = lotQty(lot)
              const value = lotValue(lot)
              // The weighted average is what the item's fallback valuation rate
              // becomes, so show that rather than any single line's rate.
              const avgRate = qty > 0 ? value / qty : 0

              return (
                <Fragment key={lot.id}>
                  <tr className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      {lot.name}
                      {lot.lines.length > 1 && (
                        <span className="ml-2 text-xs text-muted-foreground font-normal">
                          {lot.lines.length} locations
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {lot.lines.length > 0 ? fmt(qty) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {avgRate > 0 ? fmt(avgRate) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">
                      {value > 0 ? fmtPKR(value) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <StockOpeningForm
                        lot={lot}
                        locations={locations}
                        trigger={
                          <Button size="sm" variant="ghost" className="min-h-[44px]" aria-label={`Set opening stock for ${lot.name}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        }
                      />
                    </td>
                  </tr>

                  {/* Per-warehouse breakdown, only worth the rows once it exists. */}
                  {lot.lines.map((line) => (
                    <tr key={`${lot.id}-${line.locationId}`} className="bg-muted/20 text-xs text-muted-foreground">
                      <td className="pl-10 pr-4 py-2">
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3 w-3" />
                          {line.locationName}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{fmt(line.quantity)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{line.rate > 0 ? fmt(line.rate) : '—'}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {line.quantity * line.rate > 0 ? fmtPKR(line.quantity * line.rate) : '—'}
                      </td>
                      <td />
                    </tr>
                  ))}
                </Fragment>
              )
            })}
          </tbody>
          {grandValue > 0 && (
            <tfoot className="border-t-2 bg-muted/30">
              <tr>
                <td colSpan={3} className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-muted-foreground">Total Value</td>
                <td className="px-4 py-3 text-right font-bold tabular-nums">{fmtPKR(grandValue)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { setStockOpeningBalance } from '@/app/actions/set-opening-balance'

type Lot = { id: string; name: string; currentQuantity: string; openingRate: string }

function fmt(n: string | number) {
  return parseFloat(String(n)).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 4 })
}

function fmtPKR(n: number) {
  return n.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export function StockBalanceTable({ lots }: { lots: Lot[] }) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editQty, setEditQty]   = useState('')
  const [editRate, setEditRate] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (lots.length === 0) {
    return <p className="text-sm text-muted-foreground">No stock items yet. Add items from the Inventory page first.</p>
  }

  const startEdit = (lot: Lot) => {
    setEditingId(lot.id)
    setEditQty(parseFloat(lot.currentQuantity).toString())
    setEditRate(parseFloat(lot.openingRate).toString())
    setError(null)
  }

  const save = (lotId: string) => {
    startTransition(async () => {
      setError(null)
      const result = await setStockOpeningBalance({ lotId, quantity: editQty, rate: editRate })
      if (!result.success) { setError(result.error); return }
      setEditingId(null)
      router.refresh()
    })
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Item</th>
              <th className="text-right px-4 py-3 font-medium">Quantity</th>
              <th className="text-right px-4 py-3 font-medium">Rate (PKR)</th>
              <th className="text-right px-4 py-3 font-medium">Value (PKR)</th>
              <th className="px-4 py-3 w-16" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {lots.map((lot) => {
              const qty  = parseFloat(lot.currentQuantity) || 0
              const rate = parseFloat(lot.openingRate) || 0
              const val  = qty * rate
              const isEditing = editingId === lot.id
              return (
                <tr key={lot.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{lot.name}</td>

                  {/* Quantity */}
                  <td className="px-4 py-3 text-right tabular-nums">
                    {isEditing ? (
                      <Input
                        type="number" min={0} step="0.001"
                        value={editQty}
                        onChange={(e) => setEditQty(e.target.value)}
                        className="w-32 ml-auto text-right"
                        autoFocus
                      />
                    ) : fmt(qty)}
                  </td>

                  {/* Rate */}
                  <td className="px-4 py-3 text-right tabular-nums">
                    {isEditing ? (
                      <Input
                        type="number" min={0} step="0.01"
                        value={editRate}
                        onChange={(e) => setEditRate(e.target.value)}
                        className="w-36 ml-auto text-right"
                      />
                    ) : (rate > 0 ? fmt(rate) : <span className="text-muted-foreground">—</span>)}
                  </td>

                  {/* Value */}
                  <td className="px-4 py-3 text-right tabular-nums font-medium">
                    {isEditing
                      ? <span className="text-muted-foreground text-xs">auto</span>
                      : (val > 0 ? fmtPKR(val) : <span className="text-muted-foreground">—</span>)
                    }
                  </td>

                  {/* Edit / Save */}
                  <td className="px-4 py-3 text-right">
                    {isEditing ? (
                      <Button size="sm" variant="ghost" className="min-h-[44px]" onClick={() => save(lot.id)} disabled={isPending}>
                        <Check className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" className="min-h-[44px]" onClick={() => startEdit(lot)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
          {/* Totals */}
          {lots.some(l => parseFloat(l.openingRate) > 0) && (
            <tfoot className="border-t-2 bg-muted/30">
              <tr>
                <td colSpan={3} className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-muted-foreground">Total Value</td>
                <td className="px-4 py-3 text-right font-bold tabular-nums">
                  {fmtPKR(lots.reduce((s, l) => s + (parseFloat(l.currentQuantity) || 0) * (parseFloat(l.openingRate) || 0), 0))}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {error && <p className="text-sm text-destructive px-4 py-2 border-t">{error}</p>}
    </div>
  )
}

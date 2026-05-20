'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { setStockOpeningBalance } from '@/app/actions/set-opening-balance'

type Lot = { id: string; name: string; currentQuantity: string }

export function StockBalanceTable({ lots }: { lots: Lot[] }) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (lots.length === 0) {
    return <p className="text-sm text-muted-foreground">No stock items yet. Add items from the Inventory page first.</p>
  }

  const startEdit = (lot: Lot) => {
    setEditingId(lot.id)
    setEditValue(parseFloat(lot.currentQuantity).toString())
    setError(null)
  }

  const save = (lotId: string) => {
    startTransition(async () => {
      setError(null)
      const result = await setStockOpeningBalance({ lotId, quantity: editValue })
      if (!result.success) { setError(result.error); return }
      setEditingId(null)
      router.refresh()
    })
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 border-b">
          <tr>
            <th className="text-left px-4 py-3 font-medium">Item</th>
            <th className="text-right px-4 py-3 font-medium">Quantity</th>
            <th className="px-4 py-3 w-20" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {lots.map((lot) => (
            <tr key={lot.id} className="hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3 font-medium">{lot.name}</td>
              <td className="px-4 py-3 text-right tabular-nums">
                {editingId === lot.id ? (
                  <Input
                    type="number"
                    min={0}
                    step="0.001"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-32 ml-auto text-right"
                    autoFocus
                  />
                ) : (
                  parseFloat(lot.currentQuantity).toLocaleString()
                )}
              </td>
              <td className="px-4 py-3 text-right">
                {editingId === lot.id ? (
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
          ))}
        </tbody>
      </table>
      {error && <p className="text-sm text-destructive px-4 py-2 border-t">{error}</p>}
    </div>
  )
}

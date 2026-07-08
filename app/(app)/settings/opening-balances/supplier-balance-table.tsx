'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { setSupplierOpeningBalance } from '@/app/actions/set-opening-balance'
import { formatPKR } from '@/lib/utils/currency'

type Supplier = { id: string; name: string; openingBalance: number; openingBalanceCurrency: string; openingBalancePkrEquivalent: number }

export function SupplierBalanceTable({ suppliers }: { suppliers: Supplier[] }) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [editCurrency, setEditCurrency] = useState<'PKR' | 'USD'>('PKR')
  const [editRate, setEditRate] = useState('1')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (suppliers.length === 0) {
    return <p className="text-sm text-muted-foreground">No suppliers yet. Add suppliers from the Suppliers page first.</p>
  }

  const startEdit = (s: Supplier) => {
    setEditingId(s.id)
    setEditAmount(s.openingBalance.toString())
    setEditCurrency((s.openingBalanceCurrency || 'PKR') as 'PKR' | 'USD')
    setEditRate('1')
    setError(null)
  }

  const save = (supplierId: string) => {
    startTransition(async () => {
      setError(null)
      const result = await setSupplierOpeningBalance({ supplierId, openingBalance: editAmount, currencyCode: editCurrency, exchangeRate: editRate })
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
            <th className="text-left px-4 py-3 font-medium">Supplier</th>
            <th className="text-right px-4 py-3 font-medium">Opening Balance (PKR)</th>
            <th className="px-4 py-3 w-20" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {suppliers.map((s) => (
            <tr key={s.id} className="hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3 font-medium">{s.name}</td>
              <td className="px-4 py-3 text-right tabular-nums">
                {editingId === s.id ? (
                  <div className="flex items-center gap-2 justify-end">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="w-28 text-right"
                      autoFocus
                    />
                    <Select value={editCurrency} onValueChange={(v) => setEditCurrency(v as 'PKR' | 'USD')}>
                      <SelectTrigger className="w-20 min-h-[44px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PKR">PKR</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                      </SelectContent>
                    </Select>
                    {editCurrency === 'USD' && (
                      <Input
                        type="number"
                        min={1}
                        step="0.01"
                        value={editRate}
                        onChange={(e) => setEditRate(e.target.value)}
                        className="w-24 text-right"
                        placeholder="Rate"
                      />
                    )}
                  </div>
                ) : (
                  formatPKR(s.openingBalancePkrEquivalent)
                )}
              </td>
              <td className="px-4 py-3 text-right">
                {editingId === s.id ? (
                  <Button size="sm" variant="ghost" className="min-h-[44px]" onClick={() => save(s.id)} disabled={isPending}>
                    <Check className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" className="min-h-[44px]" onClick={() => startEdit(s)}>
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

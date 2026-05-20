'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { setCustomerOpeningBalance } from '@/app/actions/set-opening-balance'
import { formatPKR } from '@/lib/utils/currency'

type Customer = { id: string; name: string; openingBalance: string; openingBalanceCurrency: string; openingBalancePkrEquivalent: string }

export function CustomerBalanceTable({ customers }: { customers: Customer[] }) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [editCurrency, setEditCurrency] = useState<'PKR' | 'USD'>('PKR')
  const [editRate, setEditRate] = useState('1')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (customers.length === 0) {
    return <p className="text-sm text-muted-foreground">No customers yet. Add customers from the Customers page first.</p>
  }

  const startEdit = (c: Customer) => {
    setEditingId(c.id)
    setEditAmount(parseFloat(c.openingBalance).toString())
    setEditCurrency((c.openingBalanceCurrency || 'PKR') as 'PKR' | 'USD')
    setEditRate('1')
    setError(null)
  }

  const save = (customerId: string) => {
    startTransition(async () => {
      setError(null)
      const result = await setCustomerOpeningBalance({ customerId, openingBalance: editAmount, currencyCode: editCurrency, exchangeRate: editRate })
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
            <th className="text-left px-4 py-3 font-medium">Customer</th>
            <th className="text-right px-4 py-3 font-medium">Opening Balance (PKR)</th>
            <th className="px-4 py-3 w-20" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {customers.map((c) => (
            <tr key={c.id} className="hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3 font-medium">{c.name}</td>
              <td className="px-4 py-3 text-right tabular-nums">
                {editingId === c.id ? (
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
                  formatPKR(parseFloat(c.openingBalancePkrEquivalent))
                )}
              </td>
              <td className="px-4 py-3 text-right">
                {editingId === c.id ? (
                  <Button size="sm" variant="ghost" className="min-h-[44px]" onClick={() => save(c.id)} disabled={isPending}>
                    <Check className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" className="min-h-[44px]" onClick={() => startEdit(c)}>
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

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createBankAction } from '@/app/actions/create-bank'
import { deleteBankAction } from '@/app/actions/delete-bank'
import { setBankOpeningBalanceAction } from '@/app/actions/set-bank-opening-balance'
import { formatPKR } from '@/lib/utils/currency'
import { Check, Pencil, Trash2, X } from 'lucide-react'

type Bank = { id: string; name: string; account_number: string | null; branch: string | null; opening_balance: number }

export function BanksClient({ banks: initial }: { banks: Bank[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [branch, setBranch] = useState('')
  const [openingBalance, setOpeningBalance] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBalance, setEditBalance] = useState('')

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      setError(null)
      const result = await createBankAction({ name, accountNumber, branch, openingBalance: openingBalance || 0 })
      if (!result.success) { setError(result.error); return }
      setName(''); setAccountNumber(''); setBranch(''); setOpeningBalance('')
      router.refresh()
    })
  }

  const handleDelete = (id: string) => {
    startTransition(async () => {
      await deleteBankAction({ id })
      router.refresh()
    })
  }

  const startEdit = (b: Bank) => {
    setEditingId(b.id)
    setEditBalance(String(b.opening_balance ?? 0))
    setError(null)
  }

  const saveEdit = (id: string) => {
    startTransition(async () => {
      setError(null)
      const result = await setBankOpeningBalanceAction({ id, openingBalance: editBalance || 0 })
      if (!result.success) { setError(result.error); return }
      setEditingId(null)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Add Bank</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Bank Name <span className="text-destructive">*</span></Label>
                <Input placeholder="e.g. HBL" value={name} onChange={e => setName(e.target.value)} className="min-h-[44px]" required />
              </div>
              <div className="space-y-1">
                <Label>Account Number</Label>
                <Input placeholder="e.g. 0123-4567890-01" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} className="min-h-[44px]" />
              </div>
              <div className="space-y-1">
                <Label>Branch</Label>
                <Input placeholder="e.g. Faisalabad Main" value={branch} onChange={e => setBranch(e.target.value)} className="min-h-[44px]" />
              </div>
              <div className="space-y-1">
                <Label>Opening Balance (PKR)</Label>
                <Input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={openingBalance}
                  onChange={e => setOpeningBalance(e.target.value)}
                  className="min-h-[44px] text-right"
                />
                <p className="text-xs text-muted-foreground">Balance before Tajir. Seeds the Bank Statement.</p>
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={isPending} className="self-start min-h-[44px]">
              {isPending ? 'Saving…' : 'Add Bank'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {initial.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left pb-2 font-medium">Name</th>
                    <th className="text-left pb-2 font-medium">Account No.</th>
                    <th className="text-left pb-2 font-medium">Branch</th>
                    <th className="text-right pb-2 font-medium">Opening Balance</th>
                    <th className="w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {initial.map((b) => (
                    <tr key={b.id}>
                      <td className="py-2.5 font-medium">{b.name}</td>
                      <td className="py-2.5 text-muted-foreground">{b.account_number ?? '—'}</td>
                      <td className="py-2.5 text-muted-foreground">{b.branch ?? '—'}</td>
                      <td className="py-2.5 text-right tabular-nums">
                        {editingId === b.id ? (
                          <Input
                            type="number"
                            step="0.01"
                            inputMode="decimal"
                            value={editBalance}
                            onChange={e => setEditBalance(e.target.value)}
                            className="w-32 h-9 text-right ml-auto"
                            autoFocus
                          />
                        ) : (
                          formatPKR(b.opening_balance ?? 0)
                        )}
                      </td>
                      <td className="py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          {editingId === b.id ? (
                            <>
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => saveEdit(b.id)}
                                className="text-muted-foreground hover:text-emerald-600 p-1"
                                title="Save opening balance"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => setEditingId(null)}
                                className="text-muted-foreground hover:text-foreground p-1"
                                title="Cancel"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => startEdit(b)}
                                className="text-muted-foreground hover:text-foreground p-1"
                                title="Edit opening balance"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => handleDelete(b.id)}
                                className="text-muted-foreground hover:text-destructive p-1"
                                title="Delete bank"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

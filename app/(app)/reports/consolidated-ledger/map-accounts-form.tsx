'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Link2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createPartyLinkAction } from '@/app/actions/create-party-link'

type Party = { id: string; name: string }

export function MapAccountsForm({ customers, suppliers }: { customers: Party[]; suppliers: Party[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [customerId, setCustomerId] = useState<string>('')
  const [supplierId, setSupplierId] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Convenience: when a customer is picked, auto-suggest a same-named supplier
  // (unless the user already chose one). The tables are separate, so a party
  // that both buys and sells usually exists once in each under the same name.
  const suppliersByName = useMemo(
    () => new Map(suppliers.map((s) => [s.name.trim().toLowerCase(), s.id])),
    [suppliers],
  )

  const onCustomerChange = (id: string) => {
    setCustomerId(id)
    if (!supplierId) {
      const match = customers.find((c) => c.id === id)
      const suggested = match ? suppliersByName.get(match.name.trim().toLowerCase()) : undefined
      if (suggested) setSupplierId(suggested)
    }
  }

  const reset = () => {
    setCustomerId('')
    setSupplierId('')
    setError(null)
  }

  const onSubmit = () => {
    if (!customerId || !supplierId) {
      setError('Select both a customer and a supplier')
      return
    }
    startTransition(async () => {
      setError(null)
      const result = await createPartyLinkAction({ customerId, supplierId })
      if (!result.success) {
        setError(result.error)
        return
      }
      setOpen(false)
      reset()
      router.refresh()
    })
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset() }}>
      <SheetTrigger asChild>
        <Button size="sm" className="min-h-[40px]">
          <Plus className="h-4 w-4 mr-1" />Map Accounts
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Map Customer to Supplier</SheetTitle>
          <SheetDescription>
            Link a customer account to its supplier counterpart to consolidate their ledgers into one net statement.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Customer <span className="text-destructive">*</span></label>
            <Select value={customerId || undefined} onValueChange={onCustomerChange} disabled={customers.length === 0}>
              <SelectTrigger className="min-h-[44px]">
                <SelectValue placeholder={customers.length === 0 ? 'No customers' : 'Select customer…'} />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-center text-muted-foreground">
            <Link2 className="h-5 w-5" />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Supplier <span className="text-destructive">*</span></label>
            <Select value={supplierId || undefined} onValueChange={setSupplierId} disabled={suppliers.length === 0}>
              <SelectTrigger className="min-h-[44px]">
                <SelectValue placeholder={suppliers.length === 0 ? 'No suppliers' : 'Select supplier…'} />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button onClick={onSubmit} className="w-full min-h-[44px]" disabled={isPending}>
            {isPending ? 'Mapping…' : 'Map Accounts'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

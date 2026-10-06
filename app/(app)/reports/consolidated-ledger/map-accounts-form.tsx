'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createPartyLinkAction } from '@/app/actions/create-party-link'

type Party = { id: string; name: string }

const RETURN_PATH = '/reports/consolidated-ledger'

// Full-page form at /reports/consolidated-ledger/map (was a drawer on the
// Consolidated Ledger index).
export function MapAccountsForm({ customers, suppliers }: { customers: Party[]; suppliers: Party[] }) {
  const router = useRouter()
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

  // Summary values (display only)
  const customerName = customers.find((c) => c.id === customerId)?.name
  const supplierName = suppliers.find((s) => s.id === supplierId)?.name

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
      // Back to the index, which re-renders with the new mapping. No
      // router.refresh() inside the transition — it keeps isPending stuck.
      router.push(RETURN_PATH)
    })
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">

      {/* ── FORM (left on xl) ── */}
      <Card className="min-w-0">
        <CardHeader className="pb-3 pt-5 px-5">
          <CardTitle className="text-base">Accounts to Map</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-5 flex flex-col gap-2">
            <label className="text-sm font-medium">Customer <span className="text-destructive">*</span></label>
            <Select value={customerId || undefined} onValueChange={onCustomerChange} disabled={customers.length === 0}>
              <SelectTrigger className="min-h-[44px] w-full">
                <SelectValue placeholder={customers.length === 0 ? 'No customers' : 'Select customer…'} />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2 flex justify-center items-center min-h-[44px] text-muted-foreground">
            <Link2 className="h-5 w-5" />
          </div>

          <div className="md:col-span-5 flex flex-col gap-2">
            <label className="text-sm font-medium">Supplier <span className="text-destructive">*</span></label>
            <Select value={supplierId || undefined} onValueChange={setSupplierId} disabled={suppliers.length === 0}>
              <SelectTrigger className="min-h-[44px] w-full">
                <SelectValue placeholder={suppliers.length === 0 ? 'No suppliers' : 'Select supplier…'} />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ── SUMMARY (right on xl, sticky) ── */}
      <div className="xl:sticky xl:top-6">
        <Card>
          <CardContent className="px-5 pt-5 pb-5">
            <p className="font-extrabold text-[15px] tracking-tight mb-4">Mapping Summary</p>
            <div className="space-y-2 text-sm mb-5">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Customer</span>
                <span className="font-medium text-right truncate">{customerName ?? '—'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Supplier</span>
                <span className="font-medium text-right truncate">{supplierName ?? '—'}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Button onClick={onSubmit} className="w-full min-h-[44px]" disabled={isPending}>
                {isPending ? 'Mapping…' : 'Map Accounts'}
              </Button>
              <Button type="button" variant="outline" className="w-full min-h-[44px]" onClick={() => router.push(RETURN_PATH)}>
                Cancel
              </Button>
            </div>

            {error && <p className="text-sm text-destructive mt-3">{error}</p>}
          </CardContent>
        </Card>
      </div>

    </div>
  )
}

'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { createSupplierAction } from '@/app/actions/create-supplier'
import { createCustomerAction } from '@/app/actions/create-customer'
import { createInventoryLotAction } from '@/app/actions/create-inventory-lot'
import type { PickerItem } from '@/components/item-picker-dialog'

const inputCls =
  'mt-1 flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'

// ── Supplier ─────────────────────────────────────────────────────────────────

type QuickCreateProps = {
  onSuccess: (item: PickerItem) => void
  onCancel:  () => void
}

export function QuickCreateSupplier({ onSuccess, onCancel }: QuickCreateProps) {
  const [name, setName]       = useState('')
  const [isPending, start]    = useTransition()
  const [error, setError]     = useState<string | null>(null)

  const submit = () => {
    if (!name.trim()) { setError('Name is required'); return }
    start(async () => {
      setError(null)
      const result = await createSupplierAction({
        name: name.trim(), openingBalance: 0, openingBalanceCurrency: 'PKR', exchangeRate: 1,
      })
      if (!result.success) { setError(result.error); return }
      onSuccess({ id: result.data.id, name: name.trim() })
    })
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium">Supplier Name <span className="text-destructive">*</span></label>
        <input
          autoFocus
          className={inputCls}
          placeholder="e.g. Ali Traders"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
        />
      </div>
      <p className="text-xs text-muted-foreground">Opening balance can be set later from the Suppliers page.</p>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2 justify-end pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="button" size="sm" disabled={isPending} onClick={submit}>
          {isPending ? 'Creating…' : 'Create Supplier'}
        </Button>
      </div>
    </div>
  )
}

// ── Customer ──────────────────────────────────────────────────────────────────

export function QuickCreateCustomer({ onSuccess, onCancel }: QuickCreateProps) {
  const [name, setName]       = useState('')
  const [isPending, start]    = useTransition()
  const [error, setError]     = useState<string | null>(null)

  const submit = () => {
    if (!name.trim()) { setError('Name is required'); return }
    start(async () => {
      setError(null)
      const result = await createCustomerAction({
        name: name.trim(), openingBalance: 0, openingBalanceCurrency: 'PKR', exchangeRate: 1,
      })
      if (!result.success) { setError(result.error); return }
      onSuccess({ id: result.data.id, name: name.trim() })
    })
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium">Customer Name <span className="text-destructive">*</span></label>
        <input
          autoFocus
          className={inputCls}
          placeholder="e.g. Raza Fabrics"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
        />
      </div>
      <p className="text-xs text-muted-foreground">Opening balance can be set later from the Customers page.</p>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2 justify-end pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="button" size="sm" disabled={isPending} onClick={submit}>
          {isPending ? 'Creating…' : 'Create Customer'}
        </Button>
      </div>
    </div>
  )
}

// ── Inventory Lot (Stock Item) ────────────────────────────────────────────────

export function QuickCreateLot({ onSuccess, onCancel }: QuickCreateProps) {
  const [name, setName]       = useState('')
  const [count, setCount]     = useState('')
  const [isPending, start]    = useTransition()
  const [error, setError]     = useState<string | null>(null)

  const submit = () => {
    if (!name.trim()) { setError('Name is required'); return }
    start(async () => {
      setError(null)
      const result = await createInventoryLotAction({ name: name.trim(), count: count.trim() || undefined })
      if (!result.success) { setError(result.error); return }
      onSuccess({ id: result.data.id, name: name.trim(), badge: count.trim() || undefined })
    })
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium">Item Name <span className="text-destructive">*</span></label>
        <input
          autoFocus
          className={inputCls}
          placeholder="e.g. Super Fine Yarn"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <label className="text-sm font-medium">Count / Grade <span className="text-destructive">*</span></label>
        <input
          className={inputCls}
          placeholder="e.g. 30s, 40s, 60s"
          value={count}
          onChange={(e) => setCount(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
        />
      </div>
      <p className="text-xs text-muted-foreground">Additional details (fiber, lot no.) can be added from Inventory.</p>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2 justify-end pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="button" size="sm" disabled={isPending} onClick={submit}>
          {isPending ? 'Creating…' : 'Create Item'}
        </Button>
      </div>
    </div>
  )
}

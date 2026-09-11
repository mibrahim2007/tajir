'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Layers, Warehouse, Package, Check, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { ensureItemTypeAction } from '@/app/actions/ensure-item-type'
import { createItemTypeAction } from '@/app/actions/create-item-type'
import { createLocationAction } from '@/app/actions/create-location'
import { createInventoryLotAction } from '@/app/actions/create-inventory-lot'
import { ITEM_TYPE_PRESETS, unitsForType, DEFAULT_UNITS } from '@/app/(app)/inventory/item-type-presets'
import {
  StepHeader, Why, AlreadyHave,
  useDraftRows, SaveRowsButton, DraftGrid, DraftRowShell, Cell, cellInput, enterToNext,
} from './wizard-ui'
import type { SetupData } from './setup-types'

/* ── 3. Item categories ──────────────────────────────────────────────────── */

export function CategoriesStep({ data }: { data: SetupData }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [busyPreset, setBusyPreset] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [custom, setCustom] = useState('')
  const [subTypes, setSubTypes] = useState('')

  const tops = data.itemTypes.filter((t) => !t.parentId)
  const existing = new Set(tops.map((t) => t.name.toLowerCase()))
  const subsOf = (id: string) => data.itemTypes.filter((t) => t.parentId === id).map((t) => t.name)

  const addPreset = (name: string) => {
    setBusyPreset(name)
    startTransition(async () => {
      setError(null)
      const res = await ensureItemTypeAction({ name })
      if (!res.success) setError(res.error)
      setBusyPreset(null)
      router.refresh()
    })
  }

  const addCustom = (e: React.FormEvent) => {
    e.preventDefault()
    if (!custom.trim()) return
    startTransition(async () => {
      setError(null)
      const subs = subTypes.split(',').map((s) => s.trim()).filter(Boolean)
      const res = await createItemTypeAction({ name: custom.trim(), subTypes: subs })
      if (!res.success) { setError(res.error); return }
      setCustom(''); setSubTypes('')
      router.refresh()
    })
  }

  return (
    <div>
      <StepHeader
        icon={Layers}
        title="Item Categories"
        description="Group your stock so reports, filters and the Stock by Category chart make sense."
        href="/item-types"
      />
      <Why>
        Every stock item belongs to a category (Yarn, Greige, Fabric…). Sub-types are optional
        — <em>Yarn → Cotton, Polyester</em> — and let you split a category further without
        renaming items later. Pick the presets that match your trade, then add anything unusual.
      </Why>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Common categories — tap to add</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ITEM_TYPE_PRESETS.map((p) => {
              const has = existing.has(p.name.toLowerCase())
              const busy = busyPreset === p.name
              return (
                <button
                  key={p.name}
                  type="button"
                  disabled={has || isPending}
                  onClick={() => addPreset(p.name)}
                  className={cn(
                    'text-left rounded-xl border px-3 py-2.5 transition-all',
                    has
                      ? 'border-emerald-500/40 bg-emerald-500/5 cursor-default'
                      : 'border-border bg-card hover:border-primary/50 hover:bg-secondary/60',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{p.name}</span>
                    {has ? <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                      : busy ? <span className="text-[10px] text-muted-foreground">Adding…</span>
                      : <Plus className="h-4 w-4 text-muted-foreground shrink-0" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{p.description}</p>
                </button>
              )
            })}
          </div>

          <form onSubmit={addCustom} className="bg-card rounded-2xl border border-border shadow-sm p-4 mt-4 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Custom category</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Name <span className="text-destructive">*</span></Label>
                <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="e.g. Packing Material" className="min-h-[44px]" />
              </div>
              <div className="space-y-1">
                <Label>Sub-types <span className="text-muted-foreground font-normal">(optional, comma-separated)</span></Label>
                <Input value={subTypes} onChange={(e) => setSubTypes(e.target.value)} placeholder="e.g. Cotton, Polyester, Blend" className="min-h-[44px]" />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={isPending || !custom.trim()} className="min-h-[44px]">
              {isPending && !busyPreset ? 'Adding…' : 'Add Category'}
            </Button>
          </form>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden self-start">
          <div className="px-4 py-3 border-b border-border bg-muted/40 flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Your categories · {tops.length}</p>
            <Link href="/item-types" className="text-[11px] font-semibold text-primary hover:underline">Manage →</Link>
          </div>
          {tops.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">Nothing yet — pick a preset on the left.</p>
          ) : (
            <ul className="divide-y divide-border">
              {tops.map((t) => {
                const subs = subsOf(t.id)
                return (
                  <li key={t.id} className="px-4 py-2.5">
                    <p className="text-sm font-semibold flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500" />{t.name}</p>
                    {subs.length > 0 && (
                      <p className="text-xs text-muted-foreground pl-[22px] mt-0.5">└ {subs.join(', ')}</p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── 4. Warehouses ───────────────────────────────────────────────────────── */

type LocationDraft = { name: string; address: string }
const blankLocation = (): LocationDraft => ({ name: '', address: '' })

export function WarehousesStep({ data }: { data: SetupData }) {
  const draft = useDraftRows(blankLocation, data.counts.locations === 0 ? 2 : 1)

  return (
    <div>
      <StepHeader
        icon={Warehouse}
        title="Warehouses"
        description="Godowns, shops or any place stock physically sits."
        href="/locations"
      />
      <Why>
        Opening stock, transfers and the Location-wise Stock report are all per warehouse.
        Even a single-godown business needs one — call it <em>Main Godown</em>. Add more
        if you keep stock at a shop, a factory or a customer&apos;s premises.
      </Why>
      <AlreadyHave label="Warehouses" names={data.locations.map((l) => l.name)} total={data.counts.locations} href="/locations" />

      {data.counts.locations === 0 && draft.rows.every((r) => !r.name) && (
        <button
          type="button"
          onClick={() => draft.update(draft.rows[0]._key, { name: 'Main Godown' })}
          className="mb-3 text-xs font-semibold text-primary hover:underline"
        >
          Use “Main Godown” as the first warehouse
        </button>
      )}

      <DraftGrid
        columns={[{ label: 'Warehouse name', required: true, width: '40%' }, { label: 'Address / area' }]}
        onAdd={draft.add}
        addLabel="Add another warehouse"
        minWidth={520}
      >
        {draft.rows.map((r) => (
          <DraftRowShell key={r._key} error={r._error} onRemove={() => draft.remove(r._key)}>
            <Cell><input className={cellInput} placeholder="e.g. Main Godown" value={r.name} onChange={(e) => draft.update(r._key, { name: e.target.value })} onKeyDown={enterToNext} /></Cell>
            <Cell><input className={cellInput} placeholder="e.g. Jhang Road, Faisalabad" value={r.address} onChange={(e) => draft.update(r._key, { address: e.target.value })} onKeyDown={enterToNext} /></Cell>
          </DraftRowShell>
        ))}
      </DraftGrid>

      <SaveRowsButton
        label="Save Warehouses"
        savedLabel={(n) => `${n} warehouse${n === 1 ? '' : 's'} saved.`}
        args={{
          rows: draft.rows, setRows: draft.setRows, blank: blankLocation,
          isBlank: (r) => !r.name.trim() && !r.address.trim(),
          validate: (r) => (r.name.trim() ? null : 'Name is required'),
          create: (r) => createLocationAction({ name: r.name.trim(), address: r.address.trim() || undefined }),
        }}
      />
    </div>
  )
}

/* ── 5. Stock items ──────────────────────────────────────────────────────── */

type ItemDraft = { name: string; itemTypeId: string; count: string; unit: string; code: string }
const blankItem = (): ItemDraft => ({ name: '', itemTypeId: '', count: '', unit: '', code: '' })

export function ItemsStep({ data }: { data: SetupData }) {
  const draft = useDraftRows(blankItem, 4)
  const tops = data.itemTypes.filter((t) => !t.parentId)
  const byParent = new Map<string, typeof tops>()
  for (const t of data.itemTypes) {
    if (t.parentId) byParent.set(t.parentId, [...(byParent.get(t.parentId) ?? []), t])
  }
  const typeName = (id: string) => {
    const t = data.itemTypes.find((x) => x.id === id)
    if (!t) return ''
    return t.parentId ? (data.itemTypes.find((x) => x.id === t.parentId)?.name ?? t.name) : t.name
  }

  return (
    <div>
      <StepHeader
        icon={Package}
        title="Stock Items"
        description="The products you buy and sell — one row per item, with its count or grade."
        href="/inventory"
      />
      <Why>
        Each item gets a scannable code (TJR-000123) automatically. Fill in the name and category;
        count/grade (30s, 40s…) and the unit help pickers and reports. Opening quantities per
        warehouse are set in the final step. Service items like freight recharge can be added from
        the Inventory page.
      </Why>
      {data.counts.itemTypes === 0 && (
        <p className="mb-4 text-sm text-amber-600 dark:text-amber-400">
          No categories yet — items can still be saved, but go back and add at least one category so they can be grouped.
        </p>
      )}
      <AlreadyHave
        label="Items"
        names={data.recentItems.map((i) => (i.count ? `${i.name} · ${i.count}` : i.name))}
        total={data.counts.items}
        href="/inventory"
      />

      <DraftGrid
        columns={[
          { label: 'Item name', required: true, width: '30%' },
          { label: 'Category', width: '20%' },
          { label: 'Count / grade', width: '14%' },
          { label: 'Unit', width: '14%' },
          { label: 'Code / ref' },
        ]}
        onAdd={draft.add}
        addLabel="Add another item"
        minWidth={760}
      >
        {draft.rows.map((r) => {
          const units = r.itemTypeId ? unitsForType(typeName(r.itemTypeId)) : [...DEFAULT_UNITS]
          return (
            <DraftRowShell key={r._key} error={r._error} onRemove={() => draft.remove(r._key)}>
              <Cell><input className={cellInput} placeholder="e.g. Super Fine Cotton Yarn" value={r.name} onChange={(e) => draft.update(r._key, { name: e.target.value })} onKeyDown={enterToNext} /></Cell>
              <Cell>
                <select className={cellInput} value={r.itemTypeId} onChange={(e) => draft.update(r._key, { itemTypeId: e.target.value, unit: '' })} onKeyDown={enterToNext}>
                  <option value="">— none —</option>
                  {tops.map((t) => {
                    const subs = byParent.get(t.id) ?? []
                    return subs.length === 0
                      ? <option key={t.id} value={t.id}>{t.name}</option>
                      : <optgroup key={t.id} label={t.name}>{subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>
                  })}
                </select>
              </Cell>
              <Cell><input className={cellInput} placeholder="30s, 40s…" value={r.count} onChange={(e) => draft.update(r._key, { count: e.target.value })} onKeyDown={enterToNext} /></Cell>
              <Cell>
                <select className={cellInput} value={r.unit} onChange={(e) => draft.update(r._key, { unit: e.target.value })} onKeyDown={enterToNext}>
                  <option value="">—</option>
                  {units.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </Cell>
              <Cell><input className={cellInput} placeholder="optional" value={r.code} onChange={(e) => draft.update(r._key, { code: e.target.value })} onKeyDown={enterToNext} /></Cell>
            </DraftRowShell>
          )
        })}
      </DraftGrid>

      <SaveRowsButton
        label="Save Items"
        savedLabel={(n) => `${n} item${n === 1 ? '' : 's'} saved.`}
        args={{
          rows: draft.rows, setRows: draft.setRows, blank: blankItem,
          isBlank: (r) => !r.name.trim() && !r.count.trim() && !r.code.trim(),
          validate: (r) => (r.name.trim() ? null : 'Item name is required'),
          create: (r) => createInventoryLotAction({
            name: r.name.trim(),
            itemNature: 'inventory',
            itemTypeId: r.itemTypeId || undefined,
            count: r.count.trim() || undefined,
            unitOfMeasure: r.unit || undefined,
            code: r.code.trim() || undefined,
          }),
        }}
      />
    </div>
  )
}

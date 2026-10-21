'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { ItemTypeOption } from '@/components/item-type-select-items'
import { createSubTypeAction } from '@/app/actions/create-sub-type'

const ADD_VALUE = '__add_sub_type__'

// The parent (Item Type) of a picked sub-type, for the read-only Item Type field.
export function parentTypeOf(itemTypes: ItemTypeOption[], id: string | null | undefined): ItemTypeOption | undefined {
  const t = itemTypes.find((x) => x.id === id)
  if (!t) return undefined
  return t.parentId ? itemTypes.find((x) => x.id === t.parentId) : t
}

// Mandatory Sub Type list for a stock item: every item type's sub-types,
// grouped under the type, plus "+ Add sub type…" to create one on the spot.
// The item is saved against the sub-type; its Item Type is the parent.
//
// keepSelectableId: an existing item still assigned to a top-level type stays
// selectable (shown as "<type> (no sub type)") so editing it doesn't lose the value.
export function SubTypeSelect({
  itemTypes,
  value,
  onChange,
  onSubTypeCreated,
  keepSelectableId,
  className = 'min-h-[44px] w-full',
  invalid = false,
}: {
  itemTypes: ItemTypeOption[]
  value: string | undefined
  onChange: (id: string) => void
  onSubTypeCreated?: (type: ItemTypeOption) => void
  keepSelectableId?: string | null
  className?: string
  invalid?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [parentId, setParentId] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, start] = useTransition()

  const tops = itemTypes.filter((t) => !t.parentId).sort((a, b) => a.name.localeCompare(b.name))
  const subsOf = (id: string) => itemTypes.filter((t) => t.parentId === id).sort((a, b) => a.name.localeCompare(b.name))
  const kept = keepSelectableId ? itemTypes.find((t) => t.id === keepSelectableId && !t.parentId) : undefined
  const hasSubs = itemTypes.some((t) => t.parentId)

  const openDialog = () => {
    // Pre-pick the current item type, if any, as the new sub type's parent.
    setParentId(parentTypeOf(itemTypes, value)?.id ?? (tops.length === 1 ? tops[0].id : ''))
    setName(''); setError(null); setOpen(true)
  }

  const save = () => {
    if (!parentId) { setError('Select an item type'); return }
    if (!name.trim()) { setError('Name is required'); return }
    start(async () => {
      setError(null)
      const result = await createSubTypeAction({ parentId, name: name.trim() })
      if (!result.success) { setError(result.error); return }
      onSubTypeCreated?.({ id: result.data.id, name: result.data.name, parentId: result.data.parentId })
      onChange(result.data.id)
      setOpen(false)
    })
  }

  return (
    <>
      <Select value={value || ''} onValueChange={(v) => { if (v === ADD_VALUE) openDialog(); else onChange(v) }}>
        <SelectTrigger className={className} aria-invalid={invalid || undefined}>
          <SelectValue placeholder={hasSubs ? 'Select sub type…' : 'No sub types yet — add one'} />
        </SelectTrigger>
        <SelectContent>
          {kept && <SelectItem value={kept.id} className="text-muted-foreground">{kept.name} (no sub type)</SelectItem>}
          {tops.map((top) => {
            const subs = subsOf(top.id)
            if (subs.length === 0) return null
            return (
              <SelectGroup key={top.id}>
                <SelectLabel>{top.name}</SelectLabel>
                {subs.map((s) => <SelectItem key={s.id} value={s.id} className="pl-8">{s.name}</SelectItem>)}
              </SelectGroup>
            )
          })}
          {(hasSubs || kept) && <SelectSeparator />}
          <SelectItem value={ADD_VALUE} className="text-primary font-medium">
            <span className="flex items-center gap-1.5"><Plus className="size-4" /> Add sub type…</span>
          </SelectItem>
        </SelectContent>
      </Select>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Sub Type</DialogTitle>
            <DialogDescription>A sub type sits under an item type and follows its formula, e.g. Polyester → 150/144.</DialogDescription>
          </DialogHeader>
          {tops.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Add an item type first at <Link href="/item-types/new" className="text-primary underline">Setup → Item Types</Link>.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Item Type <span className="text-destructive">*</span></Label>
                <Select value={parentId} onValueChange={setParentId}>
                  <SelectTrigger className="min-h-[44px] w-full"><SelectValue placeholder="Select item type…" /></SelectTrigger>
                  <SelectContent>
                    {tops.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Sub Type Name <span className="text-destructive">*</span></Label>
                <Input
                  autoFocus className="min-h-[44px]" placeholder="e.g. 150/144, 30/s Cotton"
                  value={name} onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); save() } }}
                />
              </div>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            {tops.length > 0 && (
              <Button type="button" onClick={save} disabled={isPending}>{isPending ? 'Saving…' : 'Add Sub Type'}</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

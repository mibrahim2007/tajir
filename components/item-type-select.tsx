'use client'

import { useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ItemTypeSelectItems, type ItemTypeOption } from '@/components/item-type-select-items'
import { ItemTypeProfileFields, defaultProfile, type ItemTypeProfileValue } from '@/components/item-type-profile-fields'
import { suggestFormula } from '@/lib/item-formula'
import { createItemTypeAction } from '@/app/actions/create-item-type'

const ADD_VALUE = '__add_item_type__'

// Mandatory Item Type list for a stock item, with a "+ Add item type" entry
// that creates a type (name + formula) on the spot and selects it. The new
// type is reported through onTypeCreated so the caller can keep its list.
export function ItemTypeSelect({
  itemTypes,
  value,
  onChange,
  onTypeCreated,
  keepSelectableId,
  className = 'min-h-[44px] w-full',
  invalid = false,
}: {
  itemTypes: ItemTypeOption[]
  value: string | undefined
  onChange: (id: string) => void
  onTypeCreated?: (type: ItemTypeOption) => void
  keepSelectableId?: string | null
  className?: string
  invalid?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [profile, setProfile] = useState<ItemTypeProfileValue>(defaultProfile())
  const [profileTouched, setProfileTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, start] = useTransition()

  const openDialog = () => {
    setName(''); setProfile(defaultProfile()); setProfileTouched(false); setError(null); setOpen(true)
  }

  // Until the user picks a formula, follow the one the typed name suggests.
  const onNameChange = (next: string) => {
    setName(next)
    if (!profileTouched) setProfile(defaultProfile(suggestFormula(next)))
  }

  const save = () => {
    if (!name.trim()) { setError('Name is required'); return }
    start(async () => {
      setError(null)
      const result = await createItemTypeAction({ name: name.trim(), subTypes: [], ...profile })
      if (!result.success) { setError(result.error); return }
      const created = { id: result.data.id, name: result.data.name, parentId: null }
      onTypeCreated?.(created)
      onChange(created.id)
      setOpen(false)
    })
  }

  return (
    <>
      <Select
        value={value || ''}
        onValueChange={(v) => { if (v === ADD_VALUE) openDialog(); else onChange(v) }}
      >
        <SelectTrigger className={className} aria-invalid={invalid || undefined}>
          <SelectValue placeholder={itemTypes.length === 0 ? 'No types yet — add one' : 'Select type…'} />
        </SelectTrigger>
        <SelectContent>
          <ItemTypeSelectItems itemTypes={itemTypes} keepSelectableId={keepSelectableId} />
          {itemTypes.length > 0 && <SelectSeparator />}
          <SelectItem value={ADD_VALUE} className="text-primary font-medium">
            <span className="flex items-center gap-1.5"><Plus className="size-4" /> Add item type…</span>
          </SelectItem>
        </SelectContent>
      </Select>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Item Type</DialogTitle>
            <DialogDescription>
              The formula decides how invoice lines of items of this type are measured and billed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name <span className="text-destructive">*</span></Label>
              <Input
                autoFocus className="min-h-[44px]" placeholder="e.g. Polyester 150/144, Cotton Yarn, Electric"
                value={name} onChange={(e) => onNameChange(e.target.value)}
              />
            </div>
            <ItemTypeProfileFields
              compact
              value={profile}
              onChange={(p) => { setProfile(p); setProfileTouched(true) }}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="button" onClick={save} disabled={isPending}>
              {isPending ? 'Saving…' : 'Add Item Type'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

'use client'

import { Fragment } from 'react'
import { SelectGroup, SelectItem, SelectLabel } from '@/components/ui/select'

export type ItemTypeOption = { id: string; name: string; parentId?: string | null }

// Renders the item-type options for a stock-item Select as "sub-types only":
// a top-level type that HAS sub-types becomes a non-selectable group header and
// only its sub-types are pickable; a top-level type with no sub-types stays
// directly selectable. Place inside a <SelectContent> (after any "No type" item).
//
// keepSelectableId: when editing an item already assigned to a parent type that
// now has sub-types, pass its id so the parent stays selectable — otherwise its
// current value couldn't render or be preserved.
export function ItemTypeSelectItems({
  itemTypes,
  keepSelectableId,
}: {
  itemTypes: ItemTypeOption[]
  keepSelectableId?: string | null
}) {
  const tops = itemTypes.filter((t) => !t.parentId).sort((a, b) => a.name.localeCompare(b.name))
  const childrenByParent = new Map<string, ItemTypeOption[]>()
  for (const t of itemTypes) {
    if (t.parentId) {
      const list = childrenByParent.get(t.parentId) ?? []
      list.push(t)
      childrenByParent.set(t.parentId, list)
    }
  }

  return (
    <>
      {tops.map((top) => {
        const subs = (childrenByParent.get(top.id) ?? []).sort((a, b) => a.name.localeCompare(b.name))
        if (subs.length === 0) {
          return <SelectItem key={top.id} value={top.id}>{top.name}</SelectItem>
        }
        return (
          <SelectGroup key={top.id}>
            <SelectLabel>{top.name}</SelectLabel>
            {top.id === keepSelectableId && (
              <SelectItem value={top.id} className="pl-8 text-muted-foreground">{top.name} (type)</SelectItem>
            )}
            {subs.map((s) => (
              <SelectItem key={s.id} value={s.id} className="pl-8">{s.name}</SelectItem>
            ))}
          </SelectGroup>
        )
      })}
    </>
  )
}

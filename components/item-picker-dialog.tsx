'use client'

import { useState } from 'react'
import { Search, Check, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export type PickerItem = {
  id: string
  name: string
  badge?: string   // e.g. count "30s"
  meta?: string    // e.g. "1,250 avail." shown on the right
}

type Props = {
  items: PickerItem[]
  value: string
  onSelect: (id: string) => void
  placeholder?: string
  title?: string
  disabled?: boolean
}

export function ItemPickerDialog({
  items,
  value,
  onSelect,
  placeholder = 'Select item…',
  title = 'Select Item',
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const selected = items.find((i) => i.id === value)

  const filtered = search.trim()
    ? items.filter((i) =>
        i.name.toLowerCase().includes(search.toLowerCase()) ||
        i.badge?.toLowerCase().includes(search.toLowerCase())
      )
    : items

  function pick(id: string) {
    onSelect(id)
    setOpen(false)
    setSearch('')
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn(
          'flex h-11 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background transition-colors',
          'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
          !selected && 'text-muted-foreground'
        )}
      >
        <span className="flex items-center gap-2 truncate">
          <Package className="size-4 shrink-0 text-muted-foreground" />
          {selected ? (
            <span className="truncate">
              {selected.name}
              {selected.badge && (
                <span className="ml-1.5 text-xs text-muted-foreground">({selected.badge})</span>
              )}
            </span>
          ) : (
            placeholder
          )}
        </span>
        <Search className="size-4 shrink-0 text-muted-foreground ml-2" />
      </button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch('') }}>
        <DialogContent className="max-w-lg p-0 gap-0">
          <DialogHeader className="px-4 pt-4 pb-3 border-b">
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          {/* Search */}
          <div className="flex items-center gap-2 px-4 py-3 border-b">
            <Search className="size-4 text-muted-foreground shrink-0" />
            <input
              autoFocus
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Type to filter…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setSearch('')}
              >
                Clear
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No items match your search</p>
            ) : (
              <ul>
                {filtered.map((item) => {
                  const isSelected = item.id === value
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => pick(item.id)}
                        className={cn(
                          'w-full flex items-center justify-between px-4 py-3 text-left text-sm transition-colors',
                          'hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
                          isSelected && 'bg-accent'
                        )}
                      >
                        <span className="flex items-center gap-3 min-w-0">
                          {isSelected ? (
                            <Check className="size-4 text-primary shrink-0" />
                          ) : (
                            <span className="size-4 shrink-0" />
                          )}
                          <span className="truncate font-medium">{item.name}</span>
                          {item.badge && (
                            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              {item.badge}
                            </span>
                          )}
                        </span>
                        {item.meta && (
                          <span className="ml-4 shrink-0 text-xs text-muted-foreground">{item.meta}</span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="px-4 py-3 border-t flex justify-between items-center">
            <span className="text-xs text-muted-foreground">
              {filtered.length} item{filtered.length !== 1 ? 's' : ''}
            </span>
            <Button variant="outline" size="sm" onClick={() => { setOpen(false); setSearch('') }}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

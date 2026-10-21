'use client'

import { useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createGradeAction, type GradeOption } from '@/app/actions/grades'

const ADD_VALUE = '__add_grade__'
const NONE_VALUE = '__no_grade__'

// Grade list for a trading / opening-stock line, with "+ Add grade…" to create
// one on the spot. `onGradeCreated` lets the caller keep its list in sync.
export function GradeSelect({
  grades,
  value,
  onChange,
  onGradeCreated,
  allowAdd = true,
  allowNone = false,
  className = 'h-9 w-full',
  invalid = false,
  placeholder = 'Grade…',
}: {
  grades: GradeOption[]
  value: string | null | undefined
  onChange: (id: string | null) => void
  onGradeCreated?: (grade: GradeOption) => void
  /** Purchases and opening stock may add grades; sales pick from stock. */
  allowAdd?: boolean
  /** Offer a "No grade" choice (items that don't track grade). */
  allowNone?: boolean
  className?: string
  invalid?: boolean
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, start] = useTransition()

  const save = () => {
    if (!name.trim()) { setError('Name is required'); return }
    start(async () => {
      setError(null)
      const result = await createGradeAction({ name: name.trim() })
      if (!result.success) { setError(result.error); return }
      onGradeCreated?.(result.data)
      onChange(result.data.id)
      setOpen(false)
    })
  }

  return (
    <>
      <Select
        value={value || (allowNone ? NONE_VALUE : '')}
        onValueChange={(v) => {
          if (v === ADD_VALUE) { setName(''); setError(null); setOpen(true); return }
          onChange(v === NONE_VALUE ? null : v)
        }}
      >
        <SelectTrigger className={className} aria-invalid={invalid || undefined}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {allowNone && <SelectItem value={NONE_VALUE}>No grade</SelectItem>}
          {grades.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
          {allowAdd && (
            <>
              {(grades.length > 0 || allowNone) && <SelectSeparator />}
              <SelectItem value={ADD_VALUE} className="text-primary font-medium">
                <span className="flex items-center gap-1.5"><Plus className="size-4" /> Add grade…</span>
              </SelectItem>
            </>
          )}
        </SelectContent>
      </Select>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>New Grade</DialogTitle></DialogHeader>
          <Input
            autoFocus placeholder="e.g. AA-Even, A-Uneven" className="min-h-[44px]"
            value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); save() } }}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="button" onClick={save} disabled={isPending}>{isPending ? 'Saving…' : 'Add Grade'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

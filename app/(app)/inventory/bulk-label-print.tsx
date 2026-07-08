'use client'

import { useCallback, useRef, useState, type ReactNode } from 'react'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Wraps the inventory table and drives bulk label printing.
 * Reads row checkboxes (class "label-checkbox") straight from the DOM on submit
 * so the server-rendered table stays untouched. A header "select all" checkbox
 * (class "label-select-all") toggles every row.
 */
export function BulkLabelPrint({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [count, setCount] = useState(0)

  const selected = useCallback(
    () => Array.from(ref.current?.querySelectorAll<HTMLInputElement>('input.label-checkbox:checked') ?? []),
    [],
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLDivElement>) => {
      const target = e.target as HTMLInputElement
      if (target.classList?.contains('label-select-all')) {
        ref.current
          ?.querySelectorAll<HTMLInputElement>('input.label-checkbox')
          .forEach((box) => { box.checked = target.checked })
      }
      setCount(selected().length)
    },
    [selected],
  )

  const printSelected = () => {
    const ids = selected().map((b) => b.value)
    if (ids.length === 0) return
    window.open(`/inventory/labels/print?ids=${ids.join(',')}`, '_blank')
  }

  return (
    <div>
      <div className="flex justify-end mb-2">
        <Button variant="outline" size="sm" className="min-h-[44px]" disabled={count === 0} onClick={printSelected}>
          <Printer className="h-4 w-4 mr-2" />
          Print labels{count > 0 ? ` (${count})` : ''}
        </Button>
      </div>
      <div ref={ref} onChange={handleChange}>
        {children}
      </div>
    </div>
  )
}

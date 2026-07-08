'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Printer, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Print controls for the label sheet. Copies is kept in the URL so the
 * server component can re-render the right number of labels per item.
 */
export function LabelToolbar({ copies }: { copies: number }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const setCopies = (next: number) => {
    const clamped = Math.max(1, Math.min(99, next))
    const sp = new URLSearchParams(params.toString())
    sp.set('copies', String(clamped))
    router.replace(`${pathname}?${sp.toString()}`)
  }

  return (
    <div className="print:hidden flex items-center gap-3 px-6 py-4 border-b bg-background sticky top-0 z-10">
      <Button variant="ghost" size="sm" onClick={() => router.push('/inventory')}>← Back</Button>
      <div className="flex-1" />
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Copies each</span>
        <div className="flex items-center rounded-md border">
          <Button variant="ghost" size="sm" className="px-2" onClick={() => setCopies(copies - 1)} aria-label="Fewer copies">
            <Minus className="h-4 w-4" />
          </Button>
          <span className="w-8 text-center text-sm font-mono tabular-nums">{copies}</span>
          <Button variant="ghost" size="sm" className="px-2" onClick={() => setCopies(copies + 1)} aria-label="More copies">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <Button className="min-h-[44px]" onClick={() => window.print()}>
        <Printer className="h-4 w-4 mr-2" />
        Print
      </Button>
    </div>
  )
}

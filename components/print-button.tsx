'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function PrintButton() {
  return (
    <Button variant="outline" className="min-h-[44px] print:hidden" onClick={() => window.print()}>
      <Printer className="h-4 w-4 mr-2" />
      Print
    </Button>
  )
}

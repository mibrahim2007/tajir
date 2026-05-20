'use client'

import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ExportButton({ href, label = 'Export Excel' }: { href: string; label?: string }) {
  return (
    <Button
      variant="outline"
      className="min-h-[44px]"
      onClick={() => { window.location.href = href }}
    >
      <Download className="h-4 w-4 mr-2" />
      {label}
    </Button>
  )
}

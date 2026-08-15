'use client'

import { MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Opens WhatsApp (app or web) with a pre-filled message via a wa.me deep link.
 * When `waNumber` is set the chat opens directly with that contact; otherwise
 * WhatsApp shows its contact picker so the sender chooses the recipient.
 *
 * The sender still taps Send inside WhatsApp — nothing is dispatched
 * automatically, which is exactly what a trader wants.
 */
export function SendWhatsAppButton({ waNumber, message }: { waNumber: string | null; message: string }) {
  const href = `https://wa.me/${waNumber ?? ''}?text=${encodeURIComponent(message)}`

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="print:hidden">
      <Button variant="outline" className="min-h-[44px] gap-2 border-emerald-500/40 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/40">
        <MessageCircle className="h-4 w-4" />
        WhatsApp
      </Button>
    </a>
  )
}

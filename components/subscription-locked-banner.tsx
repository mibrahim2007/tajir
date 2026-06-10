'use client'

import { AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import type { SubscriptionStatus } from '@/db/schema'

type Props = {
  status: SubscriptionStatus
}

export function SubscriptionLockedBanner({ status }: Props) {
  if (status === 'active') return null

  const messages: Record<Exclude<SubscriptionStatus, 'active'>, { text: string; cta?: string }> = {
    grace_period: {
      text: 'Your subscription has expired. You have 7 days before your account is locked.',
      cta: 'Renew now',
    },
    locked: {
      text: 'Your account is locked due to non-payment. Data entry is disabled.',
      cta: 'Contact support',
    },
    cancelled: {
      text: 'Your subscription has been cancelled. Your data will be deleted after 90 days.',
    },
  }

  const { text, cta } = messages[status]

  return (
    <div
      className={`w-full px-4 py-2 flex items-center gap-2 text-sm ${
        status === 'locked' || status === 'cancelled'
          ? 'bg-destructive text-destructive-foreground'
          : 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200'
      }`}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="flex-1">{text}</span>
      {cta && status !== 'cancelled' && (
        <Link
          href="/settings/billing"
          className="underline underline-offset-4 font-medium whitespace-nowrap"
        >
          {cta}
        </Link>
      )}
    </div>
  )
}

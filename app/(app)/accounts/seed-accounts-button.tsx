'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { seedChartOfAccountsAction } from '@/app/actions/seed-chart-of-accounts'

export function SeedAccountsButton() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSeed = () => {
    startTransition(async () => {
      setError(null)
      const result = await seedChartOfAccountsAction()
      if (!result.success) { setError(result.error); return }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={handleSeed} disabled={isPending} className="min-h-[44px]">
        {isPending ? 'Seeding…' : 'Seed Standard CoA'}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

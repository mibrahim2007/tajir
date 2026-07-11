'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateBusinessProfileAction } from '@/app/actions/update-business-profile'

export function BusinessProfileForm({ name: initialName, ntn: initialNtn }: { name: string; ntn: string }) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [ntn, setNtn] = useState(initialNtn)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      setError(null)
      setSaved(false)
      const res = await updateBusinessProfileAction({ name, ntn })
      if (!res.success) {
        setError(res.error)
        return
      }
      setSaved(true)
      router.refresh()
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 bg-card rounded-2xl border border-border p-5 shadow-sm">
      <div className="space-y-1">
        <Label>Business Name <span className="text-destructive">*</span></Label>
        <Input
          value={name}
          onChange={(e) => { setName(e.target.value); setSaved(false) }}
          className="min-h-[44px]"
          placeholder="Your business name"
        />
      </div>

      <div className="space-y-1">
        <Label>NTN Number</Label>
        <Input
          value={ntn}
          onChange={(e) => { setNtn(e.target.value); setSaved(false) }}
          className="min-h-[44px] font-mono"
          placeholder="e.g. 1234567-8"
        />
        <p className="text-xs text-muted-foreground">
          National Tax Number — printed in the header of invoices and vouchers. Leave blank to hide it.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && <p className="text-sm text-emerald-600 dark:text-emerald-400">Saved.</p>}

      <Button type="submit" className="min-h-[44px]" disabled={isPending}>
        {isPending ? 'Saving…' : 'Save'}
      </Button>
    </form>
  )
}

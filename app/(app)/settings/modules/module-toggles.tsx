'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { updateTenantFeaturesAction } from '@/app/actions/update-tenant-features'
import { ALL_MODULES, MODULE_META, type ModuleKey } from '@/lib/modules'

const SECTIONS = ['Sales', 'Procurement', 'Inventory', 'Accounts'] as const

type Props = {
  initialEnabled: ModuleKey[]
}

export function ModuleToggles({ initialEnabled }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [enabled, setEnabled] = useState<Set<ModuleKey>>(new Set(initialEnabled))
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const toggle = (key: ModuleKey) => {
    setSaved(false)
    setEnabled((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const save = () => {
    startTransition(async () => {
      setError(null)
      setSaved(false)
      const result = await updateTenantFeaturesAction([...enabled] as ModuleKey[])
      if (!result.success) {
        setError(result.error)
        return
      }
      setSaved(true)
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      {SECTIONS.map((section) => {
        const items = ALL_MODULES.filter((k) => MODULE_META[k].section === section)
        return (
          <div key={section}>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
              {section}
            </h3>
            <div className="bg-card rounded-xl border border-border divide-y">
              {items.map((key) => {
                const meta = MODULE_META[key]
                const Icon = meta.icon
                return (
                  <div key={key} className="flex items-center justify-between px-4 py-3 gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium">{meta.label}</span>
                    </div>
                    <Switch
                      checked={enabled.has(key)}
                      onCheckedChange={() => toggle(key)}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={isPending} className="min-h-[44px]">
          {isPending ? 'Saving…' : 'Save Changes'}
        </Button>
        {saved && <span className="text-sm text-green-600 font-medium">Saved</span>}
      </div>
    </div>
  )
}

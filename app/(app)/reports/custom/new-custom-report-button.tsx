'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { saveCustomReportAction } from '@/app/actions/save-custom-report'
import { REPORT_TEMPLATES } from '@/lib/reports/custom-report-templates'
import { cn } from '@/lib/utils'

// Creating a report is deliberately two decisions only — a name and a starting
// layout. Everything else (headers, account mapping, behaviour) is edited in
// the builder, which opens straight after.
export function NewCustomReportButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [templateKey, setTemplateKey] = useState(REPORT_TEMPLATES[1]?.key ?? 'blank')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const template = REPORT_TEMPLATES.find((t) => t.key === templateKey) ?? REPORT_TEMPLATES[0]

  const create = () => {
    startTransition(async () => {
      setError(null)
      const result = await saveCustomReportAction({
        name: name.trim() || template.name,
        description: template.key === 'blank' ? undefined : template.description,
        basis: template.basis,
        hideZeroRows: template.hideZeroRows,
        lines: template.lines.map((l) => ({
          lineType: l.lineType,
          label: l.label,
          ref: l.ref,
          indent: l.indent ?? 0,
          sign: l.sign ?? 'natural',
          includeChildren: l.includeChildren ?? true,
          showDetail: l.showDetail ?? false,
          isBold: l.isBold ?? false,
          underline: l.underline ?? false,
          formula: l.formula,
          accountCodes: l.accountCodes ?? [],
        })),
      })
      if (!result.success) { setError(result.error); return }
      setOpen(false)
      router.push(`/reports/custom/${result.data.id}/edit`)
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setError(null); setName('') } }}>
      <DialogTrigger asChild>
        <Button className="min-h-[44px] gap-2">
          <Plus className="size-4" /> New Report
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Custom Report</DialogTitle>
          <DialogDescription>
            Pick a starting layout. Every header, account mapping and behaviour stays editable afterwards.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div>
            <Label className="text-xs mb-1 block">Report Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={template.name}
              className="min-h-[44px]"
            />
          </div>

          <div>
            <Label className="text-xs mb-1.5 block">Start From</Label>
            <div className="grid gap-2">
              {REPORT_TEMPLATES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTemplateKey(t.key)}
                  className={cn(
                    'text-left rounded-xl border p-3 transition-colors',
                    t.key === templateKey ? 'border-primary bg-accent' : 'hover:bg-secondary/50',
                  )}
                >
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button onClick={create} disabled={isPending} className="w-full min-h-[44px]">
            {isPending ? 'Creating…' : 'Create & Edit Layout'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

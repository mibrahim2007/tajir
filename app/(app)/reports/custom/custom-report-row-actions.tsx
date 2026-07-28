'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Pencil, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DeleteButton } from '@/components/delete-button'
import { duplicateCustomReportAction } from '@/app/actions/duplicate-custom-report'
import { deleteCustomReportAction } from '@/app/actions/delete-custom-report'

export function CustomReportRowActions({ reportId, name }: { reportId: string; name: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const duplicate = () => {
    startTransition(async () => {
      const result = await duplicateCustomReportAction({ id: reportId })
      if (result.success) router.push(`/reports/custom/${result.data.id}/edit`)
    })
  }

  return (
    <div className="flex items-center gap-1 shrink-0">
      <Button asChild variant="ghost" size="sm" className="min-h-[44px]" title="Edit layout">
        <Link href={`/reports/custom/${reportId}/edit`}><Pencil className="h-4 w-4" /></Link>
      </Button>
      <Button variant="ghost" size="sm" className="min-h-[44px]" onClick={duplicate} disabled={isPending} title="Duplicate">
        <Copy className="h-4 w-4" />
      </Button>
      <DeleteButton
        description={`Delete the layout "${name}"? No accounting data is affected — only this report definition is removed.`}
        onDelete={() => deleteCustomReportAction({ id: reportId })}
      />
    </div>
  )
}

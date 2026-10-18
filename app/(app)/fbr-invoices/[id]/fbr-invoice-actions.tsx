'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { validateFbrInvoiceAction, postFbrInvoiceAction, deleteFbrInvoiceAction } from '@/app/actions/fbr-invoices'

export function FbrInvoiceActions({ id, locked }: { id: string; locked: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  // Posting is final and deleting is permanent, so both take a second click.
  const [armed, setArmed] = useState<'post' | 'delete' | null>(null)

  const run = (fn: () => Promise<void>) => start(async () => { setMsg(null); await fn(); setArmed(null); router.refresh() })

  const validate = () => run(async () => {
    const r = await validateFbrInvoiceAction(id)
    if (!r.success) return setMsg({ ok: false, text: r.error })
    setMsg(r.data.status === 'valid' ? { ok: true, text: 'FBR says the invoice is valid.' } : { ok: false, text: 'FBR found problems — see below.' })
  })
  const post = () => run(async () => {
    const r = await postFbrInvoiceAction(id)
    if (!r.success) return setMsg({ ok: false, text: r.error })
    setMsg(r.data.status === 'posted' ? { ok: true, text: `Posted. FBR invoice no. ${r.data.fbrInvoiceNumber}` } : { ok: false, text: 'Not posted — see the FBR response below.' })
  })
  const remove = () => start(async () => {
    const r = await deleteFbrInvoiceAction(id)
    if (!r.success) { setMsg({ ok: false, text: r.error }); return }
    router.push('/fbr-invoices')
    router.refresh()
  })

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <Button asChild variant="outline" className="min-h-[44px]"><Link href={`/fbr-invoices/${id}/print`}>Print</Link></Button>
        {!locked && (
          <>
            <Button asChild variant="outline" className="min-h-[44px]"><Link href={`/fbr-invoices/${id}/edit`}>Edit</Link></Button>
            <Button variant="outline" className="min-h-[44px]" disabled={pending}
              onBlur={() => setArmed(null)} onClick={() => (armed === 'delete' ? remove() : setArmed('delete'))}>
              {armed === 'delete' ? 'Confirm delete' : 'Delete'}
            </Button>
            <Button variant="outline" className="min-h-[44px]" disabled={pending} onClick={validate}>
              {pending && !armed ? 'Working…' : 'Validate with FBR'}
            </Button>
            <Button className="min-h-[44px]" disabled={pending}
              onBlur={() => setArmed(null)} onClick={() => (armed === 'post' ? post() : setArmed('post'))}>
              {armed === 'post' ? 'Confirm — post to FBR' : 'Post to FBR'}
            </Button>
          </>
        )}
      </div>
      {armed === 'post' && <p className="text-xs text-muted-foreground">Once posted the invoice is recorded with FBR and can no longer be edited.</p>}
      {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive'}`}>{msg.text}</p>}
    </div>
  )
}

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, FormProvider, Controller, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { tenderLineFormSchema } from '@/lib/constants/tender-types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TenderLinesField, type TenderLine } from '@/components/tender-lines-field'
import { editSupplierRefundAction } from '@/app/actions/edit-supplier-refund'
import { useEnterToNextField } from '@/hooks/use-enter-to-next-field'
import { formatPKR } from '@/lib/utils/currency'

type Bank = { id: string; name: string; account_number: string | null }


const schema = z.object({
  currencyCode: z.enum(['PKR', 'USD']).default('PKR'),
  exchangeRate: z.number().positive().default(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  notes: z.string().optional(),
  lines: z.array(tenderLineFormSchema).min(1, 'Add at least one tender line'),
}).refine((v) => v.lines.some((l) => (Number(l.amount) || 0) > 0), {
  message: 'Enter a positive amount for at least one tender line',
  path: ['lines'],
})

type FormValues = z.infer<typeof schema>

export function EditSupplierRefundForm({ refundId, supplierName, banks, initial }: {
  refundId: string
  supplierName: string
  banks: Bank[]
  initial: { currencyCode: 'PKR' | 'USD'; exchangeRate: number; date: string; notes: string; lines: TenderLine[] }
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const handleEnterToNext = useEnterToNextField()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: initial,
  })

  const watchedCurrency = form.watch('currencyCode')
  const watchedRate     = form.watch('exchangeRate')
  const watchedDate     = form.watch('date')
  const watchedLines    = form.watch('lines')
  const lineTotal = (watchedLines ?? []).reduce((s, l) => s + (Number(l.amount) || 0), 0)
  const totalPkr  = lineTotal * (watchedCurrency === 'USD' ? (watchedRate || 1) : 1)

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setServerError(null)
      const result = await editSupplierRefundAction({
        id: refundId,
        currencyCode: values.currencyCode,
        exchangeRate: values.exchangeRate,
        date: values.date,
        notes: values.notes,
        lines: values.lines.filter((l) => (Number(l.amount) || 0) > 0).map((l) => ({
          transactionType: l.transactionType,
          chequeNumber: l.chequeNumber || undefined,
          chequeDueDate: l.chequeDueDate || undefined,
          bankId: l.bankId || undefined,
          amount: l.amount,
        })),
      })
      if (!result.success) { setServerError(result.error); return }
      // Navigate back to the ledger. Do NOT router.refresh() inside the transition
      // (it keeps isPending true forever); back() re-renders the server component.
      router.back()
    })
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, () => setServerError('Please complete the highlighted fields and enter a positive amount.'))} onKeyDown={handleEnterToNext}>
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">

        {/* ── FORM (left on xl) ── */}
        <Card className="min-w-0">
          <CardHeader className="pb-3 pt-5 px-5"><CardTitle className="text-base">Refund Details</CardTitle></CardHeader>
          <CardContent className="px-5 pb-5 space-y-4">
            {/* Supplier · Date · Currency share one row on wide screens. */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
              <div className="space-y-1 md:col-span-6">
                <Label>Supplier</Label>
                <Input value={supplierName} disabled readOnly className="min-h-[44px]" />
              </div>
              <div className="space-y-1 md:col-span-3">
                <Label>Date <span className="text-destructive">*</span></Label>
                <Input type="date" {...form.register('date')} className="min-h-[44px]" />
                {form.formState.errors.date && <p className="text-xs text-destructive">{form.formState.errors.date.message}</p>}
              </div>
              <div className="space-y-1 md:col-span-3">
                <Label>Currency</Label>
                <Controller control={form.control} name="currencyCode" render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="min-h-[44px] w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PKR">PKR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>
            </div>

            {watchedCurrency === 'USD' && (
              <div className="space-y-1 md:max-w-xs">
                <Label>Exchange Rate (PKR per USD) <span className="text-destructive">*</span></Label>
                <Input type="number" step="0.01" min="1" {...form.register('exchangeRate', { valueAsNumber: true })} className="min-h-[44px]" />
              </div>
            )}

            <Separator />

            <TenderLinesField banks={banks} currency={watchedCurrency} layout="wide" />

            <div className="space-y-1">
              <Label>Notes</Label>
              <Input placeholder="e.g. Overpayment return for PO-0042…" {...form.register('notes')} className="min-h-[44px]" />
            </div>

          </CardContent>
        </Card>

        {/* ── SUMMARY (right on xl, sticky) ── */}
        <div className="xl:sticky xl:top-6">
          <Card>
            <CardContent className="px-5 pt-5 pb-5">
              <p className="font-extrabold text-[15px] tracking-tight mb-4">Refund Summary</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Supplier</span>
                  <span className="font-medium text-right truncate">{supplierName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span className="tabular-nums">{watchedDate || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tender lines</span>
                  <span className="tabular-nums">{(watchedLines ?? []).filter((l) => (Number(l.amount) || 0) > 0).length}</span>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="flex justify-between items-center mb-5">
                <span className="font-bold text-sm">Receiving</span>
                <span className="text-xl font-extrabold tabular-nums tracking-tight">{formatPKR(totalPkr)}</span>
              </div>

              <div className="space-y-2">
                <Button type="submit" className="w-full min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white" disabled={isPending}>
                  {isPending ? 'Saving…' : 'Save Changes'}
                </Button>
                <Button type="button" variant="outline" className="w-full min-h-[44px]" onClick={() => router.back()}>Cancel</Button>
              </div>

              {serverError && <p className="text-sm text-destructive mt-3">{serverError}</p>}
            </CardContent>
          </Card>
        </div>

        </div>
      </form>
    </FormProvider>
  )
}

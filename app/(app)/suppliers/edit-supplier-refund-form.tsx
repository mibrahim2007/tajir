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
        <Card>
          <CardHeader className="pb-3 pt-5 px-5"><CardTitle className="text-base">Refund Details</CardTitle></CardHeader>
          <CardContent className="px-5 pb-5 space-y-4">
            <div className="space-y-1">
              <Label>Supplier</Label>
              <Input value={supplierName} disabled readOnly className="min-h-[44px]" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Date <span className="text-destructive">*</span></Label>
                <Input type="date" {...form.register('date')} className="min-h-[44px]" />
                {form.formState.errors.date && <p className="text-xs text-destructive">{form.formState.errors.date.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Currency</Label>
                <Controller control={form.control} name="currencyCode" render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PKR">PKR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>
            </div>

            {watchedCurrency === 'USD' && (
              <div className="space-y-1">
                <Label>Exchange Rate (PKR per USD) <span className="text-destructive">*</span></Label>
                <Input type="number" step="0.01" min="1" {...form.register('exchangeRate', { valueAsNumber: true })} className="min-h-[44px]" />
              </div>
            )}

            <Separator />

            <TenderLinesField banks={banks} currency={watchedCurrency} />

            <div className="space-y-1">
              <Label>Notes</Label>
              <Input placeholder="e.g. Overpayment return for PO-0042…" {...form.register('notes')} className="min-h-[44px]" />
            </div>

            {serverError && <p className="text-sm text-destructive">{serverError}</p>}

            <div className="flex gap-2">
              <Button type="submit" className="min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white" disabled={isPending}>
                {isPending ? 'Saving…' : 'Save Changes'}
              </Button>
              <Button type="button" variant="outline" className="min-h-[44px]" onClick={() => router.back()}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </FormProvider>
  )
}

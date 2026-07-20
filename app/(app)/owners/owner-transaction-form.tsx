'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { tenderLineFormSchema } from '@/lib/constants/tender-types'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { TenderLinesField, type TenderLine } from '@/components/tender-lines-field'
import { createOwnerTransactionAction } from '@/app/actions/create-owner-transaction'
import { formatPKR } from '@/lib/utils/currency'
import { useEnterToNextField } from '@/hooks/use-enter-to-next-field'

type Bank = { id: string; name: string; account_number: string | null }
type OwnerOption = { id: string; name: string }


const schema = z.object({
  ownerId:      z.string().min(1, 'Select an owner'),
  txnType:      z.enum(['withdrawal', 'contribution']),
  currencyCode: z.enum(['PKR', 'USD']).default('PKR'),
  exchangeRate: z.number().positive().default(1),
  date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  notes:        z.string().optional(),
  lines:        z.array(tenderLineFormSchema).min(1, 'Add at least one tender line'),
}).refine((v) => v.lines.some((l) => (Number(l.amount) || 0) > 0), {
  message: 'Enter a positive amount for at least one tender line',
  path: ['lines'],
})

type FormValues = z.infer<typeof schema>

const emptyLine: TenderLine = { transactionType: 'cash', chequeNumber: '', chequeDueDate: '', bankId: '', amount: 0 }
const freshDefaults = (today: string, ownerId = ''): FormValues => ({
  ownerId, txnType: 'withdrawal', currencyCode: 'PKR', exchangeRate: 1, date: today, notes: '', lines: [{ ...emptyLine }],
})

// Two modes: fixed owner (from an owner ledger) or an owner picker (from the
// Owners page — pass `owners`, omit `ownerId`).
export function OwnerTransactionForm({
  ownerId, owners, today, nextSerial, banks = [],
}: {
  ownerId?: string
  owners?: OwnerOption[]
  today: string
  nextSerial?: string | null
  banks?: Bank[]
}) {
  const showPicker = !ownerId && !!owners
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const handleEnterToNext = useEnterToNextField()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: freshDefaults(today, ownerId ?? ''),
  })

  const watchedCurrency = form.watch('currencyCode')
  const watchedType = form.watch('txnType')
  const watchedLines = form.watch('lines') ?? []
  const amount = watchedLines.reduce((s, l) => s + (Number(l.amount) || 0), 0)
  const isWithdrawal = watchedType === 'withdrawal'

  const onSubmit = (values: FormValues) => {
    const oid = ownerId ?? values.ownerId
    if (!oid) { setServerError('Select an owner'); return }
    startTransition(async () => {
      setServerError(null)
      const result = await createOwnerTransactionAction({
        ownerId: oid,
        txnType: values.txnType,
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
      form.reset(freshDefaults(today, ownerId ?? ''))
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="min-h-[44px]">Record Capital Movement</Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Owner Capital Movement</SheetTitle>
          <SheetDescription>
            Record cash an owner takes out of, or puts into, the business.
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit, () => setServerError('Please complete the highlighted fields and enter a positive amount.'))}
            onKeyDown={handleEnterToNext}
            className="flex flex-col gap-4 mt-6"
          >
            {showPicker && (
              <FormField control={form.control} name="ownerId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Owner <span className="text-destructive">*</span></FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Select an owner…" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {owners!.map((o) => (
                        <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            <FormField control={form.control} name="txnType" render={({ field }) => (
              <FormItem>
                <FormLabel>Type <span className="text-destructive">*</span></FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="withdrawal">Withdrawal — owner takes money out</SelectItem>
                    <SelectItem value="contribution">Contribution — owner puts money in</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {nextSerial && isWithdrawal && (
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">Serial No.</label>
                <Input value={nextSerial} disabled readOnly className="min-h-[44px] font-mono" />
                <p className="text-xs text-muted-foreground">Auto-generated on save.</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input type="date" className="min-h-[44px]" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="currencyCode" render={({ field }) => (
                <FormItem>
                  <FormLabel>Currency</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="PKR">PKR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>

            {watchedCurrency === 'USD' && (
              <FormField control={form.control} name="exchangeRate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Exchange Rate (PKR per USD) <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" min="1" className="min-h-[44px]" {...field}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)} />
                  </FormControl>
                </FormItem>
              )} />
            )}

            <Separator />

            <TenderLinesField banks={banks} currency={watchedCurrency} />

            <Separator />

            {/* Spell out the posting so the user can see a withdrawal is a
                drawing against equity, not a business expense. */}
            {amount > 0 && (
              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">Will post as</p>
                <p className="tabular-nums">
                  {isWithdrawal ? (
                    <>Dr <span className="font-medium">Owner&rsquo;s Drawings (3400)</span> · Cr Cash / Bank</>
                  ) : (
                    <>Dr Cash / Bank · Cr <span className="font-medium">Owner&rsquo;s Capital (3100)</span></>
                  )}
                  {' — '}
                  {watchedCurrency !== 'PKR' ? `${watchedCurrency} ${amount.toLocaleString()}` : formatPKR(amount)}
                </p>
                {isWithdrawal && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Reduces owner&rsquo;s equity. Does not affect profit or loss.
                  </p>
                )}
              </div>
            )}

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Note (optional)</FormLabel>
                <FormControl><Input placeholder="e.g. Personal use…" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {serverError && <p className="text-sm text-destructive">{serverError}</p>}
            <Button type="submit" className="w-full min-h-[44px]" disabled={isPending}>
              {isPending ? 'Saving…' : isWithdrawal ? 'Record Withdrawal' : 'Record Contribution'}
            </Button>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}

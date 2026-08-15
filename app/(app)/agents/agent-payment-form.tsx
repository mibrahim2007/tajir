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
import { createAgentPaymentAction } from '@/app/actions/create-agent-payment'
import { formatPKR } from '@/lib/utils/currency'
import { useEnterToNextField } from '@/hooks/use-enter-to-next-field'

type Bank = { id: string; name: string; account_number: string | null }
type AgentOption = { id: string; name: string; outstanding: number }

const schema = z.object({
  agentId:      z.string().min(1, 'Select an agent'),
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
const freshDefaults = (today: string, agentId = ''): FormValues => ({
  agentId, currencyCode: 'PKR', exchangeRate: 1, date: today, notes: '', lines: [{ ...emptyLine }],
})

/**
 * Records a commission payout.
 *
 * Two modes: fixed agent (from an agent ledger) or an agent picker (from the
 * Agents page — pass `agents`, omit `agentId`), mirroring OwnerTransactionForm.
 */
export function AgentPaymentForm({
  agentId, agents, outstanding, today, nextSerial, banks = [],
}: {
  agentId?: string
  agents?: AgentOption[]
  /** Outstanding for the fixed agent, shown so the user can settle in full. */
  outstanding?: number
  today: string
  nextSerial?: string | null
  banks?: Bank[]
}) {
  const showPicker = !agentId && !!agents
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const handleEnterToNext = useEnterToNextField()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: freshDefaults(today, agentId ?? ''),
  })

  const watchedCurrency = form.watch('currencyCode')
  const watchedAgentId = form.watch('agentId')
  const watchedLines = form.watch('lines') ?? []
  const amount = watchedLines.reduce((s, l) => s + (Number(l.amount) || 0), 0)

  const due = agentId
    ? (outstanding ?? 0)
    : (agents?.find((a) => a.id === watchedAgentId)?.outstanding ?? 0)

  const onSubmit = (values: FormValues) => {
    const aid = agentId ?? values.agentId
    if (!aid) { setServerError('Select an agent'); return }
    startTransition(async () => {
      setServerError(null)
      const result = await createAgentPaymentAction({
        agentId: aid,
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
      form.reset(freshDefaults(today, agentId ?? ''))
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="min-h-[44px]">Pay Commission</Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Agent Commission Payment</SheetTitle>
          <SheetDescription>
            Settle commission owed to an agent. Paid on account against their running
            balance, not against particular invoices.
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit, () => setServerError('Please complete the highlighted fields and enter a positive amount.'))}
            onKeyDown={handleEnterToNext}
            className="flex flex-col gap-4 mt-6"
          >
            {showPicker && (
              <FormField control={form.control} name="agentId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Agent <span className="text-destructive">*</span></FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Select an agent…" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {agents!.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}{a.outstanding > 0 ? ` — ${formatPKR(a.outstanding)} due` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            {due !== 0 && (
              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Outstanding commission: </span>
                <span className="font-medium tabular-nums">{formatPKR(Math.abs(due))}</span>
                {due < 0 && <span className="text-muted-foreground"> paid in advance</span>}
              </div>
            )}

            {nextSerial && (
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
                  <FormMessage />
                </FormItem>
              )} />
            )}

            <Separator />

            <TenderLinesField banks={banks} currency={watchedCurrency} />

            <Separator />

            {amount > 0 && (
              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">Will post as</p>
                <p className="tabular-nums">
                  Dr <span className="font-medium">Agent Commission Payable (2150)</span> · Cr Cash / Bank
                  {' — '}
                  {watchedCurrency !== 'PKR' ? `${watchedCurrency} ${amount.toLocaleString()}` : formatPKR(amount)}
                </p>
              </div>
            )}

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Note (optional)</FormLabel>
                <FormControl><Input placeholder="e.g. Settlement for August" className="min-h-[44px]" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {serverError && <p className="text-sm text-destructive">{serverError}</p>}
            <Button type="submit" className="w-full min-h-[44px]" disabled={isPending}>
              {isPending ? 'Saving…' : 'Record Payment'}
            </Button>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}

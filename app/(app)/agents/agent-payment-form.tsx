'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { tenderLineFormSchema } from '@/lib/constants/tender-types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
 * Records a commission payout, as a full page.
 *
 * Two modes: fixed agent at /agents/[id]/payment (from an agent ledger) or an
 * agent picker at /agents/payment (from the Agents page — pass `agents`, omit
 * `agentId`), mirroring OwnerTransactionForm. `returnPath` is the page it came from.
 */
export function AgentPaymentForm({
  agentId, agents, outstanding, today, nextSerial, banks = [], returnPath,
}: {
  agentId?: string
  agents?: AgentOption[]
  /** Outstanding for the fixed agent, shown so the user can settle in full. */
  outstanding?: number
  today: string
  nextSerial?: string | null
  banks?: Bank[]
  returnPath: string
}) {
  const showPicker = !agentId && !!agents
  const router = useRouter()
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
  const watchedDate = form.watch('date')
  const watchedRate = Number(form.watch('exchangeRate')) || 0
  const agentName = showPicker ? agents!.find((a) => a.id === watchedAgentId)?.name : undefined
  const totalPKR = watchedCurrency === 'USD' ? amount * watchedRate : amount

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
      // Back to where the form was opened from. No router.refresh() inside
      // the transition — it keeps isPending stuck.
      router.push(returnPath)
    })
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit, () => setServerError('Please complete the highlighted fields and enter a positive amount.'))}
        onKeyDown={handleEnterToNext}
      >
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">

          {/* ── FORM (left on xl) ── */}
          <Card className="min-w-0">
            <CardHeader className="pb-3 pt-5 px-5">
              <CardTitle className="text-base">Payment Details</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                {showPicker && (
                  <FormField control={form.control} name="agentId" render={({ field }) => (
                    <FormItem className="md:col-span-12">
                      <FormLabel>Agent <span className="text-destructive">*</span></FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger className="min-h-[44px] w-full"><SelectValue placeholder="Select an agent…" /></SelectTrigger></FormControl>
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

                {nextSerial && (
                  <div className="space-y-2 md:col-span-4">
                    <label className="text-sm font-medium leading-none">Serial No.</label>
                    <Input value={nextSerial} disabled readOnly className="min-h-[44px] font-mono" />
                    <p className="text-xs text-muted-foreground">Auto-generated on save.</p>
                  </div>
                )}

                <FormField control={form.control} name="date" render={({ field }) => (
                  <FormItem className={nextSerial ? 'md:col-span-4' : 'md:col-span-6'}>
                    <FormLabel>Date <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input type="date" className="min-h-[44px]" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="currencyCode" render={({ field }) => (
                  <FormItem className={nextSerial ? 'md:col-span-4' : 'md:col-span-6'}>
                    <FormLabel>Currency</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger className="min-h-[44px] w-full"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="PKR">PKR</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />

                {watchedCurrency === 'USD' && (
                  <FormField control={form.control} name="exchangeRate" render={({ field }) => (
                    <FormItem className="md:col-span-6">
                      <FormLabel>Exchange Rate (PKR per USD) <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="1" className="min-h-[44px]" {...field}
                          onChange={(e) => field.onChange(e.target.valueAsNumber)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}
              </div>

              <Separator />

              <TenderLinesField banks={banks} currency={watchedCurrency} layout="wide" />

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
            </CardContent>
          </Card>

          {/* ── SUMMARY (right on xl, sticky) ── */}
          <div className="xl:sticky xl:top-6">
            <Card><CardContent className="px-5 pt-5 pb-5">
              <p className="font-extrabold text-[15px] tracking-tight mb-4">Payment Summary</p>

              <div className="space-y-2 text-sm">
                {showPicker && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">Agent</span>
                    <span className="font-medium text-right">{agentName ?? '—'}</span>
                  </div>
                )}
                {due !== 0 && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">{due < 0 ? 'Paid in Advance' : 'Outstanding'}</span>
                    <span className="font-medium tabular-nums">{formatPKR(Math.abs(due))}</span>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Date</span>
                  <span className="font-medium tabular-nums">{watchedDate || '—'}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Currency</span>
                  <span className="font-medium">{watchedCurrency}</span>
                </div>
                {watchedCurrency === 'USD' && (
                  <>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground shrink-0">Rate</span>
                      <span className="font-medium tabular-nums">{watchedRate.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground shrink-0">Amount (USD)</span>
                      <span className="font-medium tabular-nums">USD {amount.toLocaleString()}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Tender Lines</span>
                  <span className="font-medium tabular-nums">{watchedLines.length}</span>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="flex justify-between items-center gap-2 mb-5">
                <span className="font-bold text-sm">Total</span>
                <span className="text-lg font-extrabold tabular-nums tracking-tight text-right">{formatPKR(totalPKR)}</span>
              </div>

              <div className="space-y-2">
                <Button type="submit" className="w-full min-h-[44px]" disabled={isPending}>
                  {isPending ? 'Saving…' : 'Record Payment'}
                </Button>
                <Button type="button" variant="outline" className="w-full min-h-[44px]" onClick={() => router.push(returnPath)}>
                  Cancel
                </Button>
              </div>
              {serverError && <p className="text-sm text-destructive mt-3">{serverError}</p>}
            </CardContent></Card>
          </div>

        </div>
      </form>
    </Form>
  )
}

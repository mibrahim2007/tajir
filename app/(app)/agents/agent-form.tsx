'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { createAgentAction } from '@/app/actions/create-agent'
import { editAgentAction } from '@/app/actions/edit-agent'
import { COMMISSION_TYPES, formatCommissionRate, type CommissionType } from '@/lib/agents/commission'
import { formatPKR } from '@/lib/utils/currency'
import { useEnterToNextField } from '@/hooks/use-enter-to-next-field'

const commissionType = z.enum(['percentage', 'per_unit', 'flat', 'none'])

const schema = z.object({
  name:      z.string().min(1, 'Name is required'),
  agentCode: z.string().optional(),
  cnic:      z.string().optional(),
  phone:     z.string().optional(),
  email:     z.string().optional(),
  city:      z.string().optional(),
  address:   z.string().optional(),
  saleCommissionType:     commissionType,
  saleCommissionRate:     z.number().min(0, 'Cannot be negative'),
  purchaseCommissionType: commissionType,
  purchaseCommissionRate: z.number().min(0, 'Cannot be negative'),
  openingBalance:             z.number().min(0, 'Cannot be negative'),
  openingBalanceCurrency:     z.enum(['PKR', 'USD']),
  openingBalanceExchangeRate: z.number().positive(),
  notes: z.string().optional(),
})
  .refine((d) => d.saleCommissionType !== 'percentage' || d.saleCommissionRate <= 100,
    { message: 'Cannot exceed 100%', path: ['saleCommissionRate'] })
  .refine((d) => d.purchaseCommissionType !== 'percentage' || d.purchaseCommissionRate <= 100,
    { message: 'Cannot exceed 100%', path: ['purchaseCommissionRate'] })

type FormValues = z.infer<typeof schema>

export type AgentFormValues = FormValues & { id: string }

const blank: FormValues = {
  name: '', agentCode: '', cnic: '', phone: '', email: '', city: '', address: '',
  saleCommissionType: 'percentage', saleCommissionRate: 0,
  purchaseCommissionType: 'percentage', purchaseCommissionRate: 0,
  openingBalance: 0, openingBalanceCurrency: 'PKR', openingBalanceExchangeRate: 1,
  notes: '',
}

// Unit shown beside the rate field, so "1.5" cannot be read as rupees when the
// basis is a percentage (or vice versa).
function unitFor(type: CommissionType): string {
  return COMMISSION_TYPES.find((t) => t.value === type)?.unit ?? ''
}

/** One side's basis + rate. The rate disappears entirely for 'none'. */
function CommissionSideFields({
  form, side, label, hint,
}: {
  form: ReturnType<typeof useForm<FormValues>>
  side: 'sale' | 'purchase'
  label: string
  hint: string
}) {
  const typeName: 'saleCommissionType' | 'purchaseCommissionType' =
    side === 'sale' ? 'saleCommissionType' : 'purchaseCommissionType'
  const rateName: 'saleCommissionRate' | 'purchaseCommissionRate' =
    side === 'sale' ? 'saleCommissionRate' : 'purchaseCommissionRate'
  const type = form.watch(typeName)

  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField control={form.control} name={typeName} render={({ field }) => (
          <FormItem>
            <FormLabel>Commission Type</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl><SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>
                {COMMISSION_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        {type !== 'none' && (
          <FormField control={form.control} name={rateName} render={({ field }) => (
            <FormItem>
              <FormLabel>Rate <span className="text-muted-foreground font-normal">({unitFor(type)})</span></FormLabel>
              <FormControl>
                <Input type="number" step="0.0001" min="0" className="min-h-[44px]" {...field}
                  onChange={(e) => field.onChange(e.target.valueAsNumber || 0)} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        )}
      </div>
    </div>
  )
}

/**
 * Enrolment / edit form for a commission agent, as a full page at /agents/new
 * and /agents/[id]/edit (was a drawer on the agents list, which it returns to).
 *
 * `agent` switches it to edit mode. Both modes share one form because the field
 * set is identical — and the commission terms are the point of the record, so
 * they must be as easy to correct as they are to set.
 */
export function AgentForm({ agent }: { agent?: AgentFormValues }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const handleEnterToNext = useEnterToNextField()
  const isEdit = !!agent

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: agent ? { ...blank, ...agent } : blank,
  })

  const currency = form.watch('openingBalanceCurrency')
  const watched = form.watch()

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setServerError(null)
      const result = isEdit
        ? await editAgentAction({ id: agent!.id, ...values })
        : await createAgentAction(values)
      if (!result.success) { setServerError(result.error); return }
      // Back to the list. No router.refresh() inside the transition — it
      // keeps isPending stuck.
      router.push('/agents')
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} onKeyDown={handleEnterToNext}>
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">

          {/* ── FORM (left on xl) ── */}
          <Card className="min-w-0">
            <CardHeader className="pb-3 pt-5 px-5">
              <CardTitle className="text-base">Agent Details</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem className="md:col-span-6">
                    <FormLabel>Name <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input placeholder="Agent / broker name" className="min-h-[44px]" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="agentCode" render={({ field }) => (
                  <FormItem className="md:col-span-3">
                    <FormLabel>Code (optional)</FormLabel>
                    <FormControl><Input placeholder="e.g. AG-01" className="min-h-[44px]" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem className="md:col-span-3">
                    <FormLabel>Phone (optional)</FormLabel>
                    <FormControl><Input placeholder="03xx-xxxxxxx" className="min-h-[44px]" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="cnic" render={({ field }) => (
                  <FormItem className="md:col-span-4">
                    <FormLabel>CNIC (optional)</FormLabel>
                    <FormControl><Input placeholder="xxxxx-xxxxxxx-x" className="min-h-[44px]" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="city" render={({ field }) => (
                  <FormItem className="md:col-span-4">
                    <FormLabel>City (optional)</FormLabel>
                    <FormControl><Input placeholder="e.g. Faisalabad" className="min-h-[44px]" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem className="md:col-span-4">
                    <FormLabel>Email (optional)</FormLabel>
                    <FormControl><Input placeholder="name@example.com" className="min-h-[44px]" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                <CommissionSideFields
                  form={form} side="sale" label="Sale Commission"
                  hint="Applied to sales this agent introduces."
                />
                <CommissionSideFields
                  form={form} side="purchase" label="Purchase Commission"
                  hint="Applied to purchases this agent arranges."
                />
              </div>

              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Commission is expensed to <span className="font-medium">Commission Expense (6500)</span> and owed on{' '}
                <span className="font-medium">Agent Commission Payable (2150)</span>. Purchase commission does{' '}
                <span className="font-medium">not</span> change stock value. An invoice can override these
                defaults for a one-off deal, and changing a rate here never restates commission already posted.
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                <FormField control={form.control} name="openingBalance" render={({ field }) => (
                  <FormItem className="md:col-span-4">
                    <FormLabel>Opening Balance</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" className="min-h-[44px]" {...field}
                        onChange={(e) => field.onChange(e.target.valueAsNumber || 0)} />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">Commission already owed on day one.</p>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="openingBalanceCurrency" render={({ field }) => (
                  <FormItem className="md:col-span-4">
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

                {currency === 'USD' && (
                  <FormField control={form.control} name="openingBalanceExchangeRate" render={({ field }) => (
                    <FormItem className="md:col-span-4">
                      <FormLabel>Exchange Rate (PKR per USD)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="1" className="min-h-[44px]" {...field}
                          onChange={(e) => field.onChange(e.target.valueAsNumber || 1)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}

                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem className="md:col-span-12">
                    <FormLabel>Note (optional)</FormLabel>
                    <FormControl><Input placeholder="e.g. Handles Karachi mills" className="min-h-[44px]" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          {/* ── SUMMARY (right on xl, sticky) ── */}
          <div className="xl:sticky xl:top-6">
            <Card>
              <CardContent className="px-5 pt-5 pb-5">
                <p className="font-extrabold text-[15px] tracking-tight mb-4">Agent Summary</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium text-right truncate">{watched.name || '—'}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">On Sales</span>
                    <span className="text-right tabular-nums">{formatCommissionRate(watched.saleCommissionType, Number(watched.saleCommissionRate) || 0)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">On Purchases</span>
                    <span className="text-right tabular-nums">{formatCommissionRate(watched.purchaseCommissionType, Number(watched.purchaseCommissionRate) || 0)}</span>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="flex justify-between gap-3 mb-5 text-sm">
                  <span className="text-muted-foreground">Opening Balance</span>
                  <span className="font-medium tabular-nums">
                    {currency !== 'PKR' ? `${currency} ${(Number(watched.openingBalance) || 0).toLocaleString()}` : formatPKR(Number(watched.openingBalance) || 0)}
                  </span>
                </div>

                <div className="space-y-2">
                  <Button type="submit" className="w-full min-h-[44px]" disabled={isPending}>
                    {isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Enrol Agent'}
                  </Button>
                  <Button type="button" variant="outline" className="w-full min-h-[44px]" onClick={() => router.push('/agents')}>
                    Cancel
                  </Button>
                </div>

                {serverError && <p className="text-sm text-destructive mt-3">{serverError}</p>}
              </CardContent>
            </Card>
          </div>

        </div>
      </form>
    </Form>
  )
}

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { createAgentAction } from '@/app/actions/create-agent'
import { editAgentAction } from '@/app/actions/edit-agent'
import { COMMISSION_TYPES, type CommissionType } from '@/lib/agents/commission'
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
 * Enrolment / edit sheet for a commission agent.
 *
 * `agent` switches it to edit mode. Both modes share one form because the field
 * set is identical — and the commission terms are the point of the record, so
 * they must be as easy to correct as they are to set.
 */
export function AgentForm({ agent }: { agent?: AgentFormValues }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const handleEnterToNext = useEnterToNextField()
  const isEdit = !!agent

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: agent ? { ...blank, ...agent } : blank,
  })

  const currency = form.watch('openingBalanceCurrency')

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setServerError(null)
      const result = isEdit
        ? await editAgentAction({ id: agent!.id, ...values })
        : await createAgentAction(values)
      if (!result.success) { setServerError(result.error); return }
      if (!isEdit) form.reset(blank)
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {isEdit ? (
          <button type="button" className="text-xs underline underline-offset-4 text-muted-foreground hover:text-foreground">
            Edit
          </button>
        ) : (
          <Button variant="outline" className="min-h-[44px]"><Plus className="h-4 w-4 mr-2" />Enrol Agent</Button>
        )}
      </SheetTrigger>
      <SheetContent className="overflow-y-auto w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{isEdit ? `Edit ${agent!.name}` : 'Enrol Agent'}</SheetTitle>
          <SheetDescription>
            A broker who introduces trade. Commission accrues automatically on every
            invoice they are named on, and is paid out from their ledger.
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} onKeyDown={handleEnterToNext} className="flex flex-col gap-4 mt-6">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Name <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input placeholder="Agent / broker name" className="min-h-[44px]" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="agentCode" render={({ field }) => (
                <FormItem>
                  <FormLabel>Code (optional)</FormLabel>
                  <FormControl><Input placeholder="e.g. AG-01" className="min-h-[44px]" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone (optional)</FormLabel>
                  <FormControl><Input placeholder="03xx-xxxxxxx" className="min-h-[44px]" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="cnic" render={({ field }) => (
                <FormItem>
                  <FormLabel>CNIC (optional)</FormLabel>
                  <FormControl><Input placeholder="xxxxx-xxxxxxx-x" className="min-h-[44px]" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="city" render={({ field }) => (
                <FormItem>
                  <FormLabel>City (optional)</FormLabel>
                  <FormControl><Input placeholder="e.g. Faisalabad" className="min-h-[44px]" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>Email (optional)</FormLabel>
                <FormControl><Input placeholder="name@example.com" className="min-h-[44px]" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <Separator />

            <CommissionSideFields
              form={form} side="sale" label="Sale Commission"
              hint="Applied to sales this agent introduces."
            />
            <CommissionSideFields
              form={form} side="purchase" label="Purchase Commission"
              hint="Applied to purchases this agent arranges."
            />

            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Commission is expensed to <span className="font-medium">Commission Expense (6500)</span> and owed on{' '}
              <span className="font-medium">Agent Commission Payable (2150)</span>. Purchase commission does{' '}
              <span className="font-medium">not</span> change stock value. An invoice can override these
              defaults for a one-off deal, and changing a rate here never restates commission already posted.
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="openingBalance" render={({ field }) => (
                <FormItem>
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

            {currency === 'USD' && (
              <FormField control={form.control} name="openingBalanceExchangeRate" render={({ field }) => (
                <FormItem>
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
              <FormItem>
                <FormLabel>Note (optional)</FormLabel>
                <FormControl><Input placeholder="e.g. Handles Karachi mills" className="min-h-[44px]" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {serverError && <p className="text-sm text-destructive">{serverError}</p>}
            <Button type="submit" className="w-full min-h-[44px]" disabled={isPending}>
              {isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Enrol Agent'}
            </Button>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}

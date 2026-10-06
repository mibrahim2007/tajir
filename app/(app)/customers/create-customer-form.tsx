'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CurrencyInput } from '@/components/currency-input'
import { createCustomerAction } from '@/app/actions/create-customer'
import { useEnterToNextField } from '@/hooks/use-enter-to-next-field'
import { optionalEmailField } from '@/lib/email/address'
import { CUSTOMER_STATUSES, CUSTOMER_STATUS_LABELS } from '@/lib/customer-status'
import { formatCurrency, formatPKR } from '@/lib/utils/currency'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: optionalEmailField,
  phone: z.string().optional(),
  status: z.enum(['active', 'inactive', 'low_transaction']).default('active'),
  openingBalance: z.number().default(0),
  openingBalanceCurrency: z.enum(['PKR', 'USD']).default('PKR'),
  exchangeRate: z.number().positive().default(1),
})

type FormValues = z.infer<typeof schema>

// Full-page form at /customers/new (was a drawer on the customers list).
export function CreateCustomerForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const handleEnterToNext = useEnterToNextField()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: { name: '', email: '', phone: '', status: 'active', openingBalance: 0, openingBalanceCurrency: 'PKR', exchangeRate: 1 },
  })

  const watched = form.watch()
  const balance = Number.isFinite(watched.openingBalance) ? watched.openingBalance : 0
  const rate = Number.isFinite(watched.exchangeRate) ? watched.exchangeRate : 0

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setServerError(null)
      const result = await createCustomerAction(values)
      if (!result.success) { setServerError(result.error); return }
      // Back to the list, which re-renders with the new customer. No
      // router.refresh() inside the transition — it keeps isPending stuck.
      router.push('/customers')
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} onKeyDown={handleEnterToNext}>
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">

          {/* ── FORM (left on xl) ── */}
          <Card className="min-w-0">
            <CardHeader className="pb-3 pt-5 px-5">
              <CardTitle className="text-base">Customer Details</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem className="md:col-span-6">
                  <FormLabel>Name <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input placeholder="Customer name" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem className="md:col-span-6">
                  <FormLabel>Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="min-h-[44px] w-full"><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CUSTOMER_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{CUSTOMER_STATUS_LABELS[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Optional — but it is what /ask offers when you email this
                  customer their own ledger or statement. */}
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem className="md:col-span-6">
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" inputMode="email" placeholder="name@example.com" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">Optional. Lets you email this customer their ledger from Ask.</p>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Drives the wa.me deep link when sharing an invoice. */}
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem className="md:col-span-6">
                  <FormLabel>WhatsApp / Phone</FormLabel>
                  <FormControl>
                    <Input type="tel" inputMode="tel" placeholder="0300 1234567" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">Optional. Lets you send this customer their invoice on WhatsApp.</p>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="md:col-span-12">
                <CurrencyInput
                  amountName="openingBalance"
                  currencyName="openingBalanceCurrency"
                  exchangeRateName="exchangeRate"
                  label="Opening Balance"
                  allowNegative
                />
              </div>
            </CardContent>
          </Card>

          {/* ── SUMMARY (right on xl, sticky) ── */}
          <div className="xl:sticky xl:top-6">
            <Card>
              <CardContent className="px-5 pt-5 pb-5">
                <p className="font-extrabold text-[15px] tracking-tight mb-4">Customer Summary</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium text-right truncate">{watched.name || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span>{CUSTOMER_STATUS_LABELS[watched.status] ?? '—'}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Phone</span>
                    <span className="text-right truncate tabular-nums">{watched.phone || '—'}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Email</span>
                    <span className="text-right truncate">{watched.email || '—'}</span>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="space-y-2 mb-5 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Opening Balance</span>
                    <span className="font-medium tabular-nums">{formatCurrency(balance, watched.openingBalanceCurrency)}</span>
                  </div>
                  {watched.openingBalanceCurrency === 'USD' && (
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">PKR equivalent</span>
                      <span className="tabular-nums">{formatPKR(balance * rate)}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Button type="submit" className="w-full min-h-[44px]" disabled={isPending}>
                    {isPending ? 'Creating…' : 'Create Customer'}
                  </Button>
                  <Button type="button" variant="outline" className="w-full min-h-[44px]" onClick={() => router.push('/customers')}>
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

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CurrencyInput } from '@/components/currency-input'
import { editCustomerAction } from '@/app/actions/edit-customer'
import { setCustomerOpeningBalance } from '@/app/actions/set-opening-balance'
import { CUSTOMER_STATUSES, CUSTOMER_STATUS_LABELS, toCustomerStatus, type CustomerStatus } from '@/lib/customer-status'
import { formatCurrency, formatPKR } from '@/lib/utils/currency'

type FormValues = {
  name: string
  email: string
  phone: string
  status: CustomerStatus
  openingBalance: number
  openingBalanceCurrency: 'PKR' | 'USD'
  exchangeRate: number
}

type Props = {
  id: string
  currentName: string
  currentEmail?: string | null
  currentPhone?: string | null
  currentStatus?: string
  currentOpeningBalance?: number
  currentOpeningBalanceCurrency?: string
  currentOpeningBalancePkr?: number
}

// Full-page form at /customers/[id]/edit (was a drawer on the customers list).
export function EditCustomerForm({
  id,
  currentName,
  currentEmail,
  currentPhone,
  currentStatus,
  currentOpeningBalance = 0,
  currentOpeningBalanceCurrency,
  currentOpeningBalancePkr = 0,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const currency = (currentOpeningBalanceCurrency || 'PKR') as 'PKR' | 'USD'
  // The exchange rate itself is not stored — recover it from the PKR equivalent.
  const rate = currency === 'USD' && currentOpeningBalance !== 0
    ? currentOpeningBalancePkr / currentOpeningBalance
    : 1

  const defaults: FormValues = {
    name: currentName,
    email: currentEmail ?? '',
    phone: currentPhone ?? '',
    status: toCustomerStatus(currentStatus),
    openingBalance: currentOpeningBalance,
    openingBalanceCurrency: currency,
    exchangeRate: rate,
  }

  const form = useForm<FormValues>({ defaultValues: defaults })

  const watched = form.watch()
  const balance = Number.isFinite(watched.openingBalance) ? watched.openingBalance : 0
  const watchedRate = Number.isFinite(watched.exchangeRate) ? watched.exchangeRate : 0

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setError(null)
      const result = await editCustomerAction({ id, name: values.name, email: values.email, phone: values.phone, status: values.status })
      if (!result.success) { setError(result.error); return }

      const amount = Number.isFinite(values.openingBalance) ? values.openingBalance : 0
      const exchangeRate = values.openingBalanceCurrency === 'USD'
        ? (Number.isFinite(values.exchangeRate) && values.exchangeRate > 0 ? values.exchangeRate : 0)
        : 1
      const balanceChanged =
        amount !== defaults.openingBalance ||
        values.openingBalanceCurrency !== defaults.openingBalanceCurrency ||
        exchangeRate !== defaults.exchangeRate

      if (balanceChanged) {
        if (values.openingBalanceCurrency === 'USD' && exchangeRate <= 0) {
          setError('Exchange rate is required for a USD opening balance')
          return
        }
        const obResult = await setCustomerOpeningBalance({
          customerId: id,
          openingBalance: amount,
          currencyCode: values.openingBalanceCurrency,
          exchangeRate,
        })
        if (!obResult.success) { setError(obResult.error); return }
      }

      // Back to the list, which re-renders with the changes. No
      // router.refresh() inside the transition — it keeps isPending stuck.
      router.push('/customers')
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">

          {/* ── FORM (left on xl) ── */}
          <Card className="min-w-0">
            <CardHeader className="pb-3 pt-5 px-5">
              <CardTitle className="text-base">Customer Details</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem className="md:col-span-6">
                  <FormLabel>Name</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
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
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem className="md:col-span-6">
                  <FormLabel>WhatsApp / Phone</FormLabel>
                  <FormControl>
                    <Input type="tel" inputMode="tel" placeholder="0300 1234567" {...field} value={field.value ?? ''} />
                  </FormControl>
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
                      <span className="tabular-nums">{formatPKR(balance * watchedRate)}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Button type="submit" className="w-full min-h-[44px]" disabled={isPending}>
                    {isPending ? 'Saving…' : 'Save'}
                  </Button>
                  <Button type="button" variant="outline" className="w-full min-h-[44px]" onClick={() => router.push('/customers')}>
                    Cancel
                  </Button>
                </div>

                {error && <p className="text-sm text-destructive mt-3">{error}</p>}
              </CardContent>
            </Card>
          </div>

        </div>
      </form>
    </Form>
  )
}

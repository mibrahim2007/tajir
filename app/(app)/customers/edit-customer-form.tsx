'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CurrencyInput } from '@/components/currency-input'
import { editCustomerAction } from '@/app/actions/edit-customer'
import { setCustomerOpeningBalance } from '@/app/actions/set-opening-balance'
import { CUSTOMER_STATUSES, CUSTOMER_STATUS_LABELS, toCustomerStatus, type CustomerStatus } from '@/lib/customer-status'

type FormValues = {
  name: string
  status: CustomerStatus
  openingBalance: number
  openingBalanceCurrency: 'PKR' | 'USD'
  exchangeRate: number
}

type Props = {
  id: string
  currentName: string
  currentStatus?: string
  currentOpeningBalance?: number
  currentOpeningBalanceCurrency?: string
  currentOpeningBalancePkr?: number
}

export function EditCustomerForm({
  id,
  currentName,
  currentStatus,
  currentOpeningBalance = 0,
  currentOpeningBalanceCurrency,
  currentOpeningBalancePkr = 0,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const currency = (currentOpeningBalanceCurrency || 'PKR') as 'PKR' | 'USD'
  // The exchange rate itself is not stored — recover it from the PKR equivalent.
  const rate = currency === 'USD' && currentOpeningBalance !== 0
    ? currentOpeningBalancePkr / currentOpeningBalance
    : 1

  const defaults: FormValues = {
    name: currentName,
    status: toCustomerStatus(currentStatus),
    openingBalance: currentOpeningBalance,
    openingBalanceCurrency: currency,
    exchangeRate: rate,
  }

  const form = useForm<FormValues>({ defaultValues: defaults })

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setError(null)
      const result = await editCustomerAction({ id, name: values.name, status: values.status })
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

      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (o) { setError(null); form.reset(defaults) } }}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="min-h-[44px]"><Pencil className="h-4 w-4" /></Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader><SheetTitle>Edit Customer</SheetTitle></SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 mt-6">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="status" render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger>
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
            <CurrencyInput
              amountName="openingBalance"
              currencyName="openingBalanceCurrency"
              exchangeRateName="exchangeRate"
              label="Opening Balance"
              allowNegative
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full min-h-[44px]" disabled={isPending}>
              {isPending ? 'Saving…' : 'Save'}
            </Button>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}

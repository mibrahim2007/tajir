'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { CurrencyInput } from '@/components/currency-input'
import { editSupplierAction } from '@/app/actions/edit-supplier'
import { setSupplierOpeningBalance } from '@/app/actions/set-opening-balance'

type FormValues = {
  name: string
  email: string
  openingBalance: number
  openingBalanceCurrency: 'PKR' | 'USD'
  exchangeRate: number
}

type Props = {
  id: string
  currentName: string
  currentEmail?: string | null
  currentOpeningBalance?: number
  currentOpeningBalanceCurrency?: string
  currentOpeningBalancePkr?: number
}

export function EditSupplierForm({
  id,
  currentName,
  currentEmail,
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
    email: currentEmail ?? '',
    openingBalance: currentOpeningBalance,
    openingBalanceCurrency: currency,
    exchangeRate: rate,
  }

  const form = useForm<FormValues>({ defaultValues: defaults })

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setError(null)
      const result = await editSupplierAction({ id, name: values.name, email: values.email })
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
        const obResult = await setSupplierOpeningBalance({
          supplierId: id,
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
        <SheetHeader><SheetTitle>Edit Supplier</SheetTitle></SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 mt-6">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" inputMode="email" placeholder="name@example.com" {...field} value={field.value ?? ''} />
                </FormControl>
                <p className="text-xs text-muted-foreground">Optional. Lets you email this supplier their ledger from Ask.</p>
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

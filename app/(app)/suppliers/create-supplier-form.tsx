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
import { CurrencyInput } from '@/components/currency-input'
import { createSupplierAction } from '@/app/actions/create-supplier'
import { useEnterToNextField } from '@/hooks/use-enter-to-next-field'
import { optionalEmailField } from '@/lib/email/address'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: optionalEmailField,
  openingBalance: z.number().default(0),
  openingBalanceCurrency: z.enum(['PKR', 'USD']).default('PKR'),
  exchangeRate: z.number().positive().default(1),
})

type FormValues = z.infer<typeof schema>

export function CreateSupplierForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const handleEnterToNext = useEnterToNextField()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: { name: '', email: '', openingBalance: 0, openingBalanceCurrency: 'PKR', exchangeRate: 1 },
  })

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setServerError(null)
      const result = await createSupplierAction(values)
      if (!result.success) { setServerError(result.error); return }
      form.reset()
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="min-h-[44px]"><Plus className="h-4 w-4 mr-2" />Add Supplier</Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>New Supplier</SheetTitle>
          <SheetDescription>Add a supplier and optional opening balance.</SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} onKeyDown={handleEnterToNext} className="flex flex-col gap-4 mt-6">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Name <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input placeholder="Supplier name" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Optional — but it is what /ask offers when you email this
                  supplier their own ledger or statement. */}
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

              {serverError && <p className="text-sm text-destructive">{serverError}</p>}
              <Button type="submit" className="w-full min-h-[44px]" disabled={isPending}>
                {isPending ? 'Creating…' : 'Create Supplier'}
              </Button>
            </form>
          </Form>
      </SheetContent>
    </Sheet>
  )
}

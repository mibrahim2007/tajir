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
import { createCustomerAction } from '@/app/actions/create-customer'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  openingBalance: z.number().min(0).default(0),
  openingBalanceCurrency: z.enum(['PKR', 'USD']).default('PKR'),
  exchangeRate: z.number().positive().default(1),
})

type FormValues = z.infer<typeof schema>

export function CreateCustomerForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: { name: '', openingBalance: 0, openingBalanceCurrency: 'PKR', exchangeRate: 1 },
  })

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setServerError(null)
      const result = await createCustomerAction(values)
      if (!result.success) { setServerError(result.error); return }
      form.reset()
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="min-h-[44px]"><Plus className="h-4 w-4 mr-2" />Add Customer</Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>New Customer</SheetTitle>
          <SheetDescription>Add a customer and optional opening balance.</SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 mt-6">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Name <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input placeholder="Customer name" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <CurrencyInput
              amountName="openingBalance"
              currencyName="openingBalanceCurrency"
              exchangeRateName="exchangeRate"
              label="Opening Balance"
            />

            {serverError && <p className="text-sm text-destructive">{serverError}</p>}
            <Button type="submit" className="w-full min-h-[44px]" disabled={isPending}>
              {isPending ? 'Creating…' : 'Create Customer'}
            </Button>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}

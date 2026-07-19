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
import { createOwnerAction } from '@/app/actions/create-owner'
import { useEnterToNextField } from '@/hooks/use-enter-to-next-field'

const schema = z.object({
  name:           z.string().min(1, 'Name is required'),
  cnic:           z.string().optional(),
  phone:          z.string().optional(),
  email:          z.string().optional(),
  profitSharePct: z.number().min(0, 'Cannot be negative').max(100, 'Cannot exceed 100%').default(0),
  notes:          z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function CreateOwnerForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const handleEnterToNext = useEnterToNextField()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: { name: '', cnic: '', phone: '', email: '', profitSharePct: 0, notes: '' },
  })

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setServerError(null)
      const result = await createOwnerAction(values)
      if (!result.success) { setServerError(result.error); return }
      form.reset()
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="min-h-[44px]"><Plus className="h-4 w-4 mr-2" />Add Owner</Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>New Owner</SheetTitle>
          <SheetDescription>Add a partner to track their capital and drawings separately.</SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} onKeyDown={handleEnterToNext} className="flex flex-col gap-4 mt-6">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Name <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input placeholder="Owner / partner name" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="cnic" render={({ field }) => (
                <FormItem>
                  <FormLabel>CNIC (optional)</FormLabel>
                  <FormControl><Input placeholder="xxxxx-xxxxxxx-x" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone (optional)</FormLabel>
                  <FormControl><Input placeholder="03xx-xxxxxxx" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>Email (optional)</FormLabel>
                <FormControl><Input placeholder="name@example.com" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="profitSharePct" render={({ field }) => (
              <FormItem>
                <FormLabel>Profit Share %</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" min="0" max="100" placeholder="0.00" {...field}
                    onChange={(e) => field.onChange(e.target.valueAsNumber || 0)} />
                </FormControl>
                <p className="text-xs text-muted-foreground">Used for reporting. Profit is not auto-allocated yet.</p>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Note (optional)</FormLabel>
                <FormControl><Input placeholder="e.g. Sleeping partner" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {serverError && <p className="text-sm text-destructive">{serverError}</p>}
            <Button type="submit" className="w-full min-h-[44px]" disabled={isPending}>
              {isPending ? 'Creating…' : 'Create Owner'}
            </Button>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}

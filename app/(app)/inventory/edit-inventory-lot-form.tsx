'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { editInventoryLotAction } from '@/app/actions/edit-inventory-lot'

const schema = z.object({
  name:  z.string().min(1, 'Name is required'),
  code:  z.string().optional(),
  count: z.string().min(1, 'Count is required'),
  type:  z.enum(['combed', 'carded']),
  fiber: z.string().min(1, 'Fiber is required'),
  lot:   z.string().optional(),
})

type FormValues = z.infer<typeof schema>

type Lot = {
  id: string
  name: string
  code: string | null
  count: string
  type: string | null
  fiber: string | null
  lot: string | null
}

export function EditInventoryLotForm({ lot }: { lot: Lot }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name:  lot.name,
      code:  lot.code ?? '',
      count: lot.count,
      type:  (lot.type ?? 'combed') as 'combed' | 'carded',
      fiber: lot.fiber ?? '',
      lot:   lot.lot ?? '',
    },
  })

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setError(null)
      const result = await editInventoryLotAction({ id: lot.id, ...values })
      if (!result.success) { setError(result.error); return }
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="min-h-[44px]"><Pencil className="h-4 w-4" /></Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader><SheetTitle>Edit Stock Item</SheetTitle></SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 mt-6">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Name <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="code" render={({ field }) => (
              <FormItem>
                <FormLabel>Code</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="count" render={({ field }) => (
              <FormItem>
                <FormLabel>Count <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="type" render={({ field }) => (
              <FormItem>
                <FormLabel>Type <span className="text-destructive">*</span></FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="combed">Combed</SelectItem>
                    <SelectItem value="carded">Carded</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="fiber" render={({ field }) => (
              <FormItem>
                <FormLabel>Fiber <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="lot" render={({ field }) => (
              <FormItem>
                <FormLabel>Lot</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
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

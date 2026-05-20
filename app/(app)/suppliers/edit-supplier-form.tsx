'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { editSupplierAction } from '@/app/actions/edit-supplier'

export function EditSupplierForm({ id, currentName }: { id: string; currentName: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const form = useForm({ defaultValues: { name: currentName } })

  const onSubmit = (values: { name: string }) => {
    startTransition(async () => {
      setError(null)
      const result = await editSupplierAction({ id, name: values.name })
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
      <SheetContent>
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

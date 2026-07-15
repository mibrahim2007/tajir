'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { createItemTypeAction } from '@/app/actions/create-item-type'

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  subTypes: z.array(z.object({ name: z.string().max(100) })),
})
type FormValues = z.infer<typeof schema>

export function CreateItemTypeSheet() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', subTypes: [] },
  })
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'subTypes' })

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setError(null)
      const result = await createItemTypeAction({
        name: values.name,
        subTypes: values.subTypes.map((s) => s.name),
      })
      if (!result.success) { setError(result.error); return }
      form.reset({ name: '', subTypes: [] })
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" className="min-h-[36px]">
          <Plus className="h-4 w-4 mr-1" />Add Item Type
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader><SheetTitle>New Item Type</SheetTitle></SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 mt-6">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Name <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input placeholder="e.g. Yarn, Grey Fabric…" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex flex-col gap-2">
              <FormLabel>Sub Types</FormLabel>
              <p className="text-xs text-muted-foreground -mt-1">
                Optional. Sub-types appear under this type when creating a stock item.
              </p>
              {fields.map((f, index) => (
                <div key={f.id} className="flex gap-2">
                  <Input
                    placeholder="e.g. 150D Polyester"
                    {...form.register(`subTypes.${index}.name`)}
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}
                    className="text-muted-foreground hover:text-destructive shrink-0">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="gap-1.5 self-start"
                onClick={() => append({ name: '' })}>
                <Plus className="size-4" /> Add sub type
              </Button>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full min-h-[44px]" disabled={isPending}>
              {isPending ? 'Creating…' : 'Create Item Type'}
            </Button>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { editItemTypeAction } from '@/app/actions/edit-item-type'
import { deleteItemTypeAction } from '@/app/actions/delete-item-type'

type SubType = { id: string; name: string }

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  subTypes: z.array(z.object({ id: z.string().optional(), name: z.string().max(100) })),
})
type FormValues = z.infer<typeof schema>

export function ItemTypeActions({ id, name, subTypes = [] }: { id: string; name: string; subTypes?: SubType[] }) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const initial = (): FormValues => ({ name, subTypes: subTypes.map((s) => ({ id: s.id, name: s.name })) })

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial(),
  })
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'subTypes' })

  const onEdit = (values: FormValues) => {
    startTransition(async () => {
      setError(null)
      const result = await editItemTypeAction({ id, name: values.name, subTypes: values.subTypes })
      if (!result.success) { setError(result.error); return }
      setEditOpen(false)
      router.refresh()
    })
  }

  const onDelete = () => {
    const extra = subTypes.length > 0 ? ` Its ${subTypes.length} sub-type${subTypes.length > 1 ? 's' : ''} will also be removed.` : ''
    if (!confirm(`Delete item type "${name}"? Stock items using this type will be unlinked.${extra}`)) return
    startTransition(async () => {
      await deleteItemTypeAction(id)
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-1">
      <Sheet open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (o) form.reset(initial()) }}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
            <Pencil className="size-4" />
          </Button>
        </SheetTrigger>
        <SheetContent className="overflow-y-auto">
          <SheetHeader><SheetTitle>Edit Item Type</SheetTitle></SheetHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onEdit)} className="flex flex-col gap-4 mt-6">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Name <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input {...field} /></FormControl>
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
                {isPending ? 'Saving…' : 'Save'}
              </Button>
            </form>
          </Form>
        </SheetContent>
      </Sheet>

      <Button
        variant="ghost"
        size="sm"
        disabled={isPending}
        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
        onClick={onDelete}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  )
}

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { editItemTypeAction } from '@/app/actions/edit-item-type'

type SubType = { id: string; name: string }

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  subTypes: z.array(z.object({ id: z.string().optional(), name: z.string().max(100) })),
})
type FormValues = z.infer<typeof schema>

// Full-page form at /item-types/[id]/edit (was a drawer in the item type row actions).
export function EditItemTypeForm({ id, name, subTypes = [] }: { id: string; name: string; subTypes?: SubType[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name, subTypes: subTypes.map((s) => ({ id: s.id, name: s.name })) },
  })
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'subTypes' })
  const watched = form.watch()

  const onEdit = (values: FormValues) => {
    startTransition(async () => {
      setError(null)
      const result = await editItemTypeAction({ id, name: values.name, subTypes: values.subTypes })
      if (!result.success) { setError(result.error); return }
      // Back to the list, which re-renders with the change. No
      // router.refresh() inside the transition — it keeps isPending stuck.
      router.push('/item-types')
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onEdit)}>
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">

          {/* ── FORM (left on xl) ── */}
          <Card className="min-w-0">
            <CardHeader className="pb-3 pt-5 px-5">
              <CardTitle className="text-base">Item Type Details</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem className="md:col-span-6">
                  <FormLabel>Name <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="md:col-span-12 flex flex-col gap-2">
                <FormLabel>Sub Types</FormLabel>
                <p className="text-xs text-muted-foreground -mt-1">
                  Optional. Sub-types appear under this type when creating a stock item.
                </p>
                {fields.map((f, index) => (
                  <div key={f.id} className="flex gap-2 md:max-w-[50%]">
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
            </CardContent>
          </Card>

          {/* ── SUMMARY (right on xl, sticky) ── */}
          <div className="xl:sticky xl:top-6">
            <Card>
              <CardContent className="px-5 pt-5 pb-5">
                <p className="font-extrabold text-[15px] tracking-tight mb-4">Item Type Summary</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium text-right truncate">{watched.name || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sub types</span>
                    <span className="tabular-nums">{watched.subTypes.filter((s) => s.name.trim()).length}</span>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="space-y-2">
                  <Button type="submit" className="w-full min-h-[44px]" disabled={isPending}>
                    {isPending ? 'Saving…' : 'Save'}
                  </Button>
                  <Button type="button" variant="outline" className="w-full min-h-[44px]" onClick={() => router.push('/item-types')}>
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

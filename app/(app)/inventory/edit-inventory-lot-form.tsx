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

const UOM_OPTIONS = ['KG', 'Cone', 'Meter', 'Yard', 'Roll', 'Bag', 'Bale', 'Piece', 'Bundle'] as const

const schema = z.object({
  name:          z.string().min(1, 'Name is required'),
  code:          z.string().optional(),
  count:         z.string().optional(),
  unitOfMeasure: z.string().optional(),
  itemTypeId:    z.string().uuid().optional(),
  fiber:         z.string().optional(),
  lot:           z.string().optional(),
})

type FormValues = z.infer<typeof schema>
type ItemType = { id: string; name: string }

type Lot = {
  id: string
  name: string
  code: string | null
  count: string
  unitOfMeasure: string | null
  itemTypeId: string | null
  fiber: string | null
  lot: string | null
}

export function EditInventoryLotForm({ lot, itemTypes }: { lot: Lot; itemTypes: ItemType[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name:          lot.name,
      code:          lot.code ?? '',
      count:         lot.count,
      unitOfMeasure: lot.unitOfMeasure ?? undefined,
      itemTypeId:    lot.itemTypeId ?? undefined,
      fiber:         lot.fiber ?? '',
      lot:           lot.lot ?? '',
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
                <FormLabel>Count</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="unitOfMeasure" render={({ field }) => (
              <FormItem>
                <FormLabel>Unit of Measure</FormLabel>
                <Select
                  value={field.value ?? '_none_'}
                  onValueChange={(v) => field.onChange(v === '_none_' ? undefined : v)}
                >
                  <FormControl>
                    <SelectTrigger className="min-h-[44px]">
                      <SelectValue placeholder="Select unit…" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="_none_">No unit</SelectItem>
                    {UOM_OPTIONS.map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="itemTypeId" render={({ field }) => (
              <FormItem>
                <FormLabel>Item Type</FormLabel>
                <Select
                  value={field.value ?? '_none_'}
                  onValueChange={(v) => field.onChange(v === '_none_' ? undefined : v)}
                  disabled={itemTypes.length === 0}
                >
                  <FormControl>
                    <SelectTrigger className="min-h-[44px]">
                      <SelectValue placeholder={itemTypes.length === 0 ? 'No types defined' : 'Select type…'} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="_none_">No type</SelectItem>
                    {itemTypes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {itemTypes.length === 0 && (
                  <p className="text-xs text-muted-foreground">Add item types in Settings → Item Types</p>
                )}
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="fiber" render={({ field }) => (
              <FormItem>
                <FormLabel>Fiber</FormLabel>
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

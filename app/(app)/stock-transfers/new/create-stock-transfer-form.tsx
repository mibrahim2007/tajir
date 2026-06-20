'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ItemPickerDialog } from '@/components/item-picker-dialog'
import { createStockTransferAction } from '@/app/actions/create-stock-transfer'

const schema = z.object({
  fromLocationId: z.string().uuid('Select from-location'),
  toLocationId:   z.string().uuid('Select to-location'),
  stockItemId:    z.string().uuid('Select stock item'),
  quantity:       z.number().positive('Quantity must be positive'),
  date:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  notes:          z.string().max(500).optional(),
}).refine(
  (d) => d.fromLocationId !== d.toLocationId,
  { message: 'From and To must be different', path: ['toLocationId'] },
)

type FormValues = z.infer<typeof schema>

type Props = {
  today: string
  locations: { id: string; name: string }[]
  items: { id: string; name: string; count: string }[]
}

export function CreateStockTransferForm({ today, locations, items }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)

  const itemPickerItems = items.map(i => ({ id: i.id, name: i.name, badge: i.count }))

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fromLocationId: '', toLocationId: '', stockItemId: '',
      quantity: 0, date: today, notes: '',
    },
  })

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setServerError(null)
      const result = await createStockTransferAction(values)
      if (!result.success) { setServerError(result.error); return }
      router.push('/stock-transfers')
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <Card>
          <CardHeader className="pb-4 pt-5 px-5">
            <CardTitle className="text-base">Transfer Details</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 grid gap-4 sm:grid-cols-2">
            <FormField control={form.control} name="date" render={({ field }) => (
              <FormItem>
                <FormLabel>Date <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="stockItemId" render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Stock Item <span className="text-destructive">*</span></FormLabel>
                <FormControl>
                  <ItemPickerDialog
                    items={itemPickerItems}
                    value={field.value}
                    onSelect={field.onChange}
                    placeholder="Select item…"
                    title="Select Stock Item"
                    disabled={items.length === 0}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="fromLocationId" render={({ field }) => (
              <FormItem>
                <FormLabel>From Location <span className="text-destructive">*</span></FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Select location…" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="toLocationId" render={({ field }) => (
              <FormItem>
                <FormLabel>To Location <span className="text-destructive">*</span></FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Select location…" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="quantity" render={() => (
              <FormItem>
                <FormLabel>Quantity <span className="text-destructive">*</span></FormLabel>
                <FormControl>
                  <Input type="number" min={0.001} step="0.001" placeholder="0"
                    {...form.register('quantity', { valueAsNumber: true })} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Notes</FormLabel>
                <FormControl><Textarea placeholder="Optional notes…" rows={2} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </CardContent>
        </Card>

        {serverError && <p className="text-sm text-destructive">{serverError}</p>}

        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1 min-h-[44px]" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" className="flex-1 min-h-[44px]" disabled={isPending || locations.length < 2}>
            {isPending ? 'Saving…' : 'Confirm Transfer'}
          </Button>
        </div>
        {locations.length < 2 && (
          <p className="text-xs text-muted-foreground text-center">Add at least 2 locations first.</p>
        )}
      </form>
    </Form>
  )
}

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
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

// Full-page form at /owners/new (was a drawer on the owners list).
export function CreateOwnerForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const handleEnterToNext = useEnterToNextField()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: { name: '', cnic: '', phone: '', email: '', profitSharePct: 0, notes: '' },
  })

  const watched = form.watch()

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setServerError(null)
      const result = await createOwnerAction(values)
      if (!result.success) { setServerError(result.error); return }
      // Back to the list, which re-renders with the new owner. No
      // router.refresh() inside the transition — it keeps isPending stuck.
      router.push('/owners')
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} onKeyDown={handleEnterToNext}>
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">

          {/* ── FORM (left on xl) ── */}
          <Card className="min-w-0">
            <CardHeader className="pb-3 pt-5 px-5">
              <CardTitle className="text-base">Owner Details</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem className="md:col-span-6">
                  <FormLabel>Name <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input placeholder="Owner / partner name" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="cnic" render={({ field }) => (
                <FormItem className="md:col-span-3">
                  <FormLabel>CNIC (optional)</FormLabel>
                  <FormControl><Input placeholder="xxxxx-xxxxxxx-x" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem className="md:col-span-3">
                  <FormLabel>Phone (optional)</FormLabel>
                  <FormControl><Input placeholder="03xx-xxxxxxx" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem className="md:col-span-6">
                  <FormLabel>Email (optional)</FormLabel>
                  <FormControl><Input placeholder="name@example.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="profitSharePct" render={({ field }) => (
                <FormItem className="md:col-span-6">
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
                <FormItem className="md:col-span-12">
                  <FormLabel>Note (optional)</FormLabel>
                  <FormControl><Input placeholder="e.g. Sleeping partner" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* ── SUMMARY (right on xl, sticky) ── */}
          <div className="xl:sticky xl:top-6">
            <Card>
              <CardContent className="px-5 pt-5 pb-5">
                <p className="font-extrabold text-[15px] tracking-tight mb-4">Owner Summary</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium text-right truncate">{watched.name || '—'}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">CNIC</span>
                    <span className="text-right truncate">{watched.cnic || '—'}</span>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="flex justify-between gap-3 mb-5 text-sm">
                  <span className="text-muted-foreground">Profit Share</span>
                  <span className="font-medium tabular-nums">{(Number(watched.profitSharePct) || 0).toFixed(2)}%</span>
                </div>

                <div className="space-y-2">
                  <Button type="submit" className="w-full min-h-[44px]" disabled={isPending}>
                    {isPending ? 'Creating…' : 'Create Owner'}
                  </Button>
                  <Button type="button" variant="outline" className="w-full min-h-[44px]" onClick={() => router.push('/owners')}>
                    Cancel
                  </Button>
                </div>

                {serverError && <p className="text-sm text-destructive mt-3">{serverError}</p>}
              </CardContent>
            </Card>
          </div>

        </div>
      </form>
    </Form>
  )
}

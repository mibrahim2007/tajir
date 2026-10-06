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
import { createEmployeeAction } from '@/app/actions/create-employee'
import { formatPKR } from '@/lib/utils/currency'
import { useEnterToNextField } from '@/hooks/use-enter-to-next-field'

const schema = z.object({
  name:          z.string().min(1, 'Name is required'),
  designation:   z.string().optional(),
  phone:         z.string().optional(),
  cnic:          z.string().optional(),
  monthlySalary: z.number().min(0).default(0),
})

type FormValues = z.infer<typeof schema>

// Full-page form at /employees/new (was a drawer on the employees list).
export function CreateEmployeeForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const handleEnterToNext = useEnterToNextField()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: { name: '', designation: '', phone: '', cnic: '', monthlySalary: 0 },
  })

  const watched = form.watch()

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setServerError(null)
      const result = await createEmployeeAction(values)
      if (!result.success) { setServerError(result.error); return }
      // Back to the list, which re-renders with the new employee. No
      // router.refresh() inside the transition — it keeps isPending stuck.
      router.push('/employees')
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} onKeyDown={handleEnterToNext}>
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">

          {/* ── FORM (left on xl) ── */}
          <Card className="min-w-0">
            <CardHeader className="pb-3 pt-5 px-5">
              <CardTitle className="text-base">Employee Details</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem className="md:col-span-6">
                  <FormLabel>Name <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input placeholder="Employee name" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="designation" render={({ field }) => (
                <FormItem className="md:col-span-6">
                  <FormLabel>Designation (optional)</FormLabel>
                  <FormControl><Input placeholder="e.g. Cashier" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem className="md:col-span-4">
                  <FormLabel>Phone (optional)</FormLabel>
                  <FormControl><Input placeholder="03xx-xxxxxxx" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="cnic" render={({ field }) => (
                <FormItem className="md:col-span-4">
                  <FormLabel>CNIC (optional)</FormLabel>
                  <FormControl><Input placeholder="xxxxx-xxxxxxx-x" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="monthlySalary" render={({ field }) => (
                <FormItem className="md:col-span-4">
                  <FormLabel>Monthly Salary (optional)</FormLabel>
                  <FormControl><Input type="number" step="0.01" min="0" placeholder="0.00" {...field} onChange={(e) => field.onChange(e.target.valueAsNumber || 0)} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* ── SUMMARY (right on xl, sticky) ── */}
          <div className="xl:sticky xl:top-6">
            <Card>
              <CardContent className="px-5 pt-5 pb-5">
                <p className="font-extrabold text-[15px] tracking-tight mb-4">Employee Summary</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium text-right truncate">{watched.name || '—'}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Designation</span>
                    <span className="text-right truncate">{watched.designation || '—'}</span>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="flex justify-between gap-3 mb-5 text-sm">
                  <span className="text-muted-foreground">Monthly Salary</span>
                  <span className="font-medium tabular-nums">{formatPKR(Number(watched.monthlySalary) || 0)}</span>
                </div>

                <div className="space-y-2">
                  <Button type="submit" className="w-full min-h-[44px]" disabled={isPending}>
                    {isPending ? 'Creating…' : 'Create Employee'}
                  </Button>
                  <Button type="button" variant="outline" className="w-full min-h-[44px]" onClick={() => router.push('/employees')}>
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

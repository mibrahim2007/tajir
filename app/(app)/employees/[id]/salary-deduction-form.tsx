'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { recordSalaryDeductionAction } from '@/app/actions/record-salary-deduction'
import { formatPKR } from '@/lib/utils/currency'
import { useEnterToNextField } from '@/hooks/use-enter-to-next-field'

type LoanOption = { id: string; label: string }

const AUTO = '__auto__'

const schema = z.object({
  loanId: z.string().default(AUTO),
  amount: z.number().positive('Enter a positive amount'),
  date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  note:   z.string().optional(),
})

type FormValues = z.infer<typeof schema>

const freshDefaults = (today: string): FormValues => ({ loanId: AUTO, amount: 0, date: today, note: '' })

export function SalaryDeductionForm({ employeeId, today, monthlySalary = 0, loans = [] }: { employeeId: string; today: string; monthlySalary?: number; loans?: LoanOption[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const handleEnterToNext = useEnterToNextField()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: freshDefaults(today),
  })

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setServerError(null)
      const result = await recordSalaryDeductionAction({
        employeeId,
        loanId: values.loanId === AUTO ? undefined : values.loanId,
        amount: values.amount,
        date: values.date,
        note: values.note,
      })
      if (!result.success) { setServerError(result.error); return }
      form.reset(freshDefaults(today))
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="min-h-[44px]">Salary Deduction</Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Recover via Salary Deduction</SheetTitle>
          <SheetDescription>Withhold part of this month&apos;s salary against the loan. No cash moves — it posts Salaries &amp; Wages against the loan balance.</SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} onKeyDown={handleEnterToNext} className="flex flex-col gap-4 mt-6">
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input type="date" className="min-h-[44px]" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount (PKR) <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input type="number" step="0.01" min="0" className="min-h-[44px]" placeholder="0.00" {...field} onChange={(e) => field.onChange(e.target.valueAsNumber || 0)} /></FormControl>
                  {monthlySalary > 0 && <p className="text-xs text-muted-foreground">Monthly salary: {formatPKR(monthlySalary)}</p>}
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {loans.length > 0 && (
              <FormField control={form.control} name="loanId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Apply to loan</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value={AUTO}>Auto (oldest first)</SelectItem>
                      {loans.map((l) => (
                        <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            )}

            <FormField control={form.control} name="note" render={({ field }) => (
              <FormItem>
                <FormLabel>Note (optional)</FormLabel>
                <FormControl><Input placeholder="e.g. March payroll" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {serverError && <p className="text-sm text-destructive">{serverError}</p>}
            <Button type="submit" className="w-full min-h-[44px]" disabled={isPending}>
              {isPending ? 'Saving…' : 'Record Deduction'}
            </Button>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}

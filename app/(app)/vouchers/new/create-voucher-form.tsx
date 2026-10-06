'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ExitButton } from '@/components/exit-button'
import { useForm, useFieldArray, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createJournalEntryAction } from '@/app/actions/create-journal-entry'
import { useEnterToNextField } from '@/hooks/use-enter-to-next-field'
import { FileUploader, type FileUploaderHandle } from '@/components/file-uploader'
import { todayPKT } from '@/lib/utils/dates'

const lineSchema = z.object({
  accountId:   z.string().min(1, 'Account required'),
  description: z.string().optional(),
  debit:       z.number().min(0),
  credit:      z.number().min(0),
}).refine(
  (d) => d.debit > 0 || d.credit > 0,
  { message: 'Enter debit or credit amount', path: ['debit'] },
)

const schema = z.object({
  date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  description: z.string().min(1, 'Narration is required'),
  reference:   z.string().optional(),
  bankId:      z.string().optional(),
  lines:       z.array(lineSchema).min(2),
})

type FormValues = z.infer<typeof schema>
type Account   = { id: string; code: string; name: string; account_type: string }
type Bank      = { id: string; name: string; account_number: string | null }

type Props = {
  today:     string
  accounts:  Account[]
  customers: { id: string; name: string }[]
  suppliers: { id: string; name: string }[]
  lots:      { id: string; name: string }[]
  banks:     Bank[]
}

const TYPE_ORDER = ['asset', 'liability', 'equity', 'revenue', 'expense']

// Journal-line columns: Account | Description | Debit | Credit | remove.
// minmax(0,…) lets the text columns shrink so a long account name never
// pushes the grid past the card. Below lg each line stacks as its own card.
const LINE_COLS = 'lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)_170px_170px_36px]'

// Per-field label shown only while lines stack (the heading row is hidden).
function CellLabel({ children }: { children: React.ReactNode }) {
  return <span className="lg:hidden text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{children}</span>
}

export function CreateVoucherForm({ today, accounts, banks }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const uploaderRef = useRef<FileUploaderHandle>(null)
  const handleEnterToNext = useEnterToNextField()

  const grouped = TYPE_ORDER.map((type) => ({
    type,
    label: type.charAt(0).toUpperCase() + type.slice(1),
    items: accounts.filter((a) => a.account_type === type),
  })).filter((g) => g.items.length > 0)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      date: today, description: '', reference: '', bankId: '',
      lines: [
        { accountId: '', description: '', debit: 0, credit: 0 },
        { accountId: '', description: '', debit: 0, credit: 0 },
      ],
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' })
  const lines = form.watch('lines')

  const totalDebit  = lines.reduce((s, l) => s + (l.debit  || 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0)
  const isBalanced  = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0
  const fmt = (n: number) => n.toLocaleString('en-PK', { minimumFractionDigits: 2 })

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setServerError(null)
      const result = await createJournalEntryAction({
        ...values,
        reference: values.reference || undefined,
        bankId: values.bankId || undefined,
        lines: values.lines.map((l) => ({ ...l, description: l.description || undefined })),
      })
      if (!result.success) { setServerError(result.error); return }
      await uploaderRef.current?.uploadFiles(result.data.id, 'journal_entry')
      router.push(`/vouchers/${result.data.id}`)
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} onKeyDown={handleEnterToNext}>
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">

          {/* ── LEFT COLUMN ── */}
          <div className="space-y-5">

            {/* Header card */}
            <Card>
              <CardHeader className="pb-3 pt-5 px-5">
                <CardTitle className="text-base">Voucher Details</CardTitle>
              </CardHeader>
              {/* Date · Reference · Bank share one row on wide screens; Narration runs full width. */}
              <CardContent className="px-5 pb-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                <FormField control={form.control} name="date" render={({ field }) => (
                  <FormItem className="md:col-span-3">
                    <FormLabel>Date <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input type="date" max={todayPKT()} className="min-h-[44px]" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="reference" render={({ field }) => (
                  <FormItem className={banks.length > 0 ? 'md:col-span-4' : 'md:col-span-9'}>
                    <FormLabel>Reference</FormLabel>
                    <FormControl><Input placeholder="Cheque no., bill no.…" className="min-h-[44px]" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {banks.length > 0 && (
                  <FormField control={form.control} name="bankId" render={({ field }) => (
                    <FormItem className="md:col-span-5">
                      <FormLabel>Bank (optional)</FormLabel>
                      <Select onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)} value={field.value || '__none__'}>
                        <FormControl>
                          <SelectTrigger className="min-h-[44px] w-full"><SelectValue placeholder="Cash / no bank" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">Cash / no bank</SelectItem>
                          {banks.map((b) => (
                            <SelectItem key={b.id} value={b.id}>{b.name}{b.account_number ? ` — ${b.account_number}` : ''}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}

                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem className="md:col-span-12">
                    <FormLabel>Narration <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input placeholder="Being…" className="min-h-[44px]" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            {/* Journal Lines card */}
            <Card>
              <CardHeader className="pb-2 pt-5 px-5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Journal Lines</CardTitle>
                  <Button type="button" variant="outline" size="sm"
                    onClick={() => append({ accountId: '', description: '', debit: 0, credit: 0 })}>
                    Add Line
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <div className="lg:rounded-lg lg:border lg:overflow-hidden">
                  {/* Column headings — hidden while lines stack */}
                  <div className={`hidden lg:grid ${LINE_COLS} gap-2 items-center bg-muted/50 border-b px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground`}>
                    <span>Account</span>
                    <span>Description</span>
                    <span className="text-right">Debit</span>
                    <span className="text-right">Credit</span>
                    <span />
                  </div>

                  <div className="space-y-3 lg:space-y-0 lg:divide-y">
                    {fields.map((field, index) => (
                      <div key={field.id} className={`grid grid-cols-2 gap-2 rounded-lg border p-3 lg:rounded-none lg:border-0 lg:px-3 lg:py-1.5 lg:items-start ${LINE_COLS}`}>
                        <div className="col-span-2 lg:col-span-1 space-y-1">
                          <CellLabel>Account</CellLabel>
                          <FormField control={form.control} name={`lines.${index}.accountId`} render={({ field: f, fieldState }) => (
                            <div>
                              <Select onValueChange={f.onChange} value={f.value}>
                                <SelectTrigger className={`min-h-[40px] w-full min-w-0 text-xs [&>span]:truncate ${fieldState.error ? 'border-destructive ring-destructive' : ''}`}>
                                  <SelectValue placeholder="Select account… *" />
                                </SelectTrigger>
                                <SelectContent>
                                  {grouped.map((g) => (
                                    <div key={g.type}>
                                      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{g.label}</div>
                                      {g.items.map((a) => (
                                        <SelectItem key={a.id} value={a.id} className="text-xs">
                                          <span className="font-mono text-muted-foreground mr-2">{a.code}</span>{a.name}
                                        </SelectItem>
                                      ))}
                                    </div>
                                  ))}
                                </SelectContent>
                              </Select>
                              {fieldState.error && (
                                <p className="text-xs text-destructive mt-0.5">{fieldState.error.message}</p>
                              )}
                            </div>
                          )} />
                        </div>
                        <div className="col-span-2 lg:col-span-1 space-y-1">
                          <CellLabel>Description</CellLabel>
                          <Input placeholder="Details…" className="min-h-[40px] text-xs"
                            {...form.register(`lines.${index}.description`)} />
                        </div>
                        <div className="space-y-1">
                          <CellLabel>Debit</CellLabel>
                          <Input type="number" step="0.01" min="0"
                            className={`min-h-[40px] text-right tabular-nums text-xs ${form.formState.errors.lines?.[index]?.debit ? 'border-destructive' : ''}`}
                            {...form.register(`lines.${index}.debit`, {
                              valueAsNumber: true,
                              onChange: (e) => {
                                if (parseFloat(e.target.value) > 0) form.setValue(`lines.${index}.credit`, 0)
                              },
                            })}
                          />
                          {form.formState.errors.lines?.[index]?.debit && (
                            <p className="text-xs text-destructive mt-0.5 whitespace-nowrap">
                              {form.formState.errors.lines[index].debit.message}
                            </p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <CellLabel>Credit</CellLabel>
                          <Input type="number" step="0.01" min="0"
                            className="min-h-[40px] text-right tabular-nums text-xs"
                            {...form.register(`lines.${index}.credit`, {
                              valueAsNumber: true,
                              onChange: (e) => {
                                if (parseFloat(e.target.value) > 0) form.setValue(`lines.${index}.debit`, 0)
                              },
                            })}
                          />
                        </div>
                        {/* Remove — the cell collapses on a stacked line that has no button */}
                        <div className={`col-span-2 lg:col-span-1 items-center justify-end lg:justify-center lg:min-h-[40px] ${fields.length > 2 ? 'flex' : 'hidden lg:flex'}`}>
                          {fields.length > 2 && (
                            <button type="button" onClick={() => remove(index)}
                              className="text-muted-foreground hover:text-destructive text-lg leading-none px-1">
                              ×
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div className={`mt-3 grid grid-cols-2 gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs lg:mt-0 lg:rounded-none lg:border-0 lg:border-t ${LINE_COLS}`}>
                    <span className="col-span-2 font-semibold">Total</span>
                    <span className={`text-right font-semibold tabular-nums ${!isBalanced && totalDebit > 0 ? 'text-destructive' : ''}`}>
                      <CellLabel>Dr </CellLabel>{fmt(totalDebit)}
                    </span>
                    <span className={`text-right font-semibold tabular-nums ${!isBalanced && totalCredit > 0 ? 'text-destructive' : ''}`}>
                      <CellLabel>Cr </CellLabel>{fmt(totalCredit)}
                    </span>
                    <span className="hidden lg:block" />
                  </div>
                </div>
                {totalDebit > 0 && !isBalanced && (
                  <p className="text-xs text-destructive mt-2">
                    Difference: {Math.abs(totalDebit - totalCredit).toFixed(2)} — debits must equal credits.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── RIGHT COLUMN — sticky summary ── */}
          <div className="xl:sticky xl:top-6">
            <Card>
              <CardContent className="px-5 pt-5 pb-5">
                <p className="font-extrabold text-[15px] tracking-tight mb-4">Voucher Summary</p>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Debit</span>
                    <span className="tabular-nums font-medium">Rs {fmt(totalDebit)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Credit</span>
                    <span className="tabular-nums font-medium">Rs {fmt(totalCredit)}</span>
                  </div>
                  {totalDebit > 0 && !isBalanced && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Difference</span>
                      <span className="tabular-nums font-medium text-destructive">
                        Rs {Math.abs(totalDebit - totalCredit).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>

                <Separator className="my-4" />

                <div className="flex items-center gap-2 mb-5">
                  {isBalanced ? (
                    <>
                      <CheckCircle2 className="size-4 text-green-600 shrink-0" />
                      <span className="text-sm font-semibold text-green-600">Balanced</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="size-4 text-destructive shrink-0" />
                      <span className="text-sm text-muted-foreground">
                        {totalDebit === 0 ? 'Enter journal lines' : 'Not balanced'}
                      </span>
                    </>
                  )}
                </div>

                <div className="space-y-2">
                  <Button type="submit" className="w-full min-h-[44px]" disabled={isPending || !isBalanced}>
                    {isPending ? 'Posting…' : 'Post Voucher'}
                  </Button>
                  <ExitButton
                    isDirty={form.formState.isDirty}
                    onExit={() => router.back()}
                    className="w-full min-h-[44px]"
                  />
                </div>

                {serverError && <p className="text-sm text-destructive mt-3">{serverError}</p>}

                <div className="mt-4 pt-4 border-t">
                  <FileUploader ref={uploaderRef} />
                </div>
              </CardContent>
            </Card>
          </div>

        </div>
      </form>
    </Form>
  )
}

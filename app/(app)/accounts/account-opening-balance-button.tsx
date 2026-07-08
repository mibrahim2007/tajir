'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { setAccountOpeningBalanceAction } from '@/app/actions/set-account-opening-balance'

const schema = z.object({
  amount: z.coerce.number().min(0, 'Amount must be 0 or greater'),
  date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date'),
})
type FormValues = z.infer<typeof schema>

export type OpeningBalanceAccount = {
  id: string
  code: string
  name: string
  account_type: string
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

const DEBIT_NORMAL = new Set(['asset', 'expense'])

export function AccountOpeningBalanceButton({
  account,
  current,
}: {
  account: OpeningBalanceAccount
  current: { amount: number; date: string } | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const hasBalance = !!current && current.amount > 0
  const side = DEBIT_NORMAL.has(account.account_type) ? 'debit' : 'credit'

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      amount: current?.amount ?? 0,
      date:   current?.date ?? today(),
    },
  })

  const submit = (amount: number) => {
    startTransition(async () => {
      setError(null)
      const result = await setAccountOpeningBalanceAction({
        accountId: account.id,
        amount,
        date:      form.getValues('date') || today(),
      })
      if (!result.success) { setError(result.error); return }
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) {
          form.reset({ amount: current?.amount ?? 0, date: current?.date ?? today() })
          setError(null)
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`h-8 w-8 p-0 ${hasBalance ? 'text-emerald-600 hover:text-emerald-700' : 'text-muted-foreground hover:text-foreground'}`}
          title={hasBalance ? 'Edit opening balance' : 'Set opening balance'}
        >
          <Wallet className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Opening Balance</DialogTitle>
          <DialogDescription>
            <span className="font-mono">{account.code}</span> — {account.name}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => submit(v.amount))} className="flex flex-col gap-4">
            <FormField control={form.control} name="amount" render={({ field }) => (
              <FormItem>
                <FormLabel>Amount (PKR) <span className="text-destructive">*</span></FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" min="0" inputMode="decimal" placeholder="0.00" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="date" render={({ field }) => (
              <FormItem>
                <FormLabel>As of date <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <p className="text-xs text-muted-foreground">
              Posted as a {side} to <span className="font-medium">{account.name}</span>, offset against{' '}
              <span className="font-medium">Opening Balance Equity</span>. Re-saving replaces the previous opening balance.
            </p>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter className="gap-2 sm:gap-2">
              {hasBalance && (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[44px]"
                  disabled={isPending}
                  onClick={() => submit(0)}
                >
                  Clear
                </Button>
              )}
              <Button type="submit" className="min-h-[44px] flex-1" disabled={isPending}>
                {isPending ? 'Saving…' : 'Save Opening Balance'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

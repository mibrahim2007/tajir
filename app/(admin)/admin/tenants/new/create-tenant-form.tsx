'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createTenantAction } from '@/app/actions/admin/create-tenant'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  subscriptionStatus: z.enum(['active', 'grace_period', 'locked', 'cancelled']).default('active'),
})

type FormValues = z.infer<typeof schema>

export function CreateTenantForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: { name: '', subscriptionStatus: 'active' },
  })

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setError(null)
      const result = await createTenantAction(values)
      if (!result.success) { setError(result.error); return }
      router.push(`/admin/tenants/${result.data.id}/users`)
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem>
            <FormLabel>Business Name <span className="text-destructive">*</span></FormLabel>
            <FormControl>
              <Input placeholder="e.g. Al-Barakah Trading" className="min-h-[44px]" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="subscriptionStatus" render={({ field }) => (
          <FormItem>
            <FormLabel>Subscription Status</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="grace_period">Grace Period</SelectItem>
                <SelectItem value="locked">Locked</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="min-h-[44px]" disabled={isPending}>
          {isPending ? 'Creating…' : 'Create Tenant'}
        </Button>
      </form>
    </Form>
  )
}

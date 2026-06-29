'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { inviteAssistantAction } from '@/app/actions/invite-assistant'

const schema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['owner', 'assistant']),
})

type FormValues = z.infer<typeof schema>

export function InviteAssistantForm() {
  const [credentials, setCredentials] = useState<{ email: string; tempPassword: string } | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', role: 'assistant' },
  })

  const onSubmit = async (values: FormValues) => {
    setServerError(null)
    const fd = new FormData()
    fd.set('email', values.email)
    fd.set('role', values.role)

    const result = await inviteAssistantAction(fd)
    if (!result.success) {
      setServerError(result.error)
      return
    }
    setCredentials(result.data)
    form.reset()
  }

  if (credentials) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="text-lg text-green-800">Team member added</CardTitle>
          <CardDescription className="text-green-700">
            Share these credentials. The password will not be shown again.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-xs text-green-700 font-medium mb-1">Email</p>
            <p className="font-mono text-sm bg-white rounded px-3 py-2 border border-green-200">
              {credentials.email}
            </p>
          </div>
          <div>
            <p className="text-xs text-green-700 font-medium mb-1">Temporary Password</p>
            <p className="font-mono text-sm bg-white rounded px-3 py-2 border border-green-200 break-all">
              {credentials.tempPassword}
            </p>
          </div>
          <p className="text-xs text-green-700">They must change this password on first login.</p>
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-1"
            onClick={() => setCredentials(null)}
          >
            Invite Another
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Add Team Member</CardTitle>
        <CardDescription>
          Create login credentials for a new team member and assign their role.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="team@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="assistant">
                        Assistant — sales, purchases, inventory, receipts &amp; payments
                      </SelectItem>
                      <SelectItem value="owner">
                        Owner — full access including reports, settings &amp; delete
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {serverError && <p className="text-sm text-destructive">{serverError}</p>}
            <Button
              type="submit"
              className="w-full min-h-[44px]"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? 'Creating…' : 'Create Account'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

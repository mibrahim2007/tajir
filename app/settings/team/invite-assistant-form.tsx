'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { inviteAssistantAction } from '@/app/actions/invite-assistant'

const schema = z.object({
  email: z.string().email('Invalid email address'),
})

type FormValues = z.infer<typeof schema>

export function InviteAssistantForm() {
  const [credentials, setCredentials] = useState<{ email: string; tempPassword: string } | null>(
    null,
  )
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  })

  const onSubmit = async (values: FormValues) => {
    setServerError(null)
    const fd = new FormData()
    fd.set('email', values.email)

    const result = await inviteAssistantAction(fd)
    if (!result.success) {
      setServerError(result.error)
      return
    }
    setCredentials(result.data)
  }

  if (credentials) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="text-lg text-green-800">Assistant account created</CardTitle>
          <CardDescription className="text-green-700">
            Share these credentials with your assistant. The password will not be shown again.
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
          <p className="text-xs text-green-700">
            Your assistant must change this password on first login.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Create Assistant Credential</CardTitle>
        <CardDescription>
          Your assistant will use these credentials to log in. You can have one assistant at a time.
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
                  <FormLabel>Assistant Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="assistant@example.com" {...field} />
                  </FormControl>
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
              {form.formState.isSubmitting ? 'Creating…' : 'Create Assistant Credential'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

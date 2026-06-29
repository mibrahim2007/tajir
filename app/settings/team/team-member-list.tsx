'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  resetMemberPasswordAction,
  deactivateMemberAction,
  reactivateMemberAction,
  changeRoleAction,
} from '@/app/actions/manage-assistant'
import type { Role } from '@/db/schema'

export type TeamMember = {
  id: string
  userId: string
  email: string
  role: Role
  isActive: boolean
}

type Props = {
  members: TeamMember[]
  currentUserId: string
}

function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
        role === 'owner'
          ? 'bg-violet-100 text-violet-700'
          : 'bg-sky-100 text-sky-700'
      }`}
    >
      {role === 'owner' ? 'Owner' : 'Assistant'}
    </span>
  )
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
      }`}
    >
      {isActive ? 'Active' : 'Inactive'}
    </span>
  )
}

function MemberRow({
  member,
  isSelf,
  currentUserId,
}: {
  member: TeamMember
  isSelf: boolean
  currentUserId: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [deactivateOpen, setDeactivateOpen] = useState(false)

  const handleRoleChange = (newRole: string) => {
    startTransition(async () => {
      setError(null)
      const result = await changeRoleAction(member.id, newRole as Role)
      if (!result.success) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  const handleReset = async () => {
    setError(null)
    const result = await resetMemberPasswordAction(member.id)
    if (!result.success) {
      setError(result.error)
      return
    }
    setTempPassword(result.data.tempPassword)
    setResetOpen(false)
  }

  const handleDeactivate = () => {
    startTransition(async () => {
      setError(null)
      const result = await deactivateMemberAction(member.id)
      if (!result.success) {
        setError(result.error)
        return
      }
      setDeactivateOpen(false)
      router.refresh()
    })
  }

  const handleReactivate = () => {
    startTransition(async () => {
      setError(null)
      const result = await reactivateMemberAction(member.id)
      if (!result.success) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-2 p-4 border rounded-xl bg-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{member.email}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <StatusBadge isActive={member.isActive} />
            {isSelf && (
              <span className="text-xs text-muted-foreground">(you)</span>
            )}
          </div>
        </div>

        {/* Role selector */}
        <div className="shrink-0">
          <Select
            value={member.role}
            onValueChange={handleRoleChange}
            disabled={isPending || isSelf}
          >
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="owner">Owner</SelectItem>
              <SelectItem value="assistant">Assistant</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {tempPassword && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-3 space-y-1">
          <p className="text-xs font-medium text-green-700">New temporary password (shown once)</p>
          <p className="font-mono text-sm break-all">{tempPassword}</p>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {!isSelf && (
        <div className="flex gap-2 flex-wrap">
          {/* Reset Password */}
          <Dialog open={resetOpen} onOpenChange={setResetOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8"
                disabled={!member.isActive}
              >
                Reset Password
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reset password?</DialogTitle>
                <DialogDescription>
                  A new temporary password will be generated for{' '}
                  <span className="font-medium">{member.email}</span>. Share it with them — they
                  should change it after logging in.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setResetOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleReset} disabled={isPending}>
                  Generate Password
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Deactivate / Reactivate */}
          {member.isActive ? (
            <Dialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm" className="text-xs h-8" disabled={isPending}>
                  Deactivate
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Deactivate {member.email}?</DialogTitle>
                  <DialogDescription>
                    They will be immediately signed out and unable to log in until you reactivate
                    their account.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDeactivateOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={handleDeactivate} disabled={isPending}>
                    Deactivate
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8"
              onClick={handleReactivate}
              disabled={isPending}
            >
              Reactivate
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export function TeamMemberList({ members, currentUserId }: Props) {
  return (
    <div className="space-y-3">
      {members.map((member) => (
        <MemberRow
          key={member.id}
          member={member}
          isSelf={member.userId === currentUserId}
          currentUserId={currentUserId}
        />
      ))}
    </div>
  )
}

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
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
import { updateMemberPermissionsAction } from '@/app/actions/update-tenant-features'
import { ALL_MODULES, MODULE_META, DEFAULT_ASSISTANT_PERMISSIONS, type ModuleKey } from '@/lib/modules'
import type { Role } from '@/db/schema'

export type TeamMember = {
  id: string
  userId: string
  email: string
  role: Role
  isActive: boolean
  permissions: ModuleKey[] | null
}

type Props = {
  members: TeamMember[]
  currentUserId: string
  tenantModules: ModuleKey[]
}

function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
        role === 'owner' ? 'bg-violet-100 text-violet-700' : 'bg-sky-100 text-sky-700'
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

const SECTIONS = ['Trading', 'Finance', 'Accounting'] as const

function PermissionEditor({
  member,
  tenantModules,
}: {
  member: TeamMember
  tenantModules: ModuleKey[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tenantSet = new Set(tenantModules)
  const initialSet = member.permissions !== null
    ? new Set(member.permissions)
    : new Set([...DEFAULT_ASSISTANT_PERMISSIONS].filter((k) => tenantSet.has(k)))

  const [enabled, setEnabled] = useState<Set<ModuleKey>>(initialSet)

  const toggle = (key: ModuleKey) => {
    setSaved(false)
    setEnabled((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const save = () => {
    startTransition(async () => {
      setError(null)
      setSaved(false)
      const result = await updateMemberPermissionsAction(member.id, [...enabled] as ModuleKey[])
      if (!result.success) { setError(result.error); return }
      setSaved(true)
      router.refresh()
    })
  }

  return (
    <div className="pt-3 border-t border-border space-y-4">
      <p className="text-xs text-muted-foreground">
        Choose which modules this assistant can access. Only modules enabled for your account appear here.
      </p>
      {SECTIONS.map((section) => {
        const items = ALL_MODULES.filter((k) => MODULE_META[k].section === section && tenantSet.has(k))
        if (items.length === 0) return null
        return (
          <div key={section}>
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              {section}
            </p>
            <div className="space-y-1">
              {items.map((key) => {
                const meta = MODULE_META[key]
                const Icon = meta.icon
                return (
                  <div key={key} className="flex items-center justify-between py-1.5 gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs font-medium">{meta.label}</span>
                    </div>
                    <Switch
                      checked={enabled.has(key)}
                      onCheckedChange={() => toggle(key)}
                      className="scale-90"
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={save} disabled={isPending} className="h-8 text-xs">
          {isPending ? 'Saving…' : 'Save Permissions'}
        </Button>
        {saved && <span className="text-xs text-green-600 font-medium">Saved</span>}
      </div>
    </div>
  )
}

function MemberRow({
  member,
  isSelf,
  tenantModules,
}: {
  member: TeamMember
  isSelf: boolean
  tenantModules: ModuleKey[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [deactivateOpen, setDeactivateOpen] = useState(false)
  const [permOpen, setPermOpen] = useState(false)

  const handleRoleChange = (newRole: string) => {
    startTransition(async () => {
      setError(null)
      const result = await changeRoleAction(member.id, newRole as Role)
      if (!result.success) { setError(result.error); return }
      router.refresh()
    })
  }

  const handleReset = async () => {
    setError(null)
    const result = await resetMemberPasswordAction(member.id)
    if (!result.success) { setError(result.error); return }
    setTempPassword(result.data.tempPassword)
    setResetOpen(false)
  }

  const handleDeactivate = () => {
    startTransition(async () => {
      setError(null)
      const result = await deactivateMemberAction(member.id)
      if (!result.success) { setError(result.error); return }
      setDeactivateOpen(false)
      router.refresh()
    })
  }

  const handleReactivate = () => {
    startTransition(async () => {
      setError(null)
      const result = await reactivateMemberAction(member.id)
      if (!result.success) { setError(result.error); return }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-2 p-4 border rounded-xl bg-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{member.email}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <RoleBadge role={member.role} />
            <StatusBadge isActive={member.isActive} />
            {isSelf && <span className="text-xs text-muted-foreground">(you)</span>}
          </div>
        </div>

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
        <div className="flex gap-2 flex-wrap items-center">
          {/* Reset Password */}
          <Dialog open={resetOpen} onOpenChange={setResetOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs h-8" disabled={!member.isActive}>
                Reset Password
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reset password?</DialogTitle>
                <DialogDescription>
                  A new temporary password will be generated for{' '}
                  <span className="font-medium">{member.email}</span>.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setResetOpen(false)}>Cancel</Button>
                <Button onClick={handleReset} disabled={isPending}>Generate Password</Button>
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
                    They will be signed out immediately and cannot log in until reactivated.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDeactivateOpen(false)}>Cancel</Button>
                  <Button variant="destructive" onClick={handleDeactivate} disabled={isPending}>Deactivate</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : (
            <Button variant="outline" size="sm" className="text-xs h-8" onClick={handleReactivate} disabled={isPending}>
              Reactivate
            </Button>
          )}

          {/* Permissions toggle for assistants */}
          {member.role === 'assistant' && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-8 ml-auto text-muted-foreground"
              onClick={() => setPermOpen((v) => !v)}
            >
              {permOpen ? <ChevronUp className="h-3.5 w-3.5 mr-1" /> : <ChevronDown className="h-3.5 w-3.5 mr-1" />}
              Permissions
            </Button>
          )}
        </div>
      )}

      {permOpen && member.role === 'assistant' && (
        <PermissionEditor member={member} tenantModules={tenantModules} />
      )}
    </div>
  )
}

export function TeamMemberList({ members, currentUserId, tenantModules }: Props) {
  return (
    <div className="space-y-3">
      {members.map((member) => (
        <MemberRow
          key={member.id}
          member={member}
          isSelf={member.userId === currentUserId}
          tenantModules={tenantModules}
        />
      ))}
    </div>
  )
}

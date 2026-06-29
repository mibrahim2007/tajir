'use client'

import { useAuth } from '@/contexts/auth-context'
import type { Role } from '@/db/schema'

type RoleGateProps = {
  allowedRoles: Role[]
  children: React.ReactNode
}

export function RoleGate({ allowedRoles, children }: RoleGateProps) {
  const { role } = useAuth()
  if (!allowedRoles.includes(role)) return null
  return <>{children}</>
}

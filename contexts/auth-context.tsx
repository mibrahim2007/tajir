'use client'

import { createContext, useContext } from 'react'
import type { Role } from '@/db/schema'

export type AuthContextValue = {
  userId: string
  role: Role
  tenantId: string
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({
  children,
  value,
}: {
  children: React.ReactNode
  value: AuthContextValue
}) {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}

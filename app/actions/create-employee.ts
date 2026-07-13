'use server'

import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuditEntry } from '@/lib/audit/create-audit-entry'
import type { ActionResult } from '@/lib/types'

const schema = z.object({
  name:          z.string().trim().min(1, 'Name is required').max(200),
  employeeCode:  z.string().trim().max(50).optional(),
  phone:         z.string().trim().max(50).optional(),
  cnic:          z.string().trim().max(50).optional(),
  designation:   z.string().trim().max(100).optional(),
  monthlySalary: z.coerce.number().min(0).default(0),
})

// Creates an employee master record (owner-only). An employee is a distinct
// party — neither a customer nor a supplier.
export async function createEmployeeAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }

  const { user, role, tenantId } = await requireAuth()
  if (role !== 'owner') return { success: false, error: 'Only owners can manage employees', code: 'UNAUTHORIZED' }

  const tenant = await getTenant(tenantId)
  if (tenant.subscriptionStatus === 'locked') {
    return { success: false, error: 'Account locked', code: 'TENANT_LOCKED' }
  }

  const { name, employeeCode, phone, cnic, designation, monthlySalary } = parsed.data
  const admin = createAdminClient()

  const { data: employee, error } = await admin
    .from('employees')
    .insert({
      tenant_id:      tenantId,
      name,
      employee_code:  employeeCode || null,
      phone:          phone || null,
      cnic:           cnic || null,
      designation:    designation || null,
      monthly_salary: monthlySalary,
    })
    .select('id')
    .single()

  if (error || !employee) {
    return { success: false, error: 'Failed to create employee', code: 'INTERNAL_ERROR' }
  }

  await createAuditEntry({
    tenantId, userId: user.id, action: 'create', entity: 'employees', entityId: employee.id,
    after: { name, employeeCode, designation, monthlySalary },
  })

  return { success: true, data: employee }
}

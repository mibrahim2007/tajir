import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { tenants, type Tenant } from '@/db/schema'

export async function getTenant(tenantId: string): Promise<Tenant> {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1)

  if (!tenant) {
    throw new Error(`Tenant not found: ${tenantId}`)
  }

  return tenant
}

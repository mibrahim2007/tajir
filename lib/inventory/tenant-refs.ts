import type { SupabaseClient } from '@supabase/supabase-js'

// Grades and locations arrive as ids from the client; make sure each belongs to
// this tenant before it is written onto a line. Returns an error message, or
// null when every id checks out. Blank ids are skipped.
export async function checkTenantRefs(
  admin: SupabaseClient,
  tenantId: string,
  refs: { gradeIds?: (string | null | undefined)[]; locationIds?: (string | null | undefined)[] },
): Promise<string | null> {
  const gradeIds = [...new Set((refs.gradeIds ?? []).filter(Boolean) as string[])]
  if (gradeIds.length > 0) {
    const { data } = await admin.from('grades').select('id').eq('tenant_id', tenantId).in('id', gradeIds)
    if ((data ?? []).length !== gradeIds.length) return 'Grade not found'
  }
  const locationIds = [...new Set((refs.locationIds ?? []).filter(Boolean) as string[])]
  if (locationIds.length > 0) {
    const { data } = await admin.from('locations').select('id').eq('tenant_id', tenantId).in('id', locationIds)
    if ((data ?? []).length !== locationIds.length) return 'Location not found'
  }
  return null
}

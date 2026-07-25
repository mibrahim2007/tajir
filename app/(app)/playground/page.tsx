import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { listBatches } from '@/lib/playground/generate'
import { PlaygroundChat } from './playground-chat'

export const metadata = { title: 'Playground — Tajir' }

export default async function PlaygroundPage() {
  const { role, tenantId } = await requireAuth()
  // Generating demo data creates parties, users and postings — owner-only.
  if (role !== 'owner') redirect('/dashboard')

  const batches = await listBatches(tenantId)
  return <PlaygroundChat initialBatches={batches} />
}

import { requireAuth } from '@/lib/auth/require-auth'
import { HelpContent } from './help-content'

export const metadata = { title: 'Help Center — Tajir' }

export default async function HelpPage() {
  await requireAuth()
  return <HelpContent />
}

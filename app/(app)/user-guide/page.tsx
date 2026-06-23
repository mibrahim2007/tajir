import { requireAuth } from '@/lib/auth/require-auth'
import { GuideContent } from './guide-content'

export const metadata = { title: 'User Guide — Tajir' }

export default async function UserGuidePage() {
  await requireAuth()
  return <GuideContent />
}

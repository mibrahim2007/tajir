import { requireAuth } from '@/lib/auth/require-auth'
import { AskChat } from './ask-chat'

export const metadata = { title: 'Ask — Tajir' }

export default async function AskPage() {
  // Auth is enforced by the (app) layout; this call keeps the page dynamic and
  // confirms a session before rendering the chat. The email is passed only to
  // label the "send to me" option — the send action reads it again server-side.
  const { user } = await requireAuth()
  return <AskChat userEmail={user.email} />
}

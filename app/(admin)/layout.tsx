import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/require-admin'
import { LogoutButton } from '@/components/logout-button'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAdmin()

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/admin/tenants" className="font-semibold text-lg">
              Tajir Admin
            </Link>
            <nav className="flex items-center gap-1">
              <Link href="/admin/tenants" className="text-sm px-3 py-2 rounded-md hover:bg-accent whitespace-nowrap">
                Tenants
              </Link>
              <Link href="/admin/activity" className="text-sm px-3 py-2 rounded-md hover:bg-accent whitespace-nowrap">
                Activity
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">{user.email}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}

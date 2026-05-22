import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CreateTenantForm } from './create-tenant-form'

export default function NewTenantPage() {
  return (
    <div className="p-6 max-w-lg mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin/tenants">
          <Button variant="ghost" size="sm" className="min-h-[36px]">← Back</Button>
        </Link>
        <h1 className="text-2xl font-semibold">New Tenant</h1>
      </div>
      <CreateTenantForm />
    </div>
  )
}

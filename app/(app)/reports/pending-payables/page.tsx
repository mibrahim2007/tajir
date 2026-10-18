import { PendingInvoicesReport, type SearchParams } from '@/components/pending-invoices-report'

export default function PendingPayablesPage({ searchParams }: { searchParams: SearchParams }) {
  return <PendingInvoicesReport side="payable" searchParams={searchParams} />
}

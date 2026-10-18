import { PendingInvoicesReport, type SearchParams } from '@/components/pending-invoices-report'

export default function PendingReceivablesPage({ searchParams }: { searchParams: SearchParams }) {
  return <PendingInvoicesReport side="receivable" searchParams={searchParams} />
}

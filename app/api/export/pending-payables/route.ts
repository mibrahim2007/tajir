export const runtime = 'nodejs'

import { pendingInvoicesExport } from '@/lib/reports/pending-invoices-xlsx'

export function GET(request: Request) {
  return pendingInvoicesExport(request, 'payable')
}

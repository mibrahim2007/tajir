/**
 * Centered header block used at the top of every invoice/voucher printout.
 * Shows the business name, the tenant's NTN (National Tax Number) if set,
 * and the document title.
 */
export function PrintVoucherHeader({
  name,
  ntn,
  title,
}: {
  name: string
  ntn?: string | null
  title: string
}) {
  return (
    <div className="text-center mb-6 pb-4 border-b-2 border-black">
      <p className="text-xl font-extrabold tracking-wide uppercase">{name}</p>
      {ntn && (
        <p className="text-xs font-semibold text-gray-600 mt-0.5 print:text-gray-700">NTN: {ntn}</p>
      )}
      <p className="text-3xl font-bold tracking-widest uppercase mt-1">{title}</p>
    </div>
  )
}

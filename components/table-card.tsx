import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function TableCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('bg-card rounded-2xl border border-border shadow-sm overflow-hidden', className)}>
      {children}
    </div>
  )
}

export function Th({
  children,
  right,
  className,
}: {
  children?: ReactNode
  right?: boolean
  className?: string
}) {
  return (
    <th
      className={cn(
        'px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground',
        right ? 'text-right' : 'text-left',
        className
      )}
    >
      {children}
    </th>
  )
}

export function Td({
  children,
  right,
  mono,
  muted,
  strong,
  className,
}: {
  children?: ReactNode
  right?: boolean
  mono?: boolean
  muted?: boolean
  strong?: boolean
  className?: string
}) {
  return (
    <td
      className={cn(
        'px-4 py-3.5',
        right && 'text-right',
        mono && 'font-mono tabular-nums',
        muted && 'text-muted-foreground',
        strong && 'font-semibold',
        className
      )}
    >
      {children}
    </td>
  )
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-16 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

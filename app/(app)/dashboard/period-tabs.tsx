'use client'
import { usePathname, useRouter } from 'next/navigation'

const TABS = [
  { key: 'mtd',        label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'last_3m',    label: '3 Months'   },
  { key: 'ytd',        label: 'This Year'  },
] as const

export function DashboardPeriodTabs({ current }: { current: string }) {
  const router   = useRouter()
  const pathname = usePathname()
  return (
    <div className="inline-flex items-center gap-0.5 bg-muted p-1 rounded-xl">
      {TABS.map(t => (
        <button
          key={t.key}
          onClick={() => router.push(`${pathname}?period=${t.key}`, { scroll: false })}
          className={[
            'px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap',
            current === t.key
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          ].join(' ')}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

'use client'

import { useRouter } from 'next/navigation'

export function ActivityDatePicker({ date, max }: { date: string; max: string }) {
  const router = useRouter()
  return (
    <input
      type="date"
      defaultValue={date}
      max={max}
      onChange={(e) => {
        if (e.target.value) router.push(`/admin/activity?date=${e.target.value}`)
      }}
      className="h-9 rounded-md border bg-background px-3 text-sm cursor-pointer"
    />
  )
}

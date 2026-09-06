'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'

/**
 * Day / Night selector.
 *
 * A two-position segmented control rather than a single toggling icon: with one
 * icon you have to know whether it shows the current mode or the one you would
 * switch to, and people guess wrong. Here both options are always on screen and
 * the active one is lit, so there is nothing to infer.
 *
 * The theme lives on <html> as the `dark` class (next-themes), which is what
 * every token and every `dark:` variant in the app keys off, so one click
 * re-themes the whole application. The choice is remembered per browser.
 *
 * Nothing renders until after mount. The server has no way to know which theme
 * a given browser stored, so drawing the highlight during SSR would guess wrong
 * half the time and break hydration; a fixed-size placeholder holds the space
 * so the toolbar does not jump when it appears.
 */
export function ThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const { resolvedTheme, setTheme } = useTheme()

  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return <div className="h-9 w-[70px] rounded-xl border border-border" aria-hidden />
  }

  const isDark = resolvedTheme === 'dark'

  const option = (active: boolean) =>
    cn(
      'h-7 w-7 rounded-lg flex items-center justify-center transition-all',
      active
        ? 'bg-accent text-accent-foreground shadow-sm'
        : 'text-muted-foreground hover:text-foreground',
    )

  return (
    <div
      role="radiogroup"
      aria-label="Day or night theme"
      className="h-9 p-1 rounded-xl border border-border flex items-center gap-0.5 print:hidden"
    >
      <button
        type="button"
        role="radio"
        aria-checked={!isDark}
        aria-label="Day"
        title="Day"
        onClick={() => setTheme('light')}
        className={option(!isDark)}
      >
        <Sun className="h-4 w-4" />
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={isDark}
        aria-label="Night"
        title="Night"
        onClick={() => setTheme('dark')}
        className={option(isDark)}
      >
        <Moon className="h-4 w-4" />
      </button>
    </div>
  )
}

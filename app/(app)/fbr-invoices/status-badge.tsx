const STYLE: Record<string, { label: string; cls: string }> = {
  draft:   { label: 'Draft',            cls: 'bg-muted text-muted-foreground' },
  valid:   { label: 'Validated',        cls: 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300' },
  invalid: { label: 'Rejected by FBR',  cls: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400' },
  posting: { label: 'Posting…',         cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' },
  posted:  { label: 'Posted to FBR',    cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' },
  failed:  { label: 'Not sent',         cls: 'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300' },
}

export function FbrStatusBadge({ status }: { status: string }) {
  const s = STYLE[status] ?? { label: status, cls: 'bg-muted' }
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${s.cls}`}>{s.label}</span>
}

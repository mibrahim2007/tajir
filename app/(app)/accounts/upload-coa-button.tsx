'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { uploadChartOfAccountsAction } from '@/app/actions/upload-chart-of-accounts'

export function UploadCoaButton() {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ inserted: number; skipped: number } | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    setFileName(f ? f.name : null)
    setError(null)
    setResult(null)
  }

  const handleUpload = () => {
    const file = fileRef.current?.files?.[0]
    if (!file) { setError('Please select a CSV file'); return }
    const fd = new FormData()
    fd.append('file', file)
    startTransition(async () => {
      setError(null)
      setResult(null)
      const res = await uploadChartOfAccountsAction(fd)
      if (!res.success) { setError(res.error); return }
      setResult(res.data)
      router.refresh()
    })
  }

  const handleClose = () => {
    setOpen(false)
    setError(null)
    setResult(null)
    setFileName(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true) }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="min-h-[44px] gap-2">
          <Upload className="size-4" /> Upload CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Chart of Accounts</DialogTitle>
          <DialogDescription>
            Import accounts from a CSV file. Existing accounts (same code) are skipped.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* CSV format hint */}
          <div className="rounded-lg bg-muted p-3 text-xs font-mono text-muted-foreground space-y-0.5">
            <p className="font-semibold text-foreground mb-1">Required CSV format:</p>
            <p>code,name,type,parent_code,is_header,system_key</p>
            <p>1000,Assets,asset,,true,</p>
            <p>1100,Current Assets,asset,1000,true,</p>
            <p>1110,Cash in Hand,asset,1100,false,cash</p>
            <p className="pt-1 text-muted-foreground/70">type: asset · liability · equity · revenue · expense</p>
          </div>

          {/* File input */}
          <div>
            <label
              htmlFor="coa-file"
              className="flex flex-col items-center gap-2 p-6 border-2 border-dashed rounded-xl cursor-pointer hover:border-primary/50 hover:bg-muted/40 transition-colors"
            >
              <Upload className="size-6 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {fileName ? fileName : 'Click to select a .csv file'}
              </span>
            </label>
            <input
              id="coa-file"
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="sr-only"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive whitespace-pre-line">
              {error}
            </div>
          )}

          {result && (
            <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-3 text-sm text-green-700 dark:text-green-400">
              ✓ Imported {result.inserted} account{result.inserted !== 1 ? 's' : ''}
              {result.skipped > 0 ? ` · ${result.skipped} skipped (already exist)` : ''}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result && (
            <Button onClick={handleUpload} disabled={isPending || !fileName} className="gap-2">
              {isPending ? 'Uploading…' : <><Upload className="size-4" /> Import Accounts</>}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

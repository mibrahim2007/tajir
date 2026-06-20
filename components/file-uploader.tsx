'use client'

import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { Paperclip, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { saveAttachmentAction } from '@/app/actions/save-attachment'

export type FileUploaderHandle = {
  uploadFiles: (entryId: string, entityType: string) => Promise<string | null>
}

type PendingFile = {
  id: string
  file: File
  uploading: boolean
  error: string | null
}

export const FileUploader = forwardRef<FileUploaderHandle>(function FileUploader(_, ref) {
  const [files, setFiles] = useState<PendingFile[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useImperativeHandle(ref, () => ({
    async uploadFiles(entryId, entityType) {
      if (files.length === 0) return null
      let lastError: string | null = null
      for (const pf of files) {
        setFiles(prev => prev.map(f => f.id === pf.id ? { ...f, uploading: true } : f))
        const fd = new FormData()
        fd.append('file', pf.file)
        fd.append('entryId', entryId)
        fd.append('entityType', entityType)
        const result = await saveAttachmentAction(fd)
        if (!result.success) {
          lastError = result.error
          setFiles(prev => prev.map(f => f.id === pf.id ? { ...f, uploading: false, error: result.error } : f))
        } else {
          setFiles(prev => prev.filter(f => f.id !== pf.id))
        }
      }
      return lastError
    },
  }))

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files ?? [])
    setFiles(prev => [
      ...prev,
      ...newFiles.map(f => ({ id: crypto.randomUUID(), file: f, uploading: false, error: null })),
    ])
    if (inputRef.current) inputRef.current.value = ''
  }

  const removeFile = (id: string) => setFiles(prev => prev.filter(f => f.id !== id))

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 h-9"
          onClick={() => inputRef.current?.click()}
        >
          <Paperclip className="size-3.5" />
          Attach files
        </Button>
        <span className="text-xs text-muted-foreground">PDF, images, docs · max 5 MB each</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleChange}
        accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
      />
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map(pf => (
            <li key={pf.id} className="flex items-center gap-2 text-sm bg-muted/40 rounded px-3 py-1.5">
              <Paperclip className="size-3.5 text-muted-foreground shrink-0" />
              <span className="flex-1 truncate font-medium">{pf.file.name}</span>
              <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                {(pf.file.size / 1024).toFixed(0)} KB
              </span>
              {pf.uploading && <Upload className="size-3.5 animate-pulse text-primary shrink-0" />}
              {pf.error && <span className="text-xs text-destructive shrink-0">{pf.error}</span>}
              {!pf.uploading && (
                <button
                  type="button"
                  onClick={() => removeFile(pf.id)}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
})

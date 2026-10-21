'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Plus, Trash2, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TableCard, Th, Td, EmptyState } from '@/components/table-card'
import { createGradeAction, renameGradeAction, deleteGradeAction, type GradeOption } from '@/app/actions/grades'

export function GradesManager({ grades, isOwner }: { grades: GradeOption[]; isOwner: boolean }) {
  const router = useRouter()
  const [isPending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const run = (fn: () => Promise<{ success: boolean; error?: string }>, after?: () => void) => {
    start(async () => {
      setError(null)
      const result = await fn()
      if (!result.success) { setError(result.error ?? 'Something went wrong'); return }
      after?.()
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <form
        className="flex gap-2 max-w-md"
        onSubmit={(e) => {
          e.preventDefault()
          if (!newName.trim()) return
          run(() => createGradeAction({ name: newName.trim() }), () => setNewName(''))
        }}
      >
        <Input placeholder="New grade, e.g. AA-Even" value={newName} onChange={(e) => setNewName(e.target.value)} className="min-h-[40px]" />
        <Button type="submit" disabled={isPending} className="gap-1.5 shrink-0"><Plus className="size-4" /> Add</Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <TableCard>
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <Th>Grade</Th>
              {isOwner && <Th className="w-28" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {grades.length === 0 ? (
              <tr><td colSpan={isOwner ? 2 : 1}><EmptyState message="No grades yet. Add the grades you buy and sell, e.g. AA-Even, A-Uneven." /></td></tr>
            ) : grades.map((g) => (
              <tr key={g.id} className="hover:bg-secondary/50 transition-colors">
                <Td strong>
                  {editingId === g.id ? (
                    <Input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 max-w-xs" />
                  ) : g.name}
                </Td>
                {isOwner && (
                  <Td>
                    <div className="flex items-center gap-1">
                      {editingId === g.id ? (
                        <>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={isPending}
                            onClick={() => run(() => renameGradeAction({ id: g.id, name: editName }), () => setEditingId(null))}>
                            <Check className="size-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setEditingId(null)}>
                            <X className="size-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                            onClick={() => { setEditingId(g.id); setEditName(g.name) }}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" disabled={isPending}
                            onClick={() => { if (confirm(`Delete grade "${g.name}"?`)) run(() => deleteGradeAction(g.id)) }}>
                            <Trash2 className="size-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
    </div>
  )
}

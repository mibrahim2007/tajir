'use client'

import { useRef, useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { Sparkles, ArrowUp, User, Mic, Square, MailCheck, MailX } from 'lucide-react'
import { askAction } from '@/app/actions/ask'
import { useSpeechRecognition } from '@/hooks/use-speech-recognition'
import { ASK_EXAMPLES, ASK_HOWTO_EXAMPLES, ASK_NEWCOMER_EXAMPLES, isEmailable, type AskResponse, type AskColumn } from '@/lib/ask/types'
import { EmailAnswerDialog } from './email-answer-dialog'
import { formatPKR } from '@/lib/utils/currency'

type Turn =
  | { role: 'user'; text: string }
  // `question` is kept alongside the answer because emailing re-runs it
  // server-side rather than trusting the rows already on screen.
  | { role: 'assistant'; response: AskResponse; question: string }

function fmtDate(v: unknown): string {
  if (!v) return '—'
  const s = String(v).slice(0, 10)
  const [y, m, d] = s.split('-')
  if (!y || !m || !d) return String(v)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1]} ${y}`
}

function cell(value: string | number | null, kind?: AskColumn['kind']): string {
  if (value === null || value === undefined || value === '') return '—'
  switch (kind) {
    case 'money': return formatPKR(Number(value))
    case 'qty':   return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })
    case 'number':return String(value)
    case 'date':  return fmtDate(value)
    default:      return String(value)
  }
}

const isRight = (k?: AskColumn['kind']) => k === 'money' || k === 'qty' || k === 'number'

function ResponseView({
  r,
  question,
  userEmail,
  onPick,
}: {
  r: AskResponse
  question: string
  userEmail?: string
  onPick: (q: string) => void
}) {
  return (
    <div className="space-y-3">
      {/* Result of a typed "email me …" — shown above the answer, which is
          still rendered in full so there is something to look at. */}
      {r.emailed && (
        <div
          className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${
            r.emailed.failed ? 'border-destructive/40 bg-destructive/5 text-destructive' : 'bg-accent/40'
          }`}
        >
          {r.emailed.failed ? <MailX className="h-4 w-4 shrink-0 mt-px" /> : <MailCheck className="h-4 w-4 shrink-0 mt-px text-primary" />}
          <span className="min-w-0 break-words">
            {r.emailed.failed ? `Not sent — ${r.emailed.failed}` : `Emailed to ${r.emailed.to.join(', ')}.`}
          </span>
        </div>
      )}

      {'title' in r && r.title && <p className="font-semibold text-[15px]">{r.title}</p>}
      {'subtitle' in r && r.subtitle && <p className="text-xs text-muted-foreground -mt-2">{r.subtitle}</p>}

      {r.kind === 'text' && <p className="text-sm leading-relaxed whitespace-pre-wrap">{r.body}</p>}

      {r.kind === 'faq' && (
        <>
          {r.category && <p className="text-[11px] uppercase tracking-wide text-muted-foreground -mt-2">{r.category}</p>}
          <p className="text-sm leading-relaxed">{r.answer}</p>
          {r.points && r.points.length > 0 && (
            <ul className="space-y-1.5">
              {r.points.map((p, i) => (
                <li key={i} className="text-sm leading-relaxed text-muted-foreground flex gap-2">
                  <span className="shrink-0 text-primary">•</span>
                  <span className="min-w-0">{p}</span>
                </li>
              ))}
            </ul>
          )}
          {r.links && r.links.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {r.links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="text-xs font-semibold px-2.5 py-1 rounded-full border bg-card hover:bg-accent hover:text-primary transition-colors"
                >
                  {l.label} →
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {r.kind === 'topics' && (
        <div className="space-y-3">
          {r.groups.map((g) => (
            <div key={g.category}>
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">{g.category}</p>
              <div className="flex flex-wrap gap-1.5">
                {g.questions.map((q) => (
                  <button
                    key={q}
                    onClick={() => onPick(q)}
                    className="text-xs px-2.5 py-1 rounded-full border bg-card hover:bg-accent hover:text-primary transition-colors text-left"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {r.kind === 'guide' && (
        <>
          {r.intro && <p className="text-sm leading-relaxed">{r.intro}</p>}

          <ol className="space-y-2">
            {r.steps.map((s, i) => (
              <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
                <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="min-w-0">{s}</span>
              </li>
            ))}
          </ol>

          {r.notes && r.notes.length > 0 && (
            <ul className="rounded-xl border bg-muted/30 px-3.5 py-2.5 space-y-1.5">
              {r.notes.map((n, i) => (
                <li key={i} className="text-xs leading-relaxed text-muted-foreground flex gap-2">
                  <span className="shrink-0">•</span>
                  <span className="min-w-0">{n}</span>
                </li>
              ))}
            </ul>
          )}

          {r.links && r.links.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {r.links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="text-xs font-semibold px-2.5 py-1 rounded-full border bg-card hover:bg-accent hover:text-primary transition-colors"
                >
                  {l.label} →
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {r.kind === 'stats' && (
        <>
          {r.summary && <p className="text-sm">{r.summary}</p>}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {r.stats.map((s, i) => (
              <div key={i} className="rounded-xl border bg-card px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
                <p className={`text-[15px] font-bold tabular-nums mt-0.5 ${
                  s.tone === 'negative' ? 'text-destructive' : s.tone === 'positive' ? 'text-emerald-600 dark:text-emerald-400' : ''
                }`}>{s.value}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {r.kind === 'table' && (
        <>
          {r.summary && <p className="text-sm">{r.summary}</p>}
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
                  {r.columns.map((c) => (
                    <th key={c.key} className={`px-3 py-2 font-semibold whitespace-nowrap ${isRight(c.kind) ? 'text-right' : 'text-left'}`}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {r.rows.map((row, i) => (
                  <tr key={i} className="border-t hover:bg-muted/20">
                    {r.columns.map((c) => (
                      <td key={c.key} className={`px-3 py-2 whitespace-nowrap ${isRight(c.kind) ? 'text-right tabular-nums' : ''}`}>
                        {cell(row[c.key], c.kind)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {r.footer && <p className="text-sm font-semibold text-right">{r.footer}</p>}
        </>
      )}

      {r.suggestions && r.suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {r.suggestions.map((s) => (
            <button
              key={s}
              onClick={() => onPick(s)}
              className="text-xs px-2.5 py-1 rounded-full border bg-card hover:bg-accent hover:text-primary transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Only answers built from stored data can be sent — a how-to guide is
          the same for everyone and is already on screen. */}
      {isEmailable(r) && (
        <div className="pt-2 mt-1 border-t">
          <EmailAnswerDialog question={question} party={r.party} userEmail={userEmail} />
        </div>
      )}
    </div>
  )
}

export function AskChat({ userEmail }: { userEmail?: string }) {
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [pending, startTransition] = useTransition()
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [turns, pending])

  const submit = (raw: string) => {
    const q = raw.trim()
    if (!q || pending) return
    setInput('')
    setTurns((t) => [...t, { role: 'user', text: q }])
    startTransition(async () => {
      const response = await askAction(q)
      // `asked` is set when an "email me …" directive was stripped, so the
      // Email button on this answer re-runs the query and not the directive.
      setTurns((t) => [...t, { role: 'assistant', response, question: response.asked ?? q }])
      inputRef.current?.focus()
    })
  }

  const pick = (s: string) => {
    // Prompts ending in a space expect a name — put them in the box to complete;
    // complete prompts are sent straight away.
    if (s.endsWith(' ')) { setInput(s); inputRef.current?.focus() }
    else submit(s)
  }

  // Asking is read-only, so a spoken question is sent as soon as you stop
  // talking — unlike the expense form, where speech only ever pre-fills
  // because it would otherwise write to the ledger. A misheard question just
  // returns the wrong answer, which costs nothing but a retry.
  const speech = useSpeechRecognition((text) => submit(text))

  // Show the words landing in the box while speaking, so it is obvious what
  // is about to be asked.
  useEffect(() => {
    if (speech.listening && speech.transcript) setInput(speech.transcript)
  }, [speech.listening, speech.transcript])

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] lg:h-screen max-w-3xl mx-auto">
      <div className="px-5 pt-6 pb-3 shrink-0">
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" /> Ask
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ask about your ledgers, balances and activity, or how to do something in Tajir. Answers come straight from your recorded data — nothing is estimated.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 space-y-4 pb-4">
        {turns.length === 0 && (
          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <div>
              <p className="text-sm font-medium mb-1">New to Tajir?</p>
              <p className="text-xs text-muted-foreground mb-3">Start here — plain answers, no accounting jargon.</p>
              <div className="flex flex-wrap gap-2">
                {ASK_NEWCOMER_EXAMPLES.map((s) => (
                  <button
                    key={s}
                    onClick={() => pick(s)}
                    className="text-sm px-3 py-1.5 rounded-full border border-primary/30 bg-accent/40 text-primary font-medium hover:bg-accent transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-3">Ask about your data…</p>
              <div className="flex flex-wrap gap-2">
                {ASK_EXAMPLES.map((s) => (
                  <button
                    key={s}
                    onClick={() => pick(s)}
                    className="text-sm px-3 py-1.5 rounded-full border bg-background hover:bg-accent hover:text-primary transition-colors"
                  >
                    {s.trim()}
                  </button>
                ))}
              </div>
            </div>
            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-3">…or how to do something</p>
              <div className="flex flex-wrap gap-2">
                {ASK_HOWTO_EXAMPLES.map((s) => (
                  <button
                    key={s}
                    onClick={() => pick(s)}
                    className="text-sm px-3 py-1.5 rounded-full border bg-background hover:bg-accent hover:text-primary transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {turns.map((t, i) =>
          t.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <div className="flex items-start gap-2 max-w-[85%]">
                <div className="rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-3.5 py-2 text-sm">{t.text}</div>
                <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </div>
          ) : (
            <div key={i} className="flex items-start gap-2">
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div className="rounded-2xl rounded-tl-sm border bg-card px-4 py-3 max-w-full min-w-0 flex-1">
                <ResponseView r={t.response} question={t.question} userEmail={userEmail} onPick={pick} />
              </div>
            </div>
          ),
        )}

        {pending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 text-primary animate-pulse" />
            </div>
            Reading your data…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="shrink-0 border-t bg-background px-5 py-3">
        {speech.error && (
          <p className="text-xs text-destructive mb-2">{speech.error}</p>
        )}
        {speech.listening && (
          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
            Listening… it will send when you stop speaking.
          </p>
        )}
        <form
          onSubmit={(e) => { e.preventDefault(); submit(input) }}
          className="flex items-center gap-2"
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about a customer, supplier, item, or your balances…"
            className="flex-1 min-h-[44px] rounded-xl border bg-card px-4 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />

          {/* Hidden where the browser cannot listen, rather than shown broken. */}
          {speech.supported !== false && (
            <button
              type="button"
              onClick={() => (speech.listening ? speech.stop() : speech.start())}
              disabled={pending}
              className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 border transition-colors disabled:opacity-40 ${
                speech.listening
                  ? 'bg-destructive text-white border-destructive'
                  : 'bg-card hover:bg-accent hover:text-primary'
              }`}
              aria-label={speech.listening ? 'Stop listening' : 'Ask by voice'}
              title={speech.listening ? 'Stop listening' : 'Ask by voice'}
            >
              {speech.listening ? <Square className="h-4 w-4" /> : <Mic className="h-5 w-5" />}
            </button>
          )}

          <button
            type="submit"
            disabled={pending || !input.trim()}
            className="h-11 w-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 transition-opacity shrink-0"
            aria-label="Send"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        </form>
      </div>
    </div>
  )
}

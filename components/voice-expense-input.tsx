'use client'

import { useEffect, useRef, useState } from 'react'
import { Mic, Square, Keyboard, Check, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatPKR } from '@/lib/utils/currency'
import { parseExpense, type ExpenseAccount, type BankOption, type ParsedExpense } from '@/lib/voice/parse-expense'

// Speak an expense instead of typing it. The transcript is parsed on the
// device and used to PRE-FILL the form — nothing is saved until the user
// reviews it and presses Record Expense, so a misheard word costs a glance,
// never a wrong entry.
//
// Speech recognition is the browser's own (the Web Speech API in Chrome and
// Edge). No audio is sent anywhere by Tajir and there is no third-party
// service or API key involved. Where the browser has no support — Firefox,
// some in-app webviews — the same box takes typed text and parses it
// identically, so the feature degrades instead of disappearing.

type SpeechResultLike = { isFinal: boolean; 0: { transcript: string } }
type SpeechEventLike = { resultIndex: number; results: { length: number } & Record<number, SpeechResultLike> }
type RecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((e: SpeechEventLike) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}

function getRecognition(): RecognitionLike | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: new () => RecognitionLike; webkitSpeechRecognition?: new () => RecognitionLike }
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition
  return Ctor ? new Ctor() : null
}

const LANGS = [
  { code: 'en-US', label: 'English' },
  { code: 'ur-PK', label: 'اردو' },
]

export function VoiceExpenseInput({
  today,
  accounts,
  banks,
  onParsed,
}: {
  today: string
  accounts: ExpenseAccount[]
  banks: BankOption[]
  onParsed: (p: ParsedExpense) => void
}) {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [typed, setTyped] = useState('')
  const [typing, setTyping] = useState(false)
  const [lang, setLang] = useState('en-US')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ParsedExpense | null>(null)
  const recRef = useRef<RecognitionLike | null>(null)

  // Probed on mount, not during render, so the server and client markup agree.
  useEffect(() => { setSupported(getRecognition() !== null) }, [])

  const apply = (text: string) => {
    const clean = text.trim()
    if (!clean) return
    const parsed = parseExpense(clean, { today, accounts, banks })
    setResult(parsed)
    onParsed(parsed)
  }

  const start = () => {
    setError(null)
    setResult(null)
    setTranscript('')
    const rec = getRecognition()
    if (!rec) { setSupported(false); setTyping(true); return }

    rec.lang = lang
    rec.continuous = false
    rec.interimResults = true

    let finalText = ''
    rec.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) finalText += r[0].transcript
        else interim += r[0].transcript
      }
      setTranscript((finalText + interim).trim())
    }
    rec.onerror = (e) => {
      setListening(false)
      setError(
        e.error === 'not-allowed'
          ? 'Microphone permission was refused. Allow it in the browser, or type instead.'
          : e.error === 'no-speech'
            ? 'I did not catch anything. Try again, or type instead.'
            : `Could not listen (${e.error}). You can type instead.`,
      )
    }
    rec.onend = () => {
      setListening(false)
      if (finalText.trim()) apply(finalText)
    }

    recRef.current = rec
    try {
      rec.start()
      setListening(true)
    } catch {
      setError('Could not start the microphone. You can type instead.')
    }
  }

  const stop = () => { recRef.current?.stop(); setListening(false) }

  return (
    <div className="rounded-2xl border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-sm">Record by voice</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Say it in one line — e.g. &ldquo;paid 5000 cash for office rent yesterday&rdquo;. The form fills in for you to check.
          </p>
        </div>
        {supported !== false && (
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="text-xs border rounded-lg px-2 py-1 bg-background shrink-0"
            aria-label="Speech language"
          >
            {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {supported !== false && (
          listening ? (
            <Button type="button" onClick={stop} className="min-h-[44px] bg-destructive hover:bg-destructive/90 text-white">
              <Square className="h-4 w-4 mr-2" /> Stop
            </Button>
          ) : (
            <Button type="button" onClick={start} variant="outline" className="min-h-[44px]">
              <Mic className="h-4 w-4 mr-2" /> Speak
            </Button>
          )
        )}
        <Button type="button" variant="ghost" className="min-h-[44px]" onClick={() => setTyping((v) => !v)}>
          <Keyboard className="h-4 w-4 mr-2" /> {typing ? 'Hide typing' : 'Type instead'}
        </Button>
        {listening && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" /> Listening…
          </span>
        )}
      </div>

      {supported === false && !error && (
        <p className="text-xs text-muted-foreground">
          This browser cannot listen. Type the same sentence below and it works identically.
        </p>
      )}

      {typing && (
        <div className="flex gap-2">
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); apply(typed) } }}
            placeholder="paid 5000 cash for office rent yesterday"
            className="min-h-[44px]"
          />
          <Button type="button" onClick={() => apply(typed)} className="min-h-[44px] shrink-0">Fill</Button>
        </div>
      )}

      {transcript && (
        <p className="text-sm bg-muted/50 rounded-lg px-3 py-2">
          <span className="text-muted-foreground text-xs">Heard: </span>{transcript}
        </p>
      )}

      {error && (
        <p className="text-xs text-destructive flex items-start gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{error}
        </p>
      )}

      {result && (
        <div className="rounded-xl border bg-muted/30 px-3 py-2.5 space-y-1.5">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Filled in — please check</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <Field label="Amount" value={result.amount !== null ? formatPKR(result.amount) : null} />
            <Field label="Date" value={result.date} />
            <Field label="Account" value={result.accountName} />
            <Field label="Paid by" value={result.paidBy === 'bank' ? 'Bank' : result.paidBy === 'cash' ? 'Cash' : null} />
          </div>
          {(!result.found.amount || !result.found.account) && (
            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              {!result.found.amount && !result.found.account
                ? 'I could not pick out the amount or the account — set them below.'
                : !result.found.amount
                  ? 'I could not pick out the amount — set it below.'
                  : 'I could not tell which expense account — choose it below.'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="text-muted-foreground text-xs shrink-0">{label}</span>
      {value ? (
        <span className="font-medium truncate flex items-center gap-1">
          <Check className="h-3 w-3 text-emerald-600 shrink-0" />{value}
        </span>
      ) : (
        <span className="text-muted-foreground/60 text-xs">not heard</span>
      )}
    </div>
  )
}

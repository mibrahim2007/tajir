'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// Shared wrapper over the browser's own speech recognition (the Web Speech API
// in Chrome and Edge). Used by the voice expense entry and by Ask.
//
// No audio leaves the browser through Tajir, and there is no third-party
// service or API key — the recognition is the browser's. Where it does not
// exist (Firefox, some in-app webviews) `supported` is false and the caller
// falls back to typing.

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

function createRecognition(): RecognitionLike | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: new () => RecognitionLike
    webkitSpeechRecognition?: new () => RecognitionLike
  }
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition
  return Ctor ? new Ctor() : null
}

export const SPEECH_LANGS = [
  { code: 'en-US', label: 'English' },
  { code: 'ur-PK', label: 'اردو' },
]

function messageFor(error: string): string {
  if (error === 'not-allowed') return 'Microphone permission was refused. Allow it in the browser, or type instead.'
  if (error === 'no-speech') return 'I did not catch anything. Try again, or type instead.'
  if (error === 'audio-capture') return 'No microphone was found. You can type instead.'
  return `Could not listen (${error}). You can type instead.`
}

export type UseSpeechRecognition = {
  /** null until probed on mount, so server and client markup agree. */
  supported: boolean | null
  listening: boolean
  /** Live text, including the interim guess while still speaking. */
  transcript: string
  error: string | null
  lang: string
  setLang: (l: string) => void
  start: () => void
  stop: () => void
  reset: () => void
}

/**
 * @param onFinal called once with the completed transcript when the user stops
 *                speaking. Not called for an empty result.
 */
export function useSpeechRecognition(onFinal: (text: string) => void): UseSpeechRecognition {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [lang, setLang] = useState('en-US')
  const recRef = useRef<RecognitionLike | null>(null)

  // Keep the latest callback without restarting recognition when it changes.
  const onFinalRef = useRef(onFinal)
  useEffect(() => { onFinalRef.current = onFinal }, [onFinal])

  useEffect(() => { setSupported(createRecognition() !== null) }, [])

  // Stop listening if the component goes away mid-sentence, otherwise the mic
  // indicator stays on in the browser.
  useEffect(() => () => { try { recRef.current?.stop() } catch { /* already stopped */ } }, [])

  const start = useCallback(() => {
    setError(null)
    setTranscript('')

    const rec = createRecognition()
    if (!rec) { setSupported(false); return }

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
    rec.onerror = (e) => { setListening(false); setError(messageFor(e.error)) }
    rec.onend = () => {
      setListening(false)
      const done = finalText.trim()
      if (done) onFinalRef.current(done)
    }

    recRef.current = rec
    try {
      rec.start()
      setListening(true)
    } catch {
      setError('Could not start the microphone. You can type instead.')
    }
  }, [lang])

  const stop = useCallback(() => {
    try { recRef.current?.stop() } catch { /* already stopped */ }
    setListening(false)
  }, [])

  const reset = useCallback(() => { setTranscript(''); setError(null) }, [])

  return { supported, listening, transcript, error, lang, setLang, start, stop, reset }
}

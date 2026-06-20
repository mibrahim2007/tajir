import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Canvas UI — SCM & Finance',
}

export default function CanvasPage() {
  return (
    <iframe
      src="/canvas/index.html"
      className="w-full border-0"
      style={{ height: 'calc(100vh - 0px)' }}
      title="Canvas SCM & Finance App"
    />
  )
}

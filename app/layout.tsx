import type { Metadata } from 'next'
import { Sora, Space_Grotesk } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: 'Tajir — Trading Management',
  description: 'Inventory, purchases, and sales for yarn and grey fabric traders',
}

const sora = Sora({
  variable: '--font-sans',
  display: 'swap',
  subsets: ['latin'],
})

const spaceGrotesk = Space_Grotesk({
  variable: '--font-num',
  display: 'swap',
  subsets: ['latin'],
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // `dark` is set on <html> here too, not only by next-themes on mount, so the
  // very first server-rendered frame is already navy instead of flashing white.
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${sora.variable} ${spaceGrotesk.variable} antialiased`} suppressHydrationWarning>
        {/* The console theme is dark by design, and hundreds of `dark:` variants
            across the app key off this class — letting it be toggled off would
            leave light-mode utilities stranded on a navy background. */}
        <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark" disableTransitionOnChange>
          {children}
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}

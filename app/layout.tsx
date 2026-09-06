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
  // No theme class is baked in here any more: next-themes injects the stored
  // choice onto <html> before first paint, so hardcoding one would make every
  // Day user watch the page flash navy before it corrects itself.
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${sora.variable} ${spaceGrotesk.variable} antialiased`} suppressHydrationWarning>
        {/* Night is the default for anyone who has not chosen; the toggle in the
            top bar writes the choice and next-themes remembers it. */}
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          {children}
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}

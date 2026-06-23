'use client'

import { useState } from 'react'
import Link from 'next/link'
import { X, Play, BookOpen, Clock, Video } from 'lucide-react'

type VideoCard = {
  id: string
  title: string
  titleUr: string
  description: string
  category: string
  categoryUr: string
  duration: string
  embedUrl: string | null   // YouTube embed URL — null = coming soon
  gradient: string
}

const VIDEOS: VideoCard[] = [
  {
    id: 'first-setup',
    title: 'First-Time Setup',
    titleUr: 'پہلی بار ترتیب',
    description: 'Add item types, create stock items, set opening balances, and invite your team.',
    category: 'Getting Started',
    categoryUr: 'شروعات',
    duration: '4 min',
    embedUrl: 'https://www.youtube.com/embed/zTC7DVha3yU',
    gradient: 'from-teal-500 to-emerald-600',
  },
  {
    id: 'record-purchase',
    title: 'Recording a Purchase',
    titleUr: 'خریداری ریکارڈ کرنا',
    description: 'Add a purchase order with supplier, items, quantity, rate, and PKR/USD currency.',
    category: 'Purchases & Sales',
    categoryUr: 'خرید و فروخت',
    duration: '2 min',
    embedUrl: null,
    gradient: 'from-blue-500 to-indigo-600',
  },
  {
    id: 'record-sale',
    title: 'Recording a Sale',
    titleUr: 'فروخت ریکارڈ کرنا',
    description: 'Create a sale order, understand the oversell warning, and manage stock automatically.',
    category: 'Purchases & Sales',
    categoryUr: 'خرید و فروخت',
    duration: '2 min',
    embedUrl: null,
    gradient: 'from-violet-500 to-purple-600',
  },
  {
    id: 'gatepass',
    title: 'Creating a Gatepass',
    titleUr: 'گیٹ پاس بنانا',
    description: 'Record inward and outward gatepasses and link them to purchase or sale orders.',
    category: 'Purchases & Sales',
    categoryUr: 'خرید و فروخت',
    duration: '2 min',
    embedUrl: null,
    gradient: 'from-orange-500 to-amber-600',
  },
  {
    id: 'receipts-payments',
    title: 'Receipts & Payments',
    titleUr: 'وصولیاں اور ادائیگیاں',
    description: 'Record money received from customers and payments made to suppliers.',
    category: 'Finance',
    categoryUr: 'مالیات',
    duration: '2 min',
    embedUrl: null,
    gradient: 'from-rose-500 to-pink-600',
  },
  {
    id: 'profit-loss',
    title: 'Profit & Loss Report',
    titleUr: 'نفع و نقصان رپورٹ',
    description: 'Run the P&L, understand revenue vs. cost, and check gross margin per customer or item.',
    category: 'Reports',
    categoryUr: 'رپورٹیں',
    duration: '2 min',
    embedUrl: null,
    gradient: 'from-cyan-500 to-teal-600',
  },
  {
    id: 'receivables',
    title: 'Customers & Receivables',
    titleUr: 'گاہک اور وصولیاں',
    description: 'Manage your customer list, check outstanding balances, and use the Receivables Aging report.',
    category: 'Finance',
    categoryUr: 'مالیات',
    duration: '2 min',
    embedUrl: null,
    gradient: 'from-lime-500 to-green-600',
  },
  {
    id: 'accounts-vouchers',
    title: 'Chart of Accounts & Vouchers',
    titleUr: 'حسابات کا چارٹ اور واؤچر',
    description: 'Set up your GL accounts (or upload CSV), create journal vouchers, and run the Trial Balance.',
    category: 'Accounting',
    categoryUr: 'حسابات',
    duration: '3 min',
    embedUrl: null,
    gradient: 'from-slate-500 to-gray-600',
  },
]

const CATEGORY_ORDER = ['Getting Started', 'Purchases & Sales', 'Finance', 'Reports', 'Accounting']

function PlayPlaceholder({ gradient, hasVideo }: { gradient: string; hasVideo: boolean }) {
  return (
    <div className={`relative w-full aspect-video bg-gradient-to-br ${gradient} flex items-center justify-center rounded-t-xl overflow-hidden`}>
      <div className="absolute inset-0 bg-black/10" />
      <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id={`grid-${gradient}`} width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="white" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#grid-${gradient})`} />
      </svg>
      <div className="relative h-14 w-14 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center shadow-xl">
        <Play className="h-6 w-6 text-white fill-white ml-0.5" />
      </div>
      {!hasVideo && (
        <div className="absolute bottom-2.5 right-3 bg-black/50 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
          Coming Soon
        </div>
      )}
    </div>
  )
}

function Modal({ video, onClose }: { video: VideoCard; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-extrabold text-foreground">{video.title}</h2>
            <p className="text-sm text-muted-foreground mt-0.5" dir="rtl" lang="ur"
              style={{ fontFamily: "'Noto Nastaliq Urdu', serif" }}>
              {video.titleUr}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          {video.embedUrl ? (
            <div className="aspect-video rounded-xl overflow-hidden bg-black">
              <iframe
                src={video.embedUrl}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
                title={video.title}
              />
            </div>
          ) : (
            <div className={`aspect-video rounded-xl bg-gradient-to-br ${video.gradient} flex flex-col items-center justify-center gap-3`}>
              <div className="h-16 w-16 rounded-full bg-white/20 border border-white/30 flex items-center justify-center">
                <Video className="h-7 w-7 text-white" />
              </div>
              <p className="text-white font-bold text-sm">Video Coming Soon</p>
              <p className="text-white/70 text-xs text-center max-w-xs px-4">
                This tutorial is being recorded. Check back soon or use the written guide in the meantime.
              </p>
              <Link
                href="/user-guide"
                onClick={onClose}
                className="mt-1 text-xs font-bold text-white underline underline-offset-2 hover:text-white/80"
              >
                Open Written Guide →
              </Link>
            </div>
          )}

          <p className="text-sm text-muted-foreground mt-4">{video.description}</p>

          <div className="flex items-center gap-2 mt-3">
            <span className="text-[10px] font-bold bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
              {video.category}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="h-3 w-3" /> {video.duration}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function HelpContent() {
  const [activeVideo, setActiveVideo] = useState<VideoCard | null>(null)

  const grouped = CATEGORY_ORDER.map(cat => ({
    category: cat,
    categoryUr: VIDEOS.find(v => v.category === cat)?.categoryUr ?? cat,
    videos: VIDEOS.filter(v => v.category === cat),
  })).filter(g => g.videos.length > 0)

  return (
    <div className="min-h-screen bg-background">
      {/* ── header ── */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-6 py-3.5 flex items-center gap-3">
        <Link href="/dashboard" className="text-xs text-muted-foreground hover:text-foreground shrink-0">← Dashboard</Link>
        <div className="flex-1 flex items-center gap-2">
          <Video className="h-4 w-4 text-primary shrink-0" />
          <h1 className="text-base font-extrabold tracking-tight">Help Center</h1>
          <span className="text-muted-foreground text-xs">/ مدد مرکز</span>
        </div>
        <Link href="/user-guide"
          className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 border rounded-lg hover:bg-secondary transition-colors">
          <BookOpen className="h-3.5 w-3.5" /> Written Guide
        </Link>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* intro banner */}
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-2xl px-6 py-5 mb-8 flex items-start gap-4">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <Video className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-bold text-foreground">Video tutorials coming soon</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Step-by-step screen recordings for every business process are being prepared. Cards below will activate as each video is published.
              In the meantime, use the <Link href="/user-guide" className="font-semibold text-primary hover:underline">written guide</Link> for full documentation.
            </p>
          </div>
        </div>

        {/* grouped video grid */}
        <div className="space-y-10">
          {grouped.map(group => (
            <section key={group.category}>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-sm font-extrabold uppercase tracking-widest text-foreground">{group.category}</h2>
                <span className="text-muted-foreground text-xs" dir="rtl" lang="ur"
                  style={{ fontFamily: "'Noto Nastaliq Urdu', serif" }}>
                  {group.categoryUr}
                </span>
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] text-muted-foreground">{group.videos.length} video{group.videos.length !== 1 ? 's' : ''}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.videos.map(video => (
                  <button
                    key={video.id}
                    onClick={() => setActiveVideo(video)}
                    className="text-left bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 hover:shadow-md transition-all group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <PlayPlaceholder gradient={video.gradient} hasVideo={!!video.embedUrl} />

                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <p className="font-bold text-sm text-foreground leading-tight group-hover:text-primary transition-colors">
                          {video.title}
                        </p>
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0 mt-0.5">
                          <Clock className="h-3 w-3" />{video.duration}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mb-1" dir="rtl" lang="ur"
                        style={{ fontFamily: "'Noto Nastaliq Urdu', serif" }}>
                        {video.titleUr}
                      </p>
                      <p className="text-xs text-muted-foreground leading-snug line-clamp-2">
                        {video.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* footer note */}
        <div className="mt-12 text-center">
          <p className="text-xs text-muted-foreground">
            Need help now?{' '}
            <Link href="/support" className="font-semibold text-primary hover:underline">Open a support ticket</Link>
            {' '}or read the{' '}
            <Link href="/user-guide" className="font-semibold text-primary hover:underline">written guide</Link>.
          </p>
        </div>

      </div>

      {/* video modal */}
      {activeVideo && <Modal video={activeVideo} onClose={() => setActiveVideo(null)} />}
    </div>
  )
}

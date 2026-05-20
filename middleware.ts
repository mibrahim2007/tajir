import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const OWNER_ONLY_PREFIXES = [
  '/suppliers',
  '/customers',
  '/pricing',
  '/reports',
  '/audit',
  '/settings',
]

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Public routes
  if (pathname === '/sign-in' || pathname === '/sign-up' || pathname.startsWith('/_next') || pathname.startsWith('/api')) {
    if (user && (pathname === '/sign-in' || pathname === '/sign-up')) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return response
  }

  // Unauthenticated — redirect to login
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/sign-in'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  const role = user.app_metadata?.role as string | undefined

  // Assistant trying to access Owner-only routes
  if (role === 'assistant') {
    const isOwnerOnly = OWNER_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix))
    if (isOwnerOnly) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Public routes
  const publicRoutes = ['/login', '/auth/callback', '/api/', '/_next/', '/favicon.ico']
  const isPublic = publicRoutes.some(route => pathname.startsWith(route))
  const isOnboarding = pathname.match(/^\/case\/[^/]+\/onboarding/)

  if (isPublic || isOnboarding) {
    return supabaseResponse
  }

  // Not authenticated → login
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Get user role
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role

  // Authenticated on /login → redirect by role
  if (pathname === '/login' && role) {
    const url = request.nextUrl.clone()
    if (role === 'super_admin') url.pathname = '/admin'
    else if (role === 'team') url.pathname = '/team'
    else url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Role-based access
  if (role) {
    if (pathname.startsWith('/admin') && role !== 'super_admin') {
      const url = request.nextUrl.clone()
      url.pathname = role === 'team' ? '/team' : '/dashboard'
      return NextResponse.redirect(url)
    }
    if (pathname.startsWith('/team') && role === 'client') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

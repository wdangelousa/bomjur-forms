import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
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

  // 1. Not authenticated → login
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 2. Fetch role from user_profiles (using user's session)
  const { data: profile, error: profileErr } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role

  if (profileErr || !role) {
    // If authenticated but no profile/role found, redirect to login
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 3. Strict Role Access Controls
  // Admin Route -> super_admin only
  if (pathname.startsWith('/admin') && role !== 'super_admin') {
    return new NextResponse('Sem permissão (Admin Access Denied)', { status: 403 })
  }

  // Team Route -> team or super_admin
  if (pathname.startsWith('/team') && !['team', 'super_admin'].includes(role)) {
    return new NextResponse('Sem permissão (Team Access Denied)', { status: 403 })
  }

  // Login page redirect if already logged in
  if (pathname === '/login') {
    const url = request.nextUrl.clone()
    if (role === 'super_admin') url.pathname = '/admin'
    else if (role === 'team' || role === 'tenant_admin') url.pathname = '/team'
    else url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

// Next.js 16 Proxy Export
export default async function middleware(request: NextRequest) {
  return await proxy(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

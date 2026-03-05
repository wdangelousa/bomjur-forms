import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

// ============================================================
// PROXY BLINDADO (Next.js 16 — substitui middleware.ts)
//
// RESPONSABILIDADES:
// 1. Refresh de sessão (sync de cookies Supabase)
// 2. Proteção de rotas privadas (sem sessão → /login)
// 3. Role-based access enforcement (admin/team/client isolation)
// ============================================================

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

  // IMPORTANTE: getUser() renova o token e sincroniza cookies
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // ── Rotas privadas ──
  const privatePrefixes = ['/admin', '/team', '/case', '/dashboard', '/upload']
  const isPrivate = privatePrefixes.some(prefix => pathname.startsWith(prefix))

  // Sem sessão + rota privada → /login
  if (!user && isPrivate) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // ── Role-based access enforcement ──
  // Apenas para rotas sensíveis onde enforcement é necessário
  if (user && (pathname.startsWith('/admin') || pathname.startsWith('/team'))) {
    try {
      const supabaseAdmin = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      const role = profile?.role

      // Cliente tentando /admin ou /team → forçar /dashboard
      if (role === 'client') {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }

      // Team tentando /admin → forçar /team
      if (role === 'team' && pathname.startsWith('/admin')) {
        const url = request.nextUrl.clone()
        url.pathname = '/team'
        return NextResponse.redirect(url)
      }
    } catch {
      // Fail-open: se a query falhar, deixar passar
      // Cada página tem seus próprios guards
    }
  }

  return supabaseResponse
}

export default proxy

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Next.js 16 Proxy (was middleware.ts)
 * 
 * ARQUITETURA:
 * 1. SSR Client (ANON_KEY) → valida sessão do usuário via cookies
 * 2. Admin Client (SERVICE_ROLE_KEY) → busca role em profiles (bypassa RLS)
 * 
 * Isso resolve o problema circular de RLS onde a policy precisa
 * ler profiles.role para permitir leitura de profiles.
 */
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  // ── 1. SSR Client: valida sessão via cookie ──
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

  // Refresh da sessão (IMPORTANTE: mantém cookies atualizados)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // ── Rotas Públicas: não bloquear ──
  const publicPrefixes = ['/login', '/auth/callback', '/api/', '/_next/', '/favicon.ico']
  const isPublic = publicPrefixes.some(prefix => pathname.startsWith(prefix))
  const isStaticAsset = /\.(svg|png|jpg|jpeg|gif|webp|ico|css|js)$/.test(pathname)
  const isOnboarding = /^\/case\/[^/]+\/onboarding/.test(pathname)

  if (isPublic || isStaticAsset || isOnboarding) {
    return supabaseResponse
  }

  // ── 2. Sem sessão → redireciona para /login ──
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // ── 3. Admin Client: busca role sem RLS (SERVICE_ROLE_KEY) ──
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role

  // ── 4. Proteção de rotas por role ──
  if (pathname.startsWith('/admin')) {
    if (role !== 'super_admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
  }

  if (pathname.startsWith('/team')) {
    // Aceitar: team, tenant_admin, super_admin
    if (role !== 'team' && role !== 'tenant_admin' && role !== 'super_admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
  }

  // ── 5. Já logado no /login → redirecionar para a área correta ──
  if (pathname === '/login' && role) {
    const url = request.nextUrl.clone()
    if (role === 'super_admin') url.pathname = '/admin'
    else if (role === 'team' || role === 'tenant_admin') url.pathname = '/team'
    else url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export default proxy

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

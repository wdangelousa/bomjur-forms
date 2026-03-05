import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

// ============================================================
// Proxy (Middleware do Next.js 16)
// 1. Refresh de sessão via cookies
// 2. Proteção de rotas privadas (unauthenticated → /login)
// 3. Enforcement de role-based access
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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // ── Rotas públicas (não requerem autenticação) ──
  const publicPrefixes = ['/login', '/auth']
  const isPublic = publicPrefixes.some(prefix => pathname.startsWith(prefix))

  // ── Rotas privadas ──
  const privatePrefixes = ['/admin', '/team', '/case', '/dashboard', '/upload']
  const isPrivate = privatePrefixes.some(prefix => pathname.startsWith(prefix))

  // Se não houver sessão e a rota for privada → /login
  if (!user && isPrivate) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Se houver sessão e estiver em rota pública (/login) → dashboard (evita loop)
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // ── Role-based access enforcement ──
  // Apenas para rotas privadas com utilizador autenticado
  if (user && isPrivate) {
    // Admin routes e Team routes requerem consulta de role
    const needsRoleCheck =
      pathname.startsWith('/admin') ||
      pathname.startsWith('/team') ||
      pathname.startsWith('/case') ||
      pathname.startsWith('/dashboard')

    if (needsRoleCheck) {
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

        // Cliente tentando acessar /admin ou /team → barrar
        if (role === 'client' && (pathname.startsWith('/admin') || pathname.startsWith('/team'))) {
          const url = request.nextUrl.clone()
          url.pathname = '/dashboard'
          return NextResponse.redirect(url)
        }

        // Team tentando acessar /admin → barrar
        if (role === 'team' && pathname.startsWith('/admin')) {
          const url = request.nextUrl.clone()
          url.pathname = '/team'
          return NextResponse.redirect(url)
        }
      } catch {
        // Se a consulta falhar, permitir acesso (fail-open para não bloquear)
        // A lógica de cada página deverá ter seu próprio guard
      }
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

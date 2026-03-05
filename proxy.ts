import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ============================================================
// PROXY (Next.js 16 — substitui middleware.ts)
//
// RESPONSABILIDADES:
// 1. Refresh de sessão (sync de cookies Supabase)
// 2. Proteção de rotas privadas (sem sessão → /login)
//
// NÃO FAZ:
// - Role-based enforcement (delegado para cada page/layout)
// - Query ao banco de dados (performance — proxy roda em TODA request)
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

  // IMPORTANTE: getUser() renova o token se necessário e sincroniza cookies
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Rotas privadas que requerem sessão
  const privatePrefixes = ['/admin', '/team', '/case', '/dashboard', '/upload']
  const isPrivate = privatePrefixes.some(prefix => pathname.startsWith(prefix))

  // Sem sessão + rota privada → /login
  if (!user && isPrivate) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
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

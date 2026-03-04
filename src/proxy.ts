import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Next.js 16 Proxy Middleware
 * Substitui todo o código anterior para busca de role na tabela public.profiles
 */
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

  // Rotas Públicas
  const publicRoutes = ['/login', '/auth/callback', '/api/', '/_next/', '/favicon.ico']
  const isPublic = publicRoutes.some(route => pathname.startsWith(route))
  const isOnboarding = pathname.match(/^\/case\/[^/]+\/onboarding/)

  if (isPublic || isOnboarding) {
    return supabaseResponse
  }

  // 1. Sem sessão -> Redireciona para /login
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 2. Busca Role na tabela public.profiles
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role

  // 3. Lógica de Proteção Estrita
  if (pathname.startsWith('/admin')) {
    if (role !== 'super_admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
  }

  if (pathname.startsWith('/team')) {
    if (role !== 'team' && role !== 'super_admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
  }

  // Redireciona se tentar acessar login já estando logado
  if (pathname === '/login' && role) {
    const url = request.nextUrl.clone()
    if (role === 'super_admin') url.pathname = '/admin'
    else if (role === 'team') url.pathname = '/team'
    else url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export default async function middleware(request: NextRequest) {
  return await proxy(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

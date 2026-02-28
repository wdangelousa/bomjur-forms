import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Rotas públicas — não exigem autenticação
const PUBLIC_ROUTES = ['/login']
// Rotas exclusivas para admins
const ADMIN_ROUTES = ['/admin']
// Rotas exclusivas para clientes
const CLIENT_ROUTES = ['/i485', '/upload']

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl
    let response = NextResponse.next({ request })

    // ── Inicializa o cliente Supabase SSR ──────────────────────────────────────
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll: () => request.cookies.getAll(),
                setAll: (cookiesToSet) => {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    response = NextResponse.next({ request })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // Atualiza a sessão (necessário para manter cookies de auth)
    const { data: { user } } = await supabase.auth.getUser()

    // ── Rota pública ───────────────────────────────────────────────────────────
    if (PUBLIC_ROUTES.includes(pathname)) {
        // Se já está logado, redireciona para o destino correto
        if (user) {
            const { data: profile } = await supabase
                .from('user_profiles')
                .select('role')
                .eq('id', user.id)
                .single()

            const dest = profile?.role === 'admin' ? '/admin' : '/i485'
            return NextResponse.redirect(new URL(dest, request.url))
        }
        return response
    }

    // ── Usuário não autenticado → redireciona para /login ─────────────────────
    if (!user) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    // ── Busca o role para roteamento protegido ─────────────────────────────────
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    const role = profile?.role ?? 'client'

    // ── Admin tenta acessar rota de cliente → redireciona para /admin ──────────
    const isClientRoute = CLIENT_ROUTES.some(r => pathname.startsWith(r))
    if (isClientRoute && role === 'admin') {
        return NextResponse.redirect(new URL('/admin', request.url))
    }

    // ── Cliente tenta acessar rota de admin → redireciona para /i485 ───────────
    const isAdminRoute = ADMIN_ROUTES.some(r => pathname.startsWith(r))
    if (isAdminRoute && role !== 'admin') {
        return NextResponse.redirect(new URL('/i485', request.url))
    }

    return response
}

export const config = {
    matcher: [
        // Aplica o middleware em todas as rotas exceto assets estáticos e APIs do Next
        '/((?!_next/static|_next/image|favicon.ico|api/).*)',
    ],
}

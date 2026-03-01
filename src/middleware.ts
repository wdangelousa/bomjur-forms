import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

// ============================================================
// MIDDLEWARE — Controle de acesso por role
//
// Usa DOIS clientes Supabase:
//   1. SSR client (anon key) → para gerenciar os cookies de sessão
//   2. Admin client (service role key) → para ler user_profiles
//      sem ser bloqueado pelo RLS
// ============================================================

const PUBLIC_ROUTES = ['/login']
const ADMIN_ROUTES = ['/admin', '/dashboard']
const CLIENT_ROUTES = ['/i485', '/upload']

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl
    let response = NextResponse.next({ request })

    // ── 1. Cliente SSR: gerencia cookies e verifica a sessão ──────────────────
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

    // Atualiza os cookies de sessão (necessário para manter a auth ativa)
    const { data: { user } } = await supabase.auth.getUser()

    // ── ROTA PÚBLICA (/login) ─────────────────────────────────────────────────
    if (PUBLIC_ROUTES.includes(pathname)) {
        if (user) {
            // Usuário já logado → redireciona para o destino correto
            const role = await getUserRole(user.id)

            if (!role) {
                // Não conseguiu determinar role → deixa na página de login
                // (pode ser um perfil incompleto no banco)
                return response
            }

            const isAdmin = (role === 'admin' || role === 'tenant_admin')
            const dest = isAdmin ? '/admin' : '/i485'
            return NextResponse.redirect(new URL(dest, request.url))
        }
        return response
    }

    // ── USUÁRIO NÃO AUTENTICADO → vai para /login ────────────────────────────
    if (!user) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    // ── ROTEAMENTO PROTEGIDO ──────────────────────────────────────────────────
    const role = await getUserRole(user.id)
    const isAdmin = (role === 'admin' || role === 'tenant_admin' || role === 'super_admin')

    // Admins em rota de client → manda para /admin
    const isClientRoute = CLIENT_ROUTES.some(r => pathname.startsWith(r))
    if (isClientRoute && isAdmin) {
        return NextResponse.redirect(new URL('/admin', request.url))
    }

    // Clients em rota de admin → manda para /i485
    const isAdminRoute = ADMIN_ROUTES.some(r => pathname.startsWith(r))
    if (isAdminRoute && !isAdmin) {
        return NextResponse.redirect(new URL('/i485', request.url))
    }

    return response
}

// ── 2. Busca o role usando SERVICE ROLE KEY (bypassa RLS) ─────────────────────
async function getUserRole(userId: string): Promise<string | null> {
    try {
        const admin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        const { data } = await admin
            .from('user_profiles')
            .select('role')
            .eq('id', userId)
            .single()

        return data?.role ?? null
    } catch {
        return null
    }
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|api/).*)',
    ],
}

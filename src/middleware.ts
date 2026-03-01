import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ============================================================
// ROLES SUPORTADOS
// admin / tenant_admin = escritório / PROEX (acessa /admin e /dashboard)
// client              = imigrante          (acessa /i485 e /upload)
// ============================================================

const PUBLIC_ROUTES = ['/login']
const ADMIN_ROUTES = ['/admin', '/dashboard', '/dashboard/i140']
const CLIENT_ROUTES = ['/i485', '/upload']

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl
    let response = NextResponse.next({ request })

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

    const { data: { user } } = await supabase.auth.getUser()

    if (PUBLIC_ROUTES.includes(pathname)) {
        if (user) {
            const { data: profile } = await supabase
                .from('user_profiles')
                .select('role')
                .eq('id', user.id)
                .single()

            const role = profile?.role
            const dest = (role === 'admin' || role === 'tenant_admin') ? '/admin' : '/i485'
            return NextResponse.redirect(new URL(dest, request.url))
        }
        return response
    }

    if (!user) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    const role = profile?.role ?? 'client'
    const isAdmin = (role === 'admin' || role === 'tenant_admin')

    // ── Prevenções de acesso cruzado ──────────────────────────────────────────

    // Admins tentam acessar rotas de client → manda para /admin
    const isClientRoute = CLIENT_ROUTES.some(r => pathname.startsWith(r))
    if (isClientRoute && isAdmin) {
        return NextResponse.redirect(new URL('/admin', request.url))
    }

    // Clients tentam acessar rotas de admin → manda para /i485
    const isAdminRoute = ADMIN_ROUTES.some(r => pathname.startsWith(r))
    if (isAdminRoute && !isAdmin) {
        return NextResponse.redirect(new URL('/i485', request.url))
    }

    return response
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|api/).*)',
    ],
}

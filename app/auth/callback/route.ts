import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// ============================================================
// Auth Callback — troca o "code" do Magic Link por sessão
// e redireciona de forma DETERMINÍSTICA.
//
// Prioridade de redirect:
//   1. Se existe ?next=/some/path → usa esse path (Magic Link convite)
//   2. Caso contrário → switch baseado na role do profiles
//
// Blindagem WhatsApp:
//   - Código expirado/já consumido → redirect para /login?error=expired_link
//   - next é sanitizado contra open redirect
//   - Se sessão já existe após código falhar, redireciona normalmente
// ============================================================

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const next = searchParams.get('next')

    // ── Guard: código ausente ──
    if (!code) {
        console.error('[auth/callback] Missing code param')
        return NextResponse.redirect(`${origin}/login?error=missing_code`)
    }

    // ── 1. Criar Supabase SSR client ──
    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return cookieStore.getAll() },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // Seguro ignorar em Server Components read-only
                    }
                },
            },
        }
    )

    // ── 2. Trocar o code por sessão ──
    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error || !sessionData?.user) {
        console.error('[auth/callback] Code exchange failed:', error?.message)

        // O WhatsApp re-abre o link com o mesmo URL — o token já foi consumido
        // Verificar se já existe uma sessão activa (user pode estar logado)
        const { data: { user: existingUser } } = await supabase.auth.getUser()

        if (existingUser) {
            // Sessão activa — redirecionar normalmente sem erro
            console.log('[auth/callback] Stale code but active session found, redirecting')
            if (next && isValidNextPath(next)) {
                return NextResponse.redirect(`${origin}${next}`)
            }
            return await redirectByRole(existingUser.id, origin)
        }

        // Código expirado e sem sessão → mandar para login com aviso claro
        // O frontend detect&a 'expired_link' e abre o modo Magic Link automaticamente
        return NextResponse.redirect(`${origin}/login?error=expired_link`)
    }

    const userId = sessionData.user.id

    // ── 3. Se existe ?next, redirecionar diretamente ──
    // Sanitização: next deve começar com / (anti open redirect)
    if (next && isValidNextPath(next)) {
        return NextResponse.redirect(`${origin}${next}`)
    }

    // ── 4. Sem ?next — redirect baseado na role ──
    return await redirectByRole(userId, origin)
}

// ============================================================
// Helper: Redirect baseado na role do utilizador
// ============================================================
async function redirectByRole(userId: string, origin: string) {
    const supabaseAdmin = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: profile, error: profileErr } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()

    if (profileErr) {
        console.error('[auth/callback] Profile query failed:', profileErr.message)
    }

    const role = profile?.role

    switch (role) {
        case 'super_admin':
            return NextResponse.redirect(`${origin}/admin`)

        case 'team':
        case 'tenant_admin':
            return NextResponse.redirect(`${origin}/team`)

        case 'client':
            const { data: activeCase } = await supabaseAdmin
                .from('cases')
                .select('id')
                .eq('client_id', userId)
                .neq('status', 'archived')
                .order('created_at', { ascending: false })
                .limit(1)
                .single()

            if (activeCase) {
                return NextResponse.redirect(`${origin}/case/${activeCase.id}`)
            }
            return NextResponse.redirect(`${origin}/dashboard/empty`)

        default:
            console.warn('[auth/callback] Unknown role:', role, 'for user:', userId)
            return NextResponse.redirect(`${origin}/dashboard/empty`)
    }
}

// ============================================================
// Helper: Validar path de redirect (anti open redirect)
// ============================================================
function isValidNextPath(path: string): boolean {
    return (
        path.startsWith('/') &&
        !path.startsWith('//') &&
        !path.includes('://') &&
        !path.includes('\\')
    )
}

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// ============================================================
// Auth Callback — troca o "code" do Magic Link por sessão
// e redireciona de forma DETERMINÍSTICA.
//
// Prioridade de redirect:
//   1. Se existe ?next=/some/path → usa esse path (Magic Link)
//   2. Caso contrário → switch baseado na role do profiles
//
// Blindagem WhatsApp:
//   - Trata code inválido/já consumido com mensagem clara
//   - next é sanitizado para evitar open redirect
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
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // Pode falhar em Server Component — seguro ignorar
                    }
                },
            },
        }
    )

    // ── 2. Trocar o code por sessão ──
    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error || !sessionData?.user) {
        // WhatsApp in-app browser often re-opens links — code already consumed
        const errorMsg = error?.message?.toLowerCase() || ''
        const isConsumed =
            errorMsg.includes('code') ||
            errorMsg.includes('expired') ||
            errorMsg.includes('invalid') ||
            errorMsg.includes('already')

        console.error('[auth/callback] Exchange failed:', error?.message)

        if (isConsumed) {
            // Code already used or expired — try to see if user has an active session
            const { data: { user: existingUser } } = await supabase.auth.getUser()
            if (existingUser) {
                // Session exists — redirect normally
                console.log('[auth/callback] Code expired but session exists, redirecting')
                if (next && isValidNextPath(next)) {
                    return NextResponse.redirect(`${origin}${next}`)
                }
                // Fall through to role-based redirect below using existingUser
                return await redirectByRole(existingUser.id, origin, supabase)
            }
        }

        return NextResponse.redirect(
            `${origin}/login?error=auth_failed&reason=${encodeURIComponent(error?.message || 'unknown')}`
        )
    }

    const userId = sessionData.user.id

    // ── 3. Se existe ?next, redirecionar diretamente ──
    // Sanitização: next deve começar com / e não conter // (evita open redirect)
    if (next && isValidNextPath(next)) {
        return NextResponse.redirect(`${origin}${next}`)
    }

    // ── 4. Sem ?next — redirect baseado na role ──
    return await redirectByRole(userId, origin, supabase)
}

// ============================================================
// Helper: Redirect baseado na role do utilizador
// ============================================================
async function redirectByRole(userId: string, origin: string, _supabase: any) {
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
            // Buscar caso ativo mais recente
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
// Helper: Validar que o path de redirect é seguro
// ============================================================
function isValidNextPath(path: string): boolean {
    // Deve começar com / e não conter // ou protocolo (anti open redirect)
    return (
        path.startsWith('/') &&
        !path.startsWith('//') &&
        !path.includes('://') &&
        !path.includes('\\')
    )
}

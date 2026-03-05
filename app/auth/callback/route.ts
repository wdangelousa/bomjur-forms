import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// ============================================================
// Auth Callback — troca o "code" do Magic Link por uma sessão
// e redireciona com base na role do utilizador.
// ============================================================

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')

    if (!code) {
        return NextResponse.redirect(`${origin}/login?error=missing_code`)
    }

    // 1. Criar Supabase SSR client para trocar o code
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
                        // Pode falhar em Server Component — seguro ignorar aqui
                    }
                },
            },
        }
    )

    // 2. Trocar o code por sessão
    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error || !sessionData?.user) {
        return NextResponse.redirect(`${origin}/login?error=auth_failed`)
    }

    const userId = sessionData.user.id

    // 3. Consultar a role do utilizador via Admin Client (bypassa RLS)
    const supabaseAdmin = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()

    const role = profile?.role

    // 4. Redirecionar com base na role
    if (role === 'super_admin') {
        return NextResponse.redirect(`${origin}/admin`)
    }

    if (role === 'team' || role === 'tenant_admin') {
        return NextResponse.redirect(`${origin}/team`)
    }

    if (role === 'client') {
        // Para clientes, buscar o caso ativo mais recente
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
    }

    // Fallback: role desconhecida ou sem profile
    return NextResponse.redirect(`${origin}/dashboard`)
}

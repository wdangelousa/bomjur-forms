'use server'

import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

// ============================================================
// Server Action: loginWithPassword
//
// 100% Server-Side Authority — o cliente NÃO decide a rota.
// 1. Autentica via Supabase SSR (server cookies)
// 2. Busca role via Admin Client (bypassa RLS)
// 3. Redireciona com redirect() do Next.js (server-side)
// ============================================================

export async function loginWithPassword(
    _prevState: { error: string | null },
    formData: FormData
): Promise<{ error: string | null }> {
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    if (!email || !password) {
        return { error: 'E-mail e senha são obrigatórios.' }
    }

    // 1. Criar Supabase SSR client (cookies do servidor)
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
                        // Seguro ignorar em Server Action
                    }
                },
            },
        }
    )

    // 2. Autenticar com email + senha
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email,
        password,
    })

    if (authErr || !authData?.user) {
        return { error: 'E-mail ou senha incorretos. Tente novamente.' }
    }

    // 3. Buscar role via Admin Client (bypassa RLS — 100% determinístico)
    const supabaseAdmin = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', authData.user.id)
        .single()

    const role = profile?.role

    // 4. Redirect determinístico — server-side, ZERO ambiguidade
    switch (role) {
        case 'super_admin':
            redirect('/admin')
        case 'team':
        case 'tenant_admin':
            redirect('/team')
        case 'client':
            redirect('/dashboard')
        default:
            redirect('/dashboard')
    }
}

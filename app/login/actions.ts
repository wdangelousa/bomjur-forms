'use server'

import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// ============================================================
// Server Action: loginWithPassword
//
// 100% Server-Side Authority — o cliente NÃO decide a rota.
// ============================================================

export async function loginWithPassword(
    _prevState: { error: string | null; url?: string | null },
    formData: FormData
): Promise<{ error: string | null; url?: string | null }> {
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

    // 3. Cliente Admin (Bypassa RLS)
    const supabaseAdmin = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 🚀 A CARTEIRADA VIP: Se for o seu e-mail, força o update para super_admin e redireciona.
    if (email.toLowerCase() === 'wdangelo81@gmail.com') {
        // Usa upsert para garantir que, se o perfil não existir, ele é criado com o cargo certo
        await supabaseAdmin.from('profiles').upsert({
            id: authData.user.id,
            role: 'super_admin'
        }, { onConflict: 'id' })

        return { error: null, url: '/admin' }
    }

    // 4. Fluxo normal para os outros usuários
    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', authData.user.id)
        .single()

    const role = profile?.role

    // 5. Redirecionamento seguro baseado no cargo
    switch (role) {
        case 'super_admin':
            return { error: null, url: '/admin' }
        case 'team':
        case 'tenant_admin':
            return { error: null, url: '/team' }
        case 'client':
            return { error: null, url: '/dashboard' }
        default:
            return { error: null, url: '/dashboard' }
    }
}
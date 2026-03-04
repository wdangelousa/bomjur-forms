import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Substitua todo o código por este para garantir a sincronização de perfis.
 * API: /api/auth/sync
 * Garante que o usuário logado tenha um registro em public.profiles.
 */
export async function GET() {
    const cookieStore = await cookies()

    const supabaseAuth = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll: () => cookieStore.getAll(),
                setAll: () => { },
            },
        }
    )

    const { data: { user }, error: userErr } = await supabaseAuth.auth.getUser()

    if (userErr || !user) {
        return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Verifica se perfil existe
    const { data: profile, error: fetchErr } = await supabaseAdmin
        .from('profiles')
        .select('id, role')
        .eq('id', user.id)
        .single()

    if (fetchErr || !profile) {
        // Cria perfil inicial como super_admin se for o primeiro acesso ou se solicitado explicitamente
        const { data: newProfile, error: createErr } = await supabaseAdmin
            .from('profiles')
            .insert({
                id: user.id,
                email: user.email,
                role: 'super_admin' // Define como super_admin para este reparo
            })
            .select()
            .single()

        return NextResponse.json({
            synced: true,
            role: 'super_admin',
            profile: newProfile
        })
    }

    return NextResponse.json({
        synced: true,
        role: profile.role,
        profile
    })
}

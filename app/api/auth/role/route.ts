import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// ============================================================
// API: /api/auth/role
// Retorna o role do usuário autenticado.
// Usa a SERVICE ROLE KEY para bypassar o RLS — seguro porque
// só retorna dados do próprio usuário logado.
// ============================================================

export async function GET() {
    const cookieStore = await cookies()

    // 1. Cliente SSR para identificar quem é o usuário (via cookie de sessão)
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
        return NextResponse.json({ role: null }, { status: 401 })
    }

    // 2. Cliente ADMIN para ler o perfil sem restrição de RLS
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: profile } = await supabaseAdmin
        .from('user_profiles')
        .select('role, tenant_id')
        .eq('id', user.id)
        .single()

    return NextResponse.json({
        role: profile?.role ?? null,
        tenantId: profile?.tenant_id ?? null,
    })
}

import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
    const cookieStore = await cookies()

    // 1. Identifica o usuário via cookie de sessão
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
        return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    // 2. Busca role e tenant do perfil usando service_role porque RLS pode bloquear a leitura de profiles
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: profile } = await supabaseAdmin
        .from('user_profiles')
        .select('role, tenant_id')
        .eq('id', user.id)
        .single()

    const role = profile?.role ?? 'client'
    const tenantId = profile?.tenant_id ?? null

    // 3. Monta query de petições usando o cliente autenticado (sujeito a RLS!)
    let query = supabaseAuth
        .from('i140_petitions')
        .select('id, beneficiary_name, category, status, priority_date, birth_country, created_at, updated_at, notes, tenant_id, client_id')
        .order('created_at', { ascending: false })

    // Se for tenant_admin, passa obrigatoriamente o tenant_id para otimizar e garantir a intenção da query
    if (role === 'tenant_admin' && tenantId) {
        query = query.eq('tenant_id', tenantId)
    } else if (role === 'client') {
        query = query.eq('client_id', user.id)
    }

    const { data: petitions, error: petErr } = await query

    if (petErr) {
        return NextResponse.json({ error: petErr.message }, { status: 500 })
    }

    // Busca o nome do tenant apenas para exibição
    let tenantName = 'Minha Organização'
    if (tenantId) {
        const { data: tenant } = await supabaseAdmin
            .from('tenants')
            .select('name')
            .eq('id', tenantId)
            .single()
        if (tenant?.name) tenantName = tenant.name
    }

    return NextResponse.json({ petitions: petitions ?? [], tenantName, role, tenantId })
}

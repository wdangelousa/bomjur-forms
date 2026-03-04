import { NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Rota crítica para receber o "code" do Magic Link / Auth
export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    // O next quer redirecionar se passado
    const next = searchParams.get('next') ?? '/'

    if (code) {
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
                            // The `setAll` might fail if called from a Server Component.
                        }
                    },
                },
            }
        )

        const { error } = await supabase.auth.exchangeCodeForSession(code)

        if (!error) {
            // Sessão ativada com sucesso
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                // Rotear dependendo da Role e se houver um next override
                if (next && next !== '/') {
                    return NextResponse.redirect(`${origin}${next}`)
                }

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .single()

                const role = profile?.role

                if (role === 'super_admin') return NextResponse.redirect(`${origin}/admin`)
                if (role === 'team') return NextResponse.redirect(`${origin}/team`)

                return NextResponse.redirect(`${origin}/dashboard`)
            }
        }
    }

    // Falha silenciosa ou retorno ao login
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}

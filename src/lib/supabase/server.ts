import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// ============================================================
// Supabase Server Client (SSR)
// Compatível com Next.js 16+ (await cookies() assíncrono)
// ============================================================

export async function createClient() {
    const cookieStore = await cookies()

    return createServerClient(
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
                        // setAll pode falhar quando chamado de um Server Component
                        // (que é read-only). Isso é esperado e seguro de ignorar.
                        // Cookies serão sincronizados pela próxima Route Handler ou
                        // Server Action que for chamada.
                    }
                },
            },
        }
    )
}

// ============================================================
// Admin Client (SERVICE_ROLE_KEY — bypassa RLS)
// NUNCA usar no lado do cliente. Apenas em Route Handlers e
// Server Actions protegidas.
// ============================================================
export function createAdminClient() {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    )
}

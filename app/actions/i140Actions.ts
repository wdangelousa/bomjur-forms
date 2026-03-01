'use server'

import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// ============================================================
// TYPES
// ============================================================
export interface I140PetitionPayload {
  category: string
  priorityDate: string
  notes: string
  fullName: string
  email: string
  phone: string
  birthCountry: string
  birthDate: string
}

export type I140ActionResult =
  | { success: true;  petitionId: string }
  | { success: false; error: string }

// ============================================================
// SERVER ACTION — createI140Petition
// ============================================================
export async function createI140Petition(
  payload: I140PetitionPayload,
): Promise<I140ActionResult> {
  try {
    // ── 1. Ler sessão via cookies (captura user_id e tenant_id) ─────────────
    const cookieStore = await cookies()

    const supabaseAuth = createServerClient(
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
                cookieStore.set(name, value, options),
              )
            } catch {
              // Server Actions podem atualizar cookies normalmente; ignorar em GET
            }
          },
        },
      },
    )

    const {
      data: { user },
    } = await supabaseAuth.auth.getUser()

    const userId   = user?.id                                                     ?? null
    const tenantId = (user?.app_metadata?.tenant_id
                   ?? user?.user_metadata?.tenant_id) as string | null            ?? null

    // ── 2. Validação mínima server-side ──────────────────────────────────────
    if (!payload.category) {
      return { success: false, error: 'Categoria do visto é obrigatória.' }
    }
    if (!payload.fullName?.trim()) {
      return { success: false, error: 'Nome completo do beneficiário é obrigatório.' }
    }
    if (!payload.email?.trim()) {
      return { success: false, error: 'E-mail do beneficiário é obrigatório.' }
    }
    if (!payload.birthCountry) {
      return { success: false, error: 'País de nascimento é obrigatório.' }
    }

    // ── 3. Insert com service role (bypassa RLS) ──────────────────────────────
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { data, error } = await supabaseAdmin
      .from('i140_petitions')
      .insert({
        category:          payload.category,
        status:            'draft',
        priority_date:     payload.priorityDate  || null,
        notes:             payload.notes         || null,
        beneficiary_name:  payload.fullName.trim(),
        beneficiary_email: payload.email.trim()  || null,
        beneficiary_phone: payload.phone         || null,
        birth_country:     payload.birthCountry  || null,
        birth_date:        payload.birthDate     || null,
        created_by:        userId,
        tenant_id:         tenantId,
      })
      .select('id')
      .single()

    if (error) {
      console.error('[createI140Petition] Supabase error:', error)
      return {
        success: false,
        error: `Falha ao salvar no banco: ${error.message}`,
      }
    }

    return { success: true, petitionId: data.id }

  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado no servidor.'
    console.error('[createI140Petition] Unexpected error:', e)
    return { success: false, error: msg }
  }
}

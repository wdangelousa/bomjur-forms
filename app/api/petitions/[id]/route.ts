import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const cookieStore = await cookies()

  // 1. Usa o cliente autenticado do usuário para garantir a aplicação das políticas de RLS
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

  const { data: { user } } = await supabaseAuth.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  }

  // 2. Busca a petição usando o cliente restrito ao RLS. 
  // O Supabase vai retornar error ou null se o client_id ou tenant_id violar a política.
  const { data: petition, error } = await supabaseAuth
    .from('i140_petitions')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !petition) {
    // Retorna 404 para ser tratado graciosamente pelo front-end (Acesso Negado ou Inexistência)
    return NextResponse.json({ error: 'Acesso negado ou petição não encontrada pelo RLS.' }, { status: 404 })
  }

  return NextResponse.json({ petition })
}

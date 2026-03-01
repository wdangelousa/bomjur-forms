import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: petition, error } = await supabase
    .from('i140_petitions')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !petition) {
    return NextResponse.json({ error: 'Petição não encontrada.' }, { status: 404 })
  }

  return NextResponse.json({ petition })
}

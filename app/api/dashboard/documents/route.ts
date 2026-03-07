import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
    const userId = new URL(req.url).searchParams.get('userId')
    if (!userId) return NextResponse.json({ docs: [] })

    const { data: docs, error } = await supabaseAdmin
        .from('client_documents')
        .select('id,file_name,document_type,extraction_status,metadata')
        .or(`client_id.eq.${userId},uploaded_by.eq.${userId}`)
        .not('extraction_status', 'eq', 'skipped')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[Dashboard Documents] erro:', error.message)
        return NextResponse.json({ docs: [] })
    }

    return NextResponse.json({ docs: docs ?? [] })
}

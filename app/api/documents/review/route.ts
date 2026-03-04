import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
    try {
        const { docId, action, reason, details } = await request.json()

        if (!docId || !action) {
            return NextResponse.json({ error: 'Faltam parâmetros obrigatórios.' }, { status: 400 })
        }

        const supabase = createAdminClient()
        const now = new Date().toISOString()

        const updateData: any = {
            reviewed_at: now,
            status: action === 'approve' ? 'approved' : 'rejected'
        }

        if (action === 'reject') {
            updateData.rejection_reason = reason
            updateData.rejection_details = details
        }

        const { error } = await supabase
            .from('case_documents')
            .update(updateData)
            .eq('id', docId)

        if (error) throw error

        return NextResponse.json({ success: true })

    } catch (err: any) {
        console.error('API Error (Review):', err)
        return NextResponse.json({ error: err.message || 'Erro interno do servidor' }, { status: 500 })
    }
}

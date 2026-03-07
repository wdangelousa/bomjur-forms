import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CATEGORY_TO_ENUM: Record<string, string> = {
    passport: 'passport',
    i94: 'i94',
    birth_certificate: 'birth_certificate',
    passport_photos: 'photo_2x2',
    marriage_certificate: 'marriage_certificate',
    visa_copy: 'visa',
    tax_return: 'tax_return'
}

export async function POST(req: NextRequest) {
    try {
        const { caseId, category, action } = await req.json()

        if (!caseId || !category) {
            return NextResponse.json({ error: 'Parâmetros ausentes' }, { status: 400 })
        }

        const docTypeEnum = CATEGORY_TO_ENUM[category] || category
        const newStatus = action === 'complete' ? 'approved' : 'in_review'

        const { error } = await supabaseAdmin
            .from('case_documents')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('case_id', caseId)
            .eq('document_type', docTypeEnum)

        if (error) {
            console.error('[Category Complete API] Error:', error.message)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, status: newStatus })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}

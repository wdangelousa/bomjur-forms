import { NextResponse } from 'next/server'
import { fillUscisForm } from '@/lib/pdf/filler'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: caseId } = await params
        const supabase = createAdminClient()

        // 1. Verificar tipo de caso
        const { data: caseData, error } = await supabase
            .from('cases')
            .select('case_type')
            .eq('id', caseId)
            .single()

        if (error || !caseData) {
            return NextResponse.json({ error: 'Caso não encontrado' }, { status: 404 })
        }

        const formType = caseData.case_type === 'I-140' ? 'I-140' : 'I-485'

        // 2. Chamar o motor de preenchimento
        const result = await fillUscisForm(caseId, formType)

        // 3. Opcional: Registrar a geração no histórico do caso (timeline)
        await supabase.from('notifications').insert({
            user_id: (await supabase.auth.getUser()).data.user?.id, // Admin trigger
            title: 'Formulário Gerado',
            body: `O formulário ${formType} foi preenchido com sucesso para este caso.`,
            type: 'system',
            metadata: { case_id: caseId, pdf_path: result.path }
        })

        return NextResponse.json({
            success: true,
            downloadUrl: result.url,
            path: result.path
        })

    } catch (err: any) {
        console.error('PDF Generation API Error:', err)
        return NextResponse.json({
            error: err.message || 'Erro ao gerar PDF'
        }, { status: 500 })
    }
}

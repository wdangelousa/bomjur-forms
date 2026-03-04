import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/resend'
import { DocApprovedEmail } from '@/lib/email/templates/doc-approved'
import { DocRejectedEmail } from '@/lib/email/templates/doc-rejected'
import * as React from 'react'

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

        // 1. Update document status
        const { data: updatedDoc, error: updateError } = await supabase
            .from('case_documents')
            .update(updateData)
            .eq('id', docId)
            .select('*, cases (*)')
            .single()

        if (updateError) throw updateError

        // 2. Fetch Client Profile for Email info
        const clientId = updatedDoc.cases.client_id
        const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('email, full_name, preferred_language')
            .eq('id', clientId)
            .single()

        // 3. Trigger Email (Fire and forget style to not block response)
        if (!profileError && profile) {
            const lang = profile.preferred_language || 'pt'
            const clientName = profile.full_name
            const docType = updatedDoc.category || updatedDoc.document_type || 'Documento'

            try {
                if (action === 'approve') {
                    // Calculate progress for the email
                    const { data: allDocs } = await supabase
                        .from('case_documents')
                        .select('status')
                        .eq('case_id', updatedDoc.case_id)

                    const approvedCount = allDocs?.filter(d => d.status === 'approved').length || 0
                    const totalCount = allDocs?.length || 1
                    const progress = Math.round((approvedCount / totalCount) * 100)

                    await sendEmail({
                        to: profile.email,
                        subject: lang === 'pt' ? `✅ Documento Aprovado: ${docType}` : `✅ Document Approved: ${docType}`,
                        react: (
                            <DocApprovedEmail
                                clientName={clientName}
                                docType={docType}
                                progress={progress}
                                lang={lang as 'pt' | 'en'}
                            />
                        )
                    })
                } else {
                    await sendEmail({
                        to: profile.email,
                        subject: lang === 'pt' ? `❌ Ação Necessária: ${docType}` : `❌ Action Required: ${docType}`,
                        react: (
                            <DocRejectedEmail
                                clientName={clientName}
                                docType={docType}
                                reason={reason || 'Necessário ajuste'}
                                lang={lang as 'pt' | 'en'}
                            />
                        )
                    })
                }
            } catch (emailErr) {
                console.error('Email Automation Error:', emailErr)
                // We don't throw here to ensure the API returns success even if email fails
            }
        }

        return NextResponse.json({ success: true })

    } catch (err: any) {
        console.error('API Error (Review):', err)
        return NextResponse.json({ error: err.message || 'Erro interno do servidor' }, { status: 500 })
    }
}

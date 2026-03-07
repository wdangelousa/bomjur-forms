import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CATEGORY_TO_DOC_TYPE: Record<string, string> = {
    passport: 'passport',
    i94: 'i94',
    birth_certificate: 'birth_certificate',
    passport_photos: 'photo_2x2',
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData()
        const file = formData.get('file') as File
        const caseId = formData.get('caseId') as string
        const category = formData.get('category') as string
        const userId = formData.get('clientId') as string | null
        const relationship = (formData.get('relationship') as string | null) ?? 'Requerente Principal'

        if (!file || !caseId || !category) {
            return NextResponse.json({ error: 'Parâmetros ausentes' }, { status: 400 })
        }

        const documentType = CATEGORY_TO_DOC_TYPE[category] ?? 'other'
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const filePath = `uploads/${Date.now()}-${documentType}-${safeName}`

        // Convert to Buffer for Node.js compatibility
        const fileBuffer = Buffer.from(await file.arrayBuffer())

        // 1. Upload to storage
        const { data: storageData, error: storageError } = await supabaseAdmin.storage
            .from('documents')
            .upload(filePath, fileBuffer, { contentType: file.type, upsert: true })

        if (storageError) {
            const msg = storageError.message ?? JSON.stringify(storageError)
            console.error('[Dashboard Upload] Storage error:', msg)
            return NextResponse.json({ error: `Storage: ${msg}` }, { status: 500 })
        }

        // 2. Upsert into case_documents apenas se ainda não estiver aprovado
        const { data: existingCaseDoc } = await supabaseAdmin
            .from('case_documents')
            .select('status')
            .eq('case_id', caseId)
            .eq('document_type', documentType)
            .eq('version', 1)
            .single()

        if (existingCaseDoc?.status !== 'approved') {
            const { error: caseDocErr } = await supabaseAdmin
                .from('case_documents')
                .upsert({
                    case_id: caseId,
                    document_type: documentType,
                    version: 1,
                    file_path: storageData.path,
                    file_name: file.name,
                    file_size: file.size,
                    mime_type: file.type,
                    status: 'uploaded',
                    uploaded_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'case_id,document_type,version' })

            if (caseDocErr) {
                console.error('[Dashboard Upload] case_documents error:', caseDocErr.message)
            }
        }

        // 3. Insert into client_documents to trigger extraction pipeline
        const { data: { publicUrl } } = supabaseAdmin.storage
            .from('documents')
            .getPublicUrl(storageData.path)

        const insertPayload: Record<string, unknown> = {
            file_path: storageData.path,
            file_name: file.name,
            file_url: publicUrl,
            file_size: file.size,
            mime_type: file.type,
            extraction_status: 'processing',
            document_type: category,
            metadata: { relationship },
        }
        if (userId) {
            insertPayload.client_id = userId
            insertPayload.uploaded_by = userId
        }

        const { data: clientDoc, error: clientDocErr } = await supabaseAdmin
            .from('client_documents')
            .insert(insertPayload)
            .select()
            .single()

        if (clientDocErr) {
            console.error('[Dashboard Upload] client_documents error:', clientDocErr.message)
            return NextResponse.json({ error: `DB: ${clientDocErr.message}` }, { status: 500 })
        }

        // 4. Invoke extraction edge function (synchronous — awaits completion)
        const { error: fnError } = await supabaseAdmin.functions.invoke('process-document', {
            body: { documentId: clientDoc.id, filePath: storageData.path },
        })

        if (fnError) {
            console.error('[Dashboard Upload] Edge function error:', fnError.message)
            // Garante que o documento não fique preso em 'processing' para sempre
            await supabaseAdmin
                .from('client_documents')
                .update({ extraction_status: 'failed' })
                .eq('id', clientDoc.id)
        }

        return NextResponse.json({ success: true, clientDocumentId: clientDoc.id })

    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : JSON.stringify(e)
        console.error('[Dashboard Upload] Unexpected error:', msg)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}

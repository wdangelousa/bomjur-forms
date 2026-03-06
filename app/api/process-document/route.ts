// Substitua todo o código por:
// app/api/process-document/route.ts

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

// Cliente com SERVICE_ROLE_KEY — bypass de RLS garantido
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
    console.log('=== [API Route] process-document INICIADA ===')

    try {
        const formData = await req.formData()
        const file = formData.get('file') as File
        const documentCategory = formData.get('documentCategory') as string || 'generic'
        const userId = formData.get('userId') as string | null

        if (!file) {
            console.error('[API Route] ERRO: Ficheiro ausente')
            return NextResponse.json({ error: 'Ficheiro ausente' }, { status: 400 })
        }

        console.log('[API Route] Payload recebido:', {
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            documentCategory,
            userId,
        })

        // 1. Upload para o Storage
        const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`
        const filePath = `uploads/${fileName}`

        console.log('[API Route] Fazendo upload para Storage:', filePath)

        const { error: upErr } = await supabaseAdmin.storage
            .from('documents')
            .upload(filePath, file, { contentType: file.type, upsert: true })

        if (upErr) {
            console.error('[API Route] ERRO no upload Storage:', upErr)
            throw upErr
        }

        console.log('[API Route] Upload Storage OK')

        // 2. Gerar URL pública (para preview na review page)
        const { data: { publicUrl } } = supabaseAdmin.storage
            .from('documents')
            .getPublicUrl(filePath)

        // 3. Registro na tabela client_documents com campos CORRETOS
        console.log('[API Route] Inserindo registro na client_documents...')

        const insertPayload: Record<string, unknown> = {
            file_path: filePath,
            file_name: file.name,
            file_url: publicUrl,
            file_size: file.size,
            mime_type: file.type,
            extraction_status: 'processing',
            document_type: documentCategory,
        }

        // Se temos o userId, incluir uploaded_by (necessário para RLS)
        if (userId) {
            insertPayload.uploaded_by = userId
        }

        const { data: doc, error: dbErr } = await supabaseAdmin
            .from('client_documents')
            .insert(insertPayload)
            .select()
            .single()

        if (dbErr) {
            console.error('[API Route] ERRO no INSERT client_documents:', dbErr)
            throw dbErr
        }

        console.log('[API Route] Documento criado na DB:', doc.id)

        // 4. Invocar a Edge Function 'process-document'
        console.log('[API Route] Invocando Edge Function com:', {
            documentId: doc.id,
            filePath,
        })

        const { data: fnData, error: fnError } = await supabaseAdmin.functions.invoke(
            'process-document',
            {
                body: { documentId: doc.id, filePath },
            }
        )

        if (fnError) {
            console.error('[API Route] ERRO na invocação da Edge Function:', fnError)
            // Não faz throw — a Edge Function pode ter aceite e estar a processar em background
            // O erro aqui pode ser apenas do timeout do invoke, não da função em si
        } else {
            console.log('[API Route] Edge Function respondeu:', fnData)
        }

        // 5. Retornar sucesso com documentId para o frontend escutar via Realtime
        console.log('=== [API Route] Sucesso. documentId:', doc.id, '===')
        return NextResponse.json({
            success: true,
            documentId: doc.id,
            filePath,
        })

    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Erro desconhecido'
        console.error('[API Route] ERRO GERAL:', msg)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}

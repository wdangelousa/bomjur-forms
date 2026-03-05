import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
    arrayBufferToBase64,
    resolveMediaType,
    buildFileBlock,
    callClaude,
    extractJson,
} from '@/lib/ai-utils'

// Allows up to 60 seconds on Vercel Pro; on Hobby this is capped at 10s.
export const maxDuration = 60

const EXTRACTION_PROMPT = `Extraia os dados deste documento de imigração e retorne APENAS JSON no formato abaixo. Não escreva nada mais.
{
  "document_type": "tipo do documento",
  "fields": {
    "nome_completo": "valor ou null",
    "data_nascimento": "valor ou null",
    "numero_documento": "valor ou null",
    "data_emissao": "valor ou null",
    "data_validade": "valor ou null",
    "nacionalidade": "valor ou null",
    "orgao_emissor": "valor ou null",
    "sexo": "valor ou null",
    "naturalidade": "valor ou null",
    "estado_civil": "valor ou null"
  },
  "confidence": 0.92
}`

export async function POST(req: NextRequest) {
    const { documentId, filePath } = await req.json()

    if (!documentId || !filePath) {
        return NextResponse.json({ error: 'documentId e filePath são obrigatórios.' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    if (!serviceRoleKey) {
        return NextResponse.json({ error: 'Variáveis de ambiente não configuradas.' }, { status: 500 })
    }

    // Usa service role key para bypassar RLS (seguro — rota protegida pelo middleware)
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Marca como em processamento
    await supabase.from('client_documents').update({
        extraction_status: 'processing',
        extraction_started_at: new Date().toISOString(),
        extraction_error: null,
    }).eq('id', documentId)

    try {
        // Baixa o arquivo do Storage
        const { data: fileBlob, error: dlErr } = await supabase.storage
            .from('documents')
            .download(filePath)

        if (dlErr || !fileBlob) {
            throw new Error(`Download falhou: ${dlErr?.message}`)
        }

        const buffer = await fileBlob.arrayBuffer()
        const base64 = arrayBufferToBase64(buffer)
        const { isPdf, mediaType } = resolveMediaType(filePath, fileBlob.type)
        const fileBlock = buildFileBlock(isPdf, mediaType, base64)

        const aiText = await callClaude(EXTRACTION_PROMPT, fileBlock, isPdf, 1024)
        const parsed = extractJson<{ document_type?: string; fields?: Record<string, unknown>; confidence?: number }>(aiText)

        // Salva os campos extraídos
        const rows = Object.entries(parsed.fields || {})
            .filter(([, v]) => v && v !== 'null')
            .map(([key, value]) => ({
                document_id: documentId,
                field_key: key,
                field_value: String(value),
                confidence: parsed.confidence || 0.9,
            }))

        if (rows.length > 0) {
            const { error: insErr } = await supabase.from('extracted_fields').insert(rows)
            if (insErr) throw new Error(`Erro ao salvar campos: ${insErr.message}`)
        }

        // Marca como concluído
        await supabase.from('client_documents').update({
            extraction_status: 'extracted',
            document_type: parsed.document_type || 'Desconhecido',
            document_type_confidence: parsed.confidence || 0.9,
            extraction_error: null,
            extraction_completed_at: new Date().toISOString(),
            raw_extraction_json: JSON.stringify(parsed),
        }).eq('id', documentId)

        return NextResponse.json({
            fields_extracted: rows.length,
            document_type: parsed.document_type || 'Desconhecido',
        })

    } catch (e) {
        const msg = (e as Error).message
        await supabase.from('client_documents').update({
            extraction_status: 'error',
            extraction_error: msg.substring(0, 500),
        }).eq('id', documentId)

        return NextResponse.json({ error: msg }, { status: 500 })
    }
}

// Supabase Edge Function: process-document
// Deno Runtime - compatível com Supabase Edge Functions
// Versão: 1.0.0

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─── Tipos ─────────────────────────────────────────────────────────────────

interface ExtractedField {
    field_name: string
    field_value: string
    confidence: number // 0.0 a 1.0
    category: string
}

interface ClaudeExtractionResult {
    document_type: string
    document_type_confidence: number
    language: string
    fields: ExtractedField[]
    processing_notes: string
}

// ─── Handler principal ──────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
    // Permite requisições do browser (CORS)
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
            },
        })
    }

    try {
        // ── 1. Valida e lê o body ──────────────────────────────────────────────
        const { document_id } = await req.json()

        if (!document_id) {
            return errorResponse('O campo document_id é obrigatório.', 400)
        }

        // ── 2. Inicializa o cliente Supabase com a Service Role Key ────────────
        //    (a Service Role Key ignora Row Level Security — necessária para ler
        //     arquivos do storage e escrever na tabela extracted_fields)
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            { auth: { persistSession: false } }
        )

        // ── 3. Busca o registro do documento na tabela client_documents ─────────
        const { data: doc, error: docError } = await supabase
            .from('client_documents')
            .select('*')
            .eq('id', document_id)
            .single()

        if (docError || !doc) {
            return errorResponse(`Documento não encontrado: ${docError?.message}`, 404)
        }

        // ── 4. Marca o documento como "em processamento" ────────────────────────
        await supabase
            .from('client_documents')
            .update({ processing_status: 'processing' })
            .eq('id', document_id)

        // ── 5. Baixa o arquivo do Supabase Storage ─────────────────────────────
        const { data: fileData, error: downloadError } = await supabase.storage
            .from('bomjur-documents')
            .download(doc.file_path)

        if (downloadError || !fileData) {
            await supabase
                .from('client_documents')
                .update({ processing_status: 'error' })
                .eq('id', document_id)
            return errorResponse(`Erro ao baixar arquivo: ${downloadError?.message}`, 500)
        }

        // ── 6. Converte o arquivo para Base64 ──────────────────────────────────
        const fileBuffer = await fileData.arrayBuffer()
        const base64File = btoa(
            String.fromCharCode(...new Uint8Array(fileBuffer))
        )

        // ── 7. Determina o media type para o Claude ────────────────────────────
        const mediaType = getMediaType(doc.file_type, doc.file_name)

        // ── 8. Chama a API do Claude Vision ────────────────────────────────────
        const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') ?? ''

        const claudePayload = {
            model: 'claude-opus-4-5',
            max_tokens: 4096,
            messages: [
                {
                    role: 'user',
                    content: [
                        // Imagem / PDF do documento
                        {
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: mediaType,
                                data: base64File,
                            },
                        },
                        // Prompt de extração estruturada
                        {
                            type: 'text',
                            text: `Você é um especialista em análise de documentos de imigração americano-brasileira.

Analise este documento e extraia TODOS os campos relevantes em formato JSON estruturado.

Retorne APENAS um objeto JSON válido, sem texto adicional, seguindo exatamente este schema:

{
  "document_type": "tipo do documento (ex: Passaporte, Visto B1/B2, I-94, I-20, CPF, RG, etc.)",
  "document_type_confidence": 0.95,
  "language": "idioma principal do documento (pt-BR, en-US, etc.)",
  "fields": [
    {
      "field_name": "nome_do_campo_em_snake_case",
      "field_value": "valor extraído exatamente como aparece no documento",
      "confidence": 0.98,
      "category": "categoria (identidade | viagem | pessoal | endereço | financeiro | juridico | outro)"
    }
  ],
  "processing_notes": "observações relevantes sobre o documento (ex: documento parcialmente visível, assinatura ilegível, etc.)"
}

Campos a extrair (se presentes):
- Dados de identidade: nome completo, data de nascimento, nacionalidade, número do documento, data de emissão, data de validade, órgão emissor
- Dados pessoais: sexo/gênero, estado civil, profissão, CPF, RG, passaporte número
- Dados de viagem: número do visto, tipo de visto, data de entrada, data de saída, país de destino, porto de entrada
- Endereço: endereço residencial, cidade, estado, CEP, país
- Dados financeiros: renda, patrimônio (se aplicável)
- Dados jurídicos: número de processo, advogado responsável, petition number

Seja preciso. Se um campo não estiver visível ou legível, não o inclua na lista.
Para o confidence score: 1.0 = certeza absoluta, 0.7 = razoável, 0.5 = incerto.`,
                        },
                    ],
                },
            ],
        }

        const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': anthropicKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify(claudePayload),
        })

        if (!claudeResponse.ok) {
            const claudeError = await claudeResponse.text()
            await supabase
                .from('client_documents')
                .update({ processing_status: 'error' })
                .eq('id', document_id)
            return errorResponse(`Erro na API do Claude: ${claudeError}`, 500)
        }

        const claudeData = await claudeResponse.json()
        const rawText: string = claudeData.content?.[0]?.text ?? ''

        // ── 9. Faz o parse do JSON retornado pelo Claude ────────────────────────
        let extraction: ClaudeExtractionResult

        try {
            // Remove possíveis marcadores de código (```json ... ```)
            const cleaned = rawText
                .replace(/^```json\s*/i, '')
                .replace(/^```\s*/i, '')
                .replace(/\s*```$/i, '')
                .trim()

            extraction = JSON.parse(cleaned)
        } catch {
            await supabase
                .from('client_documents')
                .update({ processing_status: 'error' })
                .eq('id', document_id)
            return errorResponse('Claude retornou JSON inválido.', 500)
        }

        // ── 10. Salva os campos extraídos na tabela extracted_fields ────────────
        if (extraction.fields && extraction.fields.length > 0) {
            const rows = extraction.fields.map((field: ExtractedField) => ({
                document_id,
                field_name: field.field_name,
                field_value: String(field.field_value),
                confidence: field.confidence,
                category: field.category,
            }))

            const { error: insertError } = await supabase
                .from('extracted_fields')
                .insert(rows)

            if (insertError) {
                console.error('Erro ao inserir campos extraídos:', insertError)
            }
        }

        // ── 11. Atualiza o documento com os metadados da extração ───────────────
        await supabase
            .from('client_documents')
            .update({
                processing_status: 'completed',
                document_type: extraction.document_type,
                document_type_confidence: extraction.document_type_confidence,
                processing_notes: extraction.processing_notes,
                processed_at: new Date().toISOString(),
            })
            .eq('id', document_id)

        // ── 12. Retorna o resultado ─────────────────────────────────────────────
        return new Response(
            JSON.stringify({
                success: true,
                document_id,
                document_type: extraction.document_type,
                fields_extracted: extraction.fields?.length ?? 0,
                data: extraction,
            }),
            {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            }
        )
    } catch (err) {
        console.error('Erro inesperado:', err)
        return errorResponse(`Erro interno: ${String(err)}`, 500)
    }
})

// ─── Utilitários ────────────────────────────────────────────────────────────

function errorResponse(message: string, status: number): Response {
    return new Response(
        JSON.stringify({ success: false, error: message }),
        {
            status,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        }
    )
}

/**
 * Mapeia o file_type (MIME) para o media_type que o Claude Vision aceita.
 * Claude aceita: image/jpeg, image/png, image/gif, image/webp, application/pdf
 */
function getMediaType(
    mimeType: string,
    fileName: string
): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | 'application/pdf' {
    const mime = (mimeType ?? '').toLowerCase()
    const ext = (fileName ?? '').split('.').pop()?.toLowerCase()

    if (mime === 'application/pdf' || ext === 'pdf') return 'application/pdf'
    if (mime === 'image/png' || ext === 'png') return 'image/png'
    if (mime === 'image/gif' || ext === 'gif') return 'image/gif'
    if (mime === 'image/webp' || ext === 'webp') return 'image/webp'

    // JPEG como padrão (cobre jpg, jpeg e tipos desconhecidos)
    return 'image/jpeg'
}

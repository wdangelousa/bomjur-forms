// Supabase Edge Function: process-document
// v3 — modelo correto, service_role para bypass RLS, erros de insert verificados

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Converte ArrayBuffer para Base64 em chunks (evita stack overflow em PDFs grandes)
function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { documentId, filePath } = await req.json();
        if (!documentId || !filePath) {
            throw new Error('documentId e filePath são obrigatórios.');
        }

        // ── Cliente com SERVICE ROLE KEY para bypass de RLS ──────────────────
        // Operações internas da Edge Function não devem depender das políticas do usuário
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        );

        // ── 1. Marca como "processing" ────────────────────────────────────────
        const { error: updateErr } = await supabase.from('client_documents')
            .update({
                extraction_status: 'processing',
                extraction_started_at: new Date().toISOString(),
            })
            .eq('id', documentId);

        if (updateErr) {
            console.error('Erro ao marcar como processing:', updateErr.message);
        }

        // ── 2. Baixa o arquivo do Storage ─────────────────────────────────────
        const { data: fileBlob, error: downloadError } = await supabase.storage
            .from('bomjur-documents').download(filePath);

        if (downloadError || !fileBlob) {
            throw new Error(`Erro ao baixar arquivo do Storage: ${downloadError?.message}`);
        }

        // ── 3. Converter para Base64 ──────────────────────────────────────────
        const base64Data = arrayBufferToBase64(await fileBlob.arrayBuffer());

        // ── 4. Detecta se é PDF ou imagem ─────────────────────────────────────
        const ext = filePath.split('.').pop()?.toLowerCase();
        const isPdf = ext === 'pdf' || fileBlob.type === 'application/pdf';

        type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
        const validImageTypes: ImageMediaType[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        const imageMediaType: ImageMediaType = validImageTypes.includes(fileBlob.type as ImageMediaType)
            ? (fileBlob.type as ImageMediaType)
            : 'image/jpeg';

        // ── 5. Monta o bloco de conteúdo para o Claude ───────────────────────
        //    PDFs  → type: "document"  |  Imagens → type: "image"
        const fileContentBlock = isPdf
            ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } }
            : { type: 'image', source: { type: 'base64', media_type: imageMediaType, data: base64Data } };

        // ── 6. Chama o Claude ─────────────────────────────────────────────────
        const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
        if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY não configurada nos Secrets do Supabase.');

        const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': anthropicKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                model: 'claude-3-5-sonnet-20241022',   // ← modelo com suporte a visão e documentos
                max_tokens: 2048,
                messages: [{
                    role: 'user',
                    content: [
                        fileContentBlock,
                        {
                            type: 'text',
                            text: `Você é um especialista em documentos de imigração (Brasil/EUA).

Analise este documento e retorne APENAS um objeto JSON puro (sem blocos de código, sem markdown, sem explicações).

Schema obrigatório:
{
  "document_type": "tipo do documento (Passaporte, Visto, I-140, I-485, RG, CPF, Certidão de Nascimento, Certidão de Casamento, etc.)",
  "fields": {
    "nome_completo": "valor ou null",
    "data_nascimento": "valor ou null",
    "numero_documento": "valor ou null",
    "data_emissao": "valor ou null",
    "data_validade": "valor ou null",
    "nacionalidade": "valor ou null",
    "numero_visto": "valor ou null",
    "tipo_visto": "valor ou null",
    "orgao_emissor": "valor ou null",
    "cpf": "valor ou null",
    "passaporte_numero": "valor ou null",
    "sexo": "valor ou null",
    "naturalidade": "valor ou null",
    "estado_civil": "valor ou null",
    "conjuge_nome": "valor ou null",
    "data_casamento": "valor ou null"
  },
  "confidence": 0.95
}

Preencha com null os campos não encontrados no documento.`
                        }
                    ]
                }]
            }),
        });

        if (!claudeResponse.ok) {
            const errText = await claudeResponse.text();
            throw new Error(`Erro do Claude (${claudeResponse.status}): ${errText}`);
        }

        const claudeData = await claudeResponse.json();
        let aiText: string = claudeData.content[0].text.trim();

        // Extrai o bloco JSON mesmo que o Claude retorne texto ao redor
        if (aiText.includes('{')) {
            aiText = aiText.substring(aiText.indexOf('{'), aiText.lastIndexOf('}') + 1);
        }

        let parsed: { document_type?: string; fields?: Record<string, string | null>; confidence?: number };
        try {
            parsed = JSON.parse(aiText);
        } catch {
            throw new Error(`Resposta do Claude não é JSON válido: ${aiText.substring(0, 300)}`);
        }

        // ── 7. Insere os campos extraídos ─────────────────────────────────────
        const fieldsToInsert = Object.entries(parsed.fields ?? {})
            .filter(([, v]) => v !== null && v !== '' && v !== 'null')
            .map(([key, value]) => ({
                document_id: documentId,
                field_key: key,
                field_value: String(value),
                confidence: parsed.confidence ?? 0.9,
                review_status: 'pending',
            }));

        if (fieldsToInsert.length > 0) {
            const { error: insertErr } = await supabase.from('extracted_fields').insert(fieldsToInsert);
            if (insertErr) {
                // Loga o erro mas não interrompe — atualiza o status com erro
                console.error('Erro ao inserir extracted_fields:', insertErr.message);
                await supabase.from('client_documents').update({
                    extraction_status: 'error',
                    extraction_error: `insert_error: ${insertErr.message}`,
                }).eq('id', documentId);

                return new Response(
                    JSON.stringify({ error: `Erro ao salvar campos: ${insertErr.message}` }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
                );
            }
        }

        // ── 8. Marca como concluído ───────────────────────────────────────────
        await supabase.from('client_documents').update({
            extraction_status: 'extracted',
            document_type: parsed.document_type ?? null,
            document_type_confidence: parsed.confidence ?? null,
            extraction_completed_at: new Date().toISOString(),
            raw_extraction_json: aiText,
        }).eq('id', documentId);

        return new Response(
            JSON.stringify({
                status: 'success',
                document_type: parsed.document_type,
                fields_extracted: fieldsToInsert.length,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );

    } catch (error) {
        console.error('Edge Function error:', (error as Error).message);
        return new Response(
            JSON.stringify({ error: (error as Error).message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
    }
});
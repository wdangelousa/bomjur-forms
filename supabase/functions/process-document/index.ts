// Supabase Edge Function: process-document
// Runtime: Deno | Fix: btoa em chunks para suportar PDFs grandes

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Converte ArrayBuffer para Base64 em chunks (suporta arquivos grandes) ──
function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 8192; // 8 KB por chunk — evita stack overflow
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { documentId, filePath } = await req.json();

        // ── Inicializa Supabase ────────────────────────────────────────────
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: req.headers.get('Authorization')! } }
        });

        // ── 1. Marca como "em processamento" ──────────────────────────────
        await supabase
            .from('client_documents')
            .update({
                extraction_status: 'processing',
                extraction_started_at: new Date().toISOString(),
            })
            .eq('id', documentId);

        // ── 2. Baixa o arquivo do Storage ─────────────────────────────────
        const { data: fileData, error: downloadError } = await supabase
            .storage
            .from('bomjur-documents')
            .download(filePath);

        if (downloadError || !fileData) {
            throw new Error(`Erro ao baixar arquivo: ${downloadError?.message}`);
        }

        // ── 3. Converte para Base64 em chunks (suporta PDFs grandes) ──────
        const arrayBuffer = await fileData.arrayBuffer();
        const base64Data = arrayBufferToBase64(arrayBuffer);

        // ── 4. Determina o media_type para o Claude ───────────────────────
        const mimeType = fileData.type || 'image/jpeg';
        type ClaudeMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | 'application/pdf';
        const allowedTypes: ClaudeMediaType[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
        const mediaType: ClaudeMediaType = allowedTypes.includes(mimeType as ClaudeMediaType)
            ? (mimeType as ClaudeMediaType)
            : 'image/jpeg';

        // ── 5. Chama o Claude Vision ──────────────────────────────────────
        const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
        if (!anthropicKey) {
            throw new Error('ANTHROPIC_API_KEY não configurada. Vá em Supabase > Edge Functions > Secrets e adicione a chave.');
        }

        const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': anthropicKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                model: 'claude-opus-4-5',
                max_tokens: 2048,
                messages: [{
                    role: 'user',
                    content: [
                        {
                            type: 'image',
                            source: { type: 'base64', media_type: mediaType, data: base64Data }
                        },
                        {
                            type: 'text',
                            text: `Você é um especialista em documentos de imigração (Brasil/EUA).

Analise este documento e retorne APENAS um objeto JSON puro (sem blocos de código, sem explicações, sem markdown).

Schema obrigatório:
{
  "document_type": "tipo do documento (Passaporte, Visto, I-140, I-485, RG, CPF, Certidão de Nascimento, etc.)",
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
    "estado_civil": "valor ou null",
    "naturalidade": "valor ou null"
  },
  "confidence": 0.95
}

Preencha com null os campos não encontrados no documento.`
                        }
                    ]
                }]
            }),
        });

        if (!anthropicResponse.ok) {
            const errText = await anthropicResponse.text();
            throw new Error(`Erro do Claude (${anthropicResponse.status}): ${errText}`);
        }

        const anthropicData = await anthropicResponse.json();
        let aiText: string = anthropicData.content[0].text.trim();

        // ── 6. Extrai apenas o JSON da resposta ───────────────────────────
        if (aiText.includes('{')) {
            aiText = aiText.substring(aiText.indexOf('{'), aiText.lastIndexOf('}') + 1);
        }

        let parsed: { document_type?: string; fields?: Record<string, string | null>; confidence?: number };
        try {
            parsed = JSON.parse(aiText);
        } catch {
            throw new Error(`JSON inválido do Claude: ${aiText.substring(0, 200)}`);
        }

        // ── 7. Insere os campos extraídos em extracted_fields ─────────────
        const fieldsToInsert = Object.entries(parsed.fields ?? {})
            .filter(([, value]) => value !== null && value !== '')
            .map(([key, value]) => ({
                document_id: documentId,
                field_key: key,
                field_value: String(value),
                confidence: parsed.confidence ?? 0.9,
            }));

        if (fieldsToInsert.length > 0) {
            const { error: insertError } = await supabase
                .from('extracted_fields')
                .insert(fieldsToInsert);

            if (insertError) {
                console.error('Erro ao inserir extracted_fields:', insertError.message);
            }
        }

        // ── 8. Atualiza o documento com os resultados ─────────────────────
        await supabase
            .from('client_documents')
            .update({
                extraction_status: 'extracted',
                document_type: parsed.document_type ?? null,
                document_type_confidence: parsed.confidence ?? null,
                extraction_completed_at: new Date().toISOString(),
                raw_extraction_json: aiText,
            })
            .eq('id', documentId);

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
// Supabase Edge Function: process-document
// Runtime: Deno | Supabase Edge Functions
// Schema validado: extracted_fields usa field_key (NOT NULL), não field_name

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { documentId, filePath } = await req.json();

        // ── Inicializa Supabase com o token do usuário ─────────────────────
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: req.headers.get('Authorization')! } }
        });

        // ── 1. Marca o documento como "em extração" ────────────────────────
        await supabase
            .from('client_documents')
            .update({
                extraction_status: 'processing',
                extraction_started_at: new Date().toISOString(),
            })
            .eq('id', documentId);

        // ── 2. Baixa o arquivo do Storage ──────────────────────────────────
        const { data: fileData, error: downloadError } = await supabase
            .storage
            .from('bomjur-documents')
            .download(filePath);

        if (downloadError || !fileData) {
            throw new Error(`Erro ao baixar arquivo: ${downloadError?.message}`);
        }

        // ── 3. Converte para Base64 ────────────────────────────────────────
        const arrayBuffer = await fileData.arrayBuffer();
        const base64Image = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

        // ── 4. Determina o media_type para o Claude ────────────────────────
        const mimeType = fileData.type || 'image/jpeg';
        type ClaudeMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | 'application/pdf';
        const allowedTypes: ClaudeMediaType[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
        const mediaType: ClaudeMediaType = allowedTypes.includes(mimeType as ClaudeMediaType)
            ? (mimeType as ClaudeMediaType)
            : 'image/jpeg';

        // ── 5. Chama o Claude Vision ────────────────────────────────────────
        const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
        if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY não configurada nos Secrets da Edge Function.');

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
                            source: { type: 'base64', media_type: mediaType, data: base64Image }
                        },
                        {
                            type: 'text',
                            text: `Você é um especialista em documentos de imigração (Brasil/EUA).

Analise este documento e retorne APENAS um objeto JSON puro (sem blocos de código, sem explicações).

Schema OBRIGATÓRIO:
{
  "document_type": "tipo do documento (Passaporte, Visto, I-140, I-485, RG, CPF, etc.)",
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
    "passaporte_numero": "valor ou null"
  },
  "confidence": 0.95
}

Inclua apenas os campos visíveis no documento. Preencha com null os não encontrados.`
                        }
                    ]
                }]
            }),
        });

        if (!anthropicResponse.ok) {
            const errText = await anthropicResponse.text();
            throw new Error(`Erro do Claude: ${errText}`);
        }

        const anthropicData = await anthropicResponse.json();
        let aiText: string = anthropicData.content[0].text.trim();

        // ── 6. Limpa e faz parse do JSON retornado ─────────────────────────
        if (aiText.includes('{')) {
            aiText = aiText.substring(aiText.indexOf('{'), aiText.lastIndexOf('}') + 1);
        }

        let parsed: { document_type?: string; fields?: Record<string, string | null>; confidence?: number };
        try {
            parsed = JSON.parse(aiText);
        } catch {
            throw new Error('Claude retornou JSON inválido.');
        }

        // ── 7. Insere um registro por campo em extracted_fields ─────────────
        //    Schema real: document_id (NOT NULL), field_key (NOT NULL), field_value, confidence
        const fieldsToInsert = Object.entries(parsed.fields ?? {})
            .filter(([, value]) => value !== null && value !== '')
            .map(([key, value]) => ({
                document_id: documentId,
                field_key: key,                          // nome do campo em snake_case
                field_value: String(value),              // valor extraído
                confidence: parsed.confidence ?? 0.9,   // score geral
            }));

        if (fieldsToInsert.length > 0) {
            const { error: insertError } = await supabase
                .from('extracted_fields')
                .insert(fieldsToInsert);

            if (insertError) {
                console.error('Erro ao inserir extracted_fields:', insertError.message);
            }
        }

        // ── 8. Marca o documento como concluído ────────────────────────────
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
        console.error('Edge Function error:', error);
        return new Response(
            JSON.stringify({ error: (error as Error).message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
    }
});
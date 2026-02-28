// Supabase Edge Function: process-document
// v6 — Retorna 202 imediatamente, processa em background via EdgeRuntime.waitUntil

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
}

// ─── Lógica principal de extração (roda em background) ───────────────────────
async function extractDocument(
    supabase: ReturnType<typeof createClient>,
    documentId: string,
    filePath: string,
) {
    const log = async (msg: string, isError = false) => {
        console.log(`[${documentId}] ${msg}`);
        const update: Record<string, string> = { extraction_error: msg.substring(0, 500) };
        if (isError) update.extraction_status = 'error';
        await supabase.from('client_documents').update(update).eq('id', documentId);
    };

    try {
        // 1. Marca início
        await supabase.from('client_documents').update({
            extraction_status: 'processing',
            extraction_started_at: new Date().toISOString(),
            extraction_error: 'ETAPA: Baixando arquivo...'
        }).eq('id', documentId);

        // 2. Download do Storage
        const { data: fileBlob, error: dlErr } = await supabase.storage
            .from('bomjur-documents').download(filePath);
        if (dlErr || !fileBlob) throw new Error(`Download falhou: ${dlErr?.message}`);

        await log('ETAPA: Convertendo base64...');
        const base64Data = arrayBufferToBase64(await fileBlob.arrayBuffer());

        // 3. Tipo de mídia
        const ext = filePath.split('.').pop()?.toLowerCase();
        const isPdf = ext === 'pdf' || fileBlob.type === 'application/pdf';

        let mediaType = fileBlob.type || 'image/jpeg';
        if (!isPdf) {
            if (mediaType.includes('jpg') || mediaType.includes('jpeg')) mediaType = 'image/jpeg';
            else if (mediaType.includes('png')) mediaType = 'image/png';
            else if (mediaType.includes('gif')) mediaType = 'image/gif';
            else if (mediaType.includes('webp')) mediaType = 'image/webp';
            else mediaType = 'image/jpeg';
        }

        // 4. Chama Claude
        await log(`ETAPA: Chamando Claude Vision (${isPdf ? 'PDF' : mediaType})...`);
        const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
        if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY não encontrada.');

        const headers: Record<string, string> = {
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
        };
        if (isPdf) headers['anthropic-beta'] = 'pdfs-2024-09-25';

        const fileBlock = isPdf
            ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } }
            : { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } };

        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 1024,
                messages: [{
                    role: 'user',
                    content: [
                        fileBlock,
                        {
                            type: 'text',
                            text: `Extraia os dados deste documento de imigração e retorne APENAS JSON no formato abaixo. Não escreva nada mais.
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
                        }
                    ]
                }]
            }),
        });

        if (!res.ok) {
            const body = await res.text();
            throw new Error(`Claude Erro ${res.status}: ${body.substring(0, 200)}`);
        }

        const claudeData = await res.json();
        const aiText: string = claudeData.content[0].text;

        await log('ETAPA: Processando resposta da IA...');

        const match = aiText.match(/\{[\s\S]*\}/);
        if (!match) throw new Error(`JSON não encontrado: ${aiText.substring(0, 100)}`);
        const parsed = JSON.parse(match[0]);

        // 5. Salva campos extraídos
        const rows = Object.entries(parsed.fields || {})
            .filter(([, v]) => v && v !== 'null')
            .map(([key, value]) => ({
                document_id: documentId,
                field_key: key,
                field_value: String(value),
                confidence: parsed.confidence || 0.9,
            }));

        if (rows.length > 0) {
            await log(`ETAPA: Salvando ${rows.length} campos...`);
            const { error: insErr } = await supabase.from('extracted_fields').insert(rows);
            if (insErr) throw new Error(`Erro ao salvar campos: ${insErr.message}`);
        }

        // 6. Finaliza
        await supabase.from('client_documents').update({
            extraction_status: 'extracted',
            document_type: parsed.document_type || 'Desconhecido',
            document_type_confidence: parsed.confidence || 0.9,
            extraction_error: null,
            extraction_completed_at: new Date().toISOString(),
            raw_extraction_json: JSON.stringify(parsed),
        }).eq('id', documentId);

        console.log(`[${documentId}] ✅ Extração concluída — ${rows.length} campos`);

    } catch (e) {
        const msg = (e as Error).message;
        console.error(`[${documentId}] ERRO: ${msg}`);
        await log(`ERRO: ${msg}`, true);
    }
}

// ─── Handler HTTP ─────────────────────────────────────────────────────────────
serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { documentId, filePath } = await req.json();
        if (!documentId || !filePath) throw new Error('documentId e filePath obrigatórios.');

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        );

        // Retorna 202 IMEDIATAMENTE e processa em background
        const edgeRuntime = (globalThis as any).EdgeRuntime;
        if (edgeRuntime?.waitUntil) {
            edgeRuntime.waitUntil(extractDocument(supabase, documentId, filePath));
        } else {
            // Fallback síncrono (ex: ambiente local)
            extractDocument(supabase, documentId, filePath);
        }

        return new Response(
            JSON.stringify({ status: 'processing', message: 'Extração iniciada em background.' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 202 }
        );

    } catch (e) {
        return new Response(
            JSON.stringify({ error: (e as Error).message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
    }
});
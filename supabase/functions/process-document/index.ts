// Supabase Edge Function: process-document
// v4 — Diagnóstico e Logging avançado

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

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    // Cliente com SERVICE ROLE para logs de erro mesmo em falhas
    const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    let currentDocId = "";

    const logStatus = async (msg: string, isError = false) => {
        console.log(`[${currentDocId}] ${msg}`);
        if (!currentDocId) return;

        const updateData: any = {
            extraction_error: msg,
            updated_at: new Date().toISOString()
        };
        if (isError) updateData.extraction_status = 'error';

        await supabaseAdmin.from('client_documents')
            .update(updateData)
            .eq('id', currentDocId);
    };

    try {
        const { documentId, filePath } = await req.json();
        currentDocId = documentId;

        await logStatus("Iniciando extração (v4)...");

        if (!documentId || !filePath) throw new Error('Dados incompletos (id/path)');

        // 1. Marcar Início
        await supabaseAdmin.from('client_documents')
            .update({
                extraction_status: 'processing',
                extraction_started_at: new Date().toISOString(),
                extraction_error: 'LOG: Iniciado'
            })
            .eq('id', documentId);

        // 2. Download
        await logStatus("LOG: Baixando do storage...");
        const { data: fileBlob, error: downloadError } = await supabaseAdmin.storage
            .from('bomjur-documents').download(filePath);

        if (downloadError || !fileBlob) throw new Error(`Falha download: ${downloadError?.message}`);

        // 3. Base64
        await logStatus("LOG: Convertendo base64...");
        const base64Data = arrayBufferToBase64(await fileBlob.arrayBuffer());

        // 4. Claude Request
        await logStatus("LOG: Chamando Claude Vision...");
        const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout

        const isPdf = filePath.toLowerCase().endsWith('.pdf');
        const fileContentBlock = isPdf
            ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } }
            : { type: 'image', source: { type: 'base64', media_type: fileBlob.type || 'image/jpeg', data: base64Data } };

        const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            signal: controller.signal,
            headers: {
                'x-api-key': anthropicKey!,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 2048,
                messages: [{
                    role: 'user',
                    content: [
                        fileContentBlock,
                        {
                            type: 'text',
                            text: `Retorne JSON puro: {"document_type": string, "fields": {"nome_completo": string, "data_nascimento": string, "numero_documento": string, ...}, "confidence": float}`
                        }
                    ]
                }]
            }),
        });

        clearTimeout(timeout);

        if (!claudeResponse.ok) {
            const err = await claudeResponse.text();
            throw new Error(`Claude falhou (${claudeResponse.status}): ${err.substring(0, 100)}`);
        }

        const claudeData = await claudeResponse.json();
        const aiText = claudeData.content[0].text;

        await logStatus("LOG: Processando resposta IA...");
        const parsed = JSON.parse(aiText.substring(aiText.indexOf('{'), aiText.lastIndexOf('}') + 1));

        // 5. Salvar Campos
        await logStatus(`LOG: Salvando ${Object.keys(parsed.fields || {}).length} campos...`);
        const fieldsToInsert = Object.entries(parsed.fields || {})
            .filter(([, v]) => v)
            .map(([key, value]) => ({
                document_id: documentId,
                field_key: key,
                field_value: String(value),
                confidence: parsed.confidence || 0.9,
            }));

        if (fieldsToInsert.length > 0) {
            const { error: insErr } = await supabaseAdmin.from('extracted_fields').insert(fieldsToInsert);
            if (insErr) throw new Error(`Erro insert fields: ${insErr.message}`);
        }

        // 6. Concluir
        await supabaseAdmin.from('client_documents').update({
            extraction_status: 'extracted',
            document_type: parsed.document_type,
            extraction_error: null,
            extraction_completed_at: new Date().toISOString(),
            raw_extraction_json: aiText
        }).eq('id', documentId);

        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });

    } catch (error) {
        await logStatus(`ERRO: ${(error as Error).message}`, true);
        return new Response(JSON.stringify({ error: (error as Error).message }), {
            headers: corsHeaders,
            status: 400
        });
    }
});
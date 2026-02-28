// Supabase Edge Function: process-document
// v5 — Suporte a PDFs (beta), media_type rigoroso e logging de resposta da API

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

    const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    let currentDocId = "";

    const logStatus = async (msg: string, isError = false) => {
        console.log(`[${currentDocId}] ${msg}`);
        if (!currentDocId) return;

        const updateData: any = {
            extraction_error: msg.substring(0, 1000), // Proteção contra strings gigantes
            updated_at: new Date().toISOString()
        };
        if (isError) updateData.extraction_status = 'error';

        await supabaseAdmin.from('client_documents')
            .update(updateData)
            .eq('id', currentDocId);
    };

    try {
        const body = await req.json();
        const { documentId, filePath } = body;
        currentDocId = documentId;

        await logStatus("Iniciando extração (v5)...");

        if (!documentId || !filePath) throw new Error('Dados incompletos (id/path)');

        // 1. Marca Processando
        await supabaseAdmin.from('client_documents')
            .update({
                extraction_status: 'processing',
                extraction_started_at: new Date().toISOString(),
                extraction_error: 'ETAPA: Baixando arquivo...'
            })
            .eq('id', documentId);

        // 2. Download
        const { data: fileBlob, error: downloadError } = await supabaseAdmin.storage
            .from('bomjur-documents').download(filePath);

        if (downloadError || !fileBlob) throw new Error(`Falha download storage: ${downloadError?.message}`);

        // 3. Base64
        await logStatus("ETAPA: Convertendo para Base64...");
        const base64Data = arrayBufferToBase64(await fileBlob.arrayBuffer());

        // 4. Determina MIME Type rigoroso para Claude
        const ext = filePath.split('.').pop()?.toLowerCase();
        const isPdf = ext === 'pdf' || fileBlob.type === 'application/pdf';

        let mediaType = fileBlob.type;
        // Normalização de tipos de imagem para o padrão Claude
        if (!isPdf) {
            if (mediaType.includes('jpg') || mediaType.includes('jpeg')) mediaType = 'image/jpeg';
            else if (mediaType.includes('png')) mediaType = 'image/png';
            else if (mediaType.includes('gif')) mediaType = 'image/gif';
            else if (mediaType.includes('webp')) mediaType = 'image/webp';
            else mediaType = 'image/jpeg'; // Fallback
        } else {
            mediaType = 'application/pdf';
        }

        // 5. Claude API Call
        await logStatus(`ETAPA: Chamando Claude Vision (${isPdf ? 'PDF' : 'Imagem'})...`);
        const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
        if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY não encontrada.');

        const headers: Record<string, string> = {
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
        };

        // Cabeçalho beta obrigatório para suporte a PDF no Sonnet 3.5
        if (isPdf) {
            headers['anthropic-beta'] = 'pdfs-2024-09-25';
        }

        const fileContentBlock = isPdf
            ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } }
            : { type: 'image', source: { type: 'base64', media_type: mediaType as any, data: base64Data } };

        const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 2048,
                messages: [{
                    role: 'user',
                    content: [
                        fileContentBlock,
                        {
                            type: 'text',
                            text: `Você é um especialista em imigração. Extraia os dados deste documento para JSON.
Campos: nome_completo, data_nascimento, numero_documento, data_emissao, data_validade, nacionalidade, numero_visto, tipo_visto, orgao_emissor, cpf, passaporte_numero, sexo, naturalidade, estado_civil.

Retorne APENAS o JSON conforme este exemplo:
{ "document_type": "Passaporte", "fields": { "nome_completo": "JOÃO SILVA", ... }, "confidence": 0.99 }`
                        }
                    ]
                }]
            }),
        });

        if (!claudeResponse.ok) {
            const errBody = await claudeResponse.text();
            throw new Error(`API Claude Erro ${claudeResponse.status}: ${errBody}`);
        }

        const claudeData = await claudeResponse.json();
        const aiText = claudeData.content[0].text;

        await logStatus("ETAPA: Processando resposta da IA...");

        // Parsing robusto do JSON
        const jsonMatch = aiText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("IA não retornou um JSON válido.");
        const parsed = JSON.parse(jsonMatch[0]);

        // 6. Salvar Campos em extracted_fields
        const fieldsToInsert = Object.entries(parsed.fields || {})
            .filter(([, v]) => v && v !== 'null' && v !== 'NULL')
            .map(([key, value]) => ({
                document_id: documentId,
                field_key: key,
                field_value: String(value),
                confidence: parsed.confidence || 0.9,
            }));

        if (fieldsToInsert.length > 0) {
            await logStatus(`ETAPA: Salvando ${fieldsToInsert.length} campos...`);
            const { error: insErr } = await supabaseAdmin.from('extracted_fields').insert(fieldsToInsert);
            if (insErr) throw new Error(`Erro ao salvar no banco: ${insErr.message}`);
        }

        // 7. Finaliza documento
        await supabaseAdmin.from('client_documents').update({
            extraction_status: 'extracted',
            document_type: parsed.document_type || 'Desconhecido',
            extraction_error: null,
            document_type_confidence: parsed.confidence || 0.9,
            extraction_completed_at: new Date().toISOString(),
            raw_extraction_json: JSON.stringify(parsed)
        }).eq('id', documentId);

        return new Response(JSON.stringify({ status: 'success' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (error) {
        const msg = (error as Error).message;
        await logStatus(`ERRO: ${msg}`, true);
        return new Response(JSON.stringify({ error: msg }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
        });
    }
});
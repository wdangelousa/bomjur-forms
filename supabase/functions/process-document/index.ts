// Supabase Edge Function: process-document
// v7 — PDF nativo + base64 seguro via Deno std (sem stack overflow)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Converte ArrayBuffer para base64 byte a byte — sem spread de arrays grandes,
// eliminando o risco de "Maximum call stack size exceeded" em PDFs maiores.
function toBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

// Determina o media type correto a partir do Blob e da extensão do caminho.
function resolveMediaType(blob: Blob, filePath: string): { isPdf: boolean; mediaType: string } {
    const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
    const mime = blob.type ?? '';

    const isPdf = ext === 'pdf' || mime === 'application/pdf';
    if (isPdf) return { isPdf: true, mediaType: 'application/pdf' };

    if (mime.includes('png') || ext === 'png')   return { isPdf: false, mediaType: 'image/png' };
    if (mime.includes('gif') || ext === 'gif')   return { isPdf: false, mediaType: 'image/gif' };
    if (mime.includes('webp') || ext === 'webp') return { isPdf: false, mediaType: 'image/webp' };
    // fallback: JPEG
    return { isPdf: false, mediaType: 'image/jpeg' };
}

// ─── Lógica principal de extração ─────────────────────────────────────────────
async function extractDocument(
    supabase: ReturnType<typeof createClient>,
    documentId: string,
    filePath: string,
) {
    // Atualiza o banco e loga ao mesmo tempo; em caso de erro sinaliza o status.
    const log = async (msg: string, isError = false) => {
        console.log(`[${documentId}] ${msg}`);
        const patch: Record<string, string> = { extraction_error: msg.substring(0, 500) };
        if (isError) patch.extraction_status = 'error';
        try {
            await supabase.from('client_documents').update(patch).eq('id', documentId);
        } catch (dbErr) {
            console.error(`[${documentId}] Falha ao salvar log no banco:`, dbErr);
        }
    };

    try {
        // 1. Marca início
        await supabase.from('client_documents').update({
            extraction_status: 'processing',
            extraction_started_at: new Date().toISOString(),
            extraction_error: null,
        }).eq('id', documentId);

        // 2. Download do Storage
        await log('ETAPA: Baixando arquivo do Storage...');
        const { data: fileBlob, error: dlErr } = await supabase.storage
            .from('bomjur-documents')
            .download(filePath);
        if (dlErr || !fileBlob) throw new Error(`Download falhou: ${dlErr?.message}`);

        // 3. Detecta tipo e converte para base64 de forma segura
        await log('ETAPA: Convertendo para base64...');
        const { isPdf, mediaType } = resolveMediaType(fileBlob, filePath);
        const base64Data = toBase64(await fileBlob.arrayBuffer());

        // 4. Monta o bloco de conteúdo correto para a API do Claude
        //    - PDF  → type: 'document'  (suporte nativo a multi-página)
        //    - Imagem → type: 'image'
        const fileBlock = isPdf
            ? {
                type: 'document',
                source: { type: 'base64', media_type: 'application/pdf', data: base64Data },
            }
            : {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: base64Data },
            };

        // 5. Chama Claude
        await log(`ETAPA: Chamando Claude (${isPdf ? 'PDF nativo' : mediaType})...`);

        const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
        if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY não encontrada nas variáveis de ambiente.');

        const requestHeaders: Record<string, string> = {
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
        };
        // Header de beta ainda necessário para PDFs no endpoint atual
        if (isPdf) requestHeaders['anthropic-beta'] = 'pdfs-2024-09-25';

        const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: requestHeaders,
            body: JSON.stringify({
                model: 'claude-sonnet-4-6',
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
}`,
                        },
                    ],
                }],
            }),
        });

        if (!claudeRes.ok) {
            const body = await claudeRes.text();
            throw new Error(`Claude erro ${claudeRes.status}: ${body.substring(0, 300)}`);
        }

        const claudeData = await claudeRes.json();
        const aiText: string = claudeData.content[0].text;

        // 6. Extrai o JSON da resposta
        await log('ETAPA: Processando resposta da IA...');
        const match = aiText.match(/\{[\s\S]*\}/);
        if (!match) throw new Error(`JSON não encontrado na resposta: ${aiText.substring(0, 150)}`);
        const parsed = JSON.parse(match[0]);

        // 7. Salva campos extraídos
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

        // 8. Marca como concluído
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
        console.error(`[${documentId}] ERRO:`, msg);
        // Garante que o erro é sempre persistido, mesmo que o log() acima já tenha falhado
        try {
            await supabase.from('client_documents').update({
                extraction_status: 'error',
                extraction_error: msg.substring(0, 500),
            }).eq('id', documentId);
        } catch (dbErr) {
            console.error(`[${documentId}] Falha ao persistir erro no banco:`, dbErr);
        }
    }
}

// ─── Handler HTTP ──────────────────────────────────────────────────────────────
serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { documentId, filePath } = await req.json();
        if (!documentId || !filePath) {
            throw new Error('documentId e filePath são obrigatórios.');
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        );

        // Retorna 202 imediatamente e processa em background via waitUntil
        const edgeRuntime = (globalThis as any).EdgeRuntime;
        if (edgeRuntime?.waitUntil) {
            edgeRuntime.waitUntil(extractDocument(supabase, documentId, filePath));
        } else {
            extractDocument(supabase, documentId, filePath);
        }

        return new Response(
            JSON.stringify({ status: 'processing', message: 'Extração iniciada em background.' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 202 },
        );

    } catch (e) {
        return new Response(
            JSON.stringify({ error: (e as Error).message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
        );
    }
});

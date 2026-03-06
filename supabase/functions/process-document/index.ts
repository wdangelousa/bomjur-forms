// Substitua todo o código por:
// supabase/functions/process-document/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Converte ArrayBuffer para base64 byte a byte.
 * Essencial para evitar "Maximum call stack size exceeded" em PDFs grandes.
 */
function toBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Determina o tipo de mídia e se é PDF.
 */
function resolveMediaType(blob: Blob, filePath: string): { isPdf: boolean; mediaType: string } {
    const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
    const mime = blob.type ?? '';

    const isPdf = ext === 'pdf' || mime === 'application/pdf';
    if (isPdf) return { isPdf: true, mediaType: 'application/pdf' };

    if (mime.includes('png') || ext === 'png') return { isPdf: false, mediaType: 'image/png' };
    if (mime.includes('webp') || ext === 'webp') return { isPdf: false, mediaType: 'image/webp' };

    return { isPdf: false, mediaType: 'image/jpeg' };
}

/**
 * Lógica principal de extração do Ben — COM LOGGING PESADO
 */
async function extractDocument(
    supabase: ReturnType<typeof createClient>,
    documentId: string,
    filePath: string,
) {
    const logError = async (msg: string) => {
        console.error(`[Ben-Error] [${documentId}]: ${msg}`);
        await supabase.from('client_documents').update({
            extraction_status: 'failed',
            extraction_error: msg.substring(0, 500),
            updated_at: new Date().toISOString(),
        }).eq('id', documentId);
    };

    try {
        // ── ETAPA 1: Marcar como processing ──────────────────────────
        console.log(`[Ben] ETAPA 1: Marcando documento ${documentId} como 'processing'`);

        const { error: updateProcessingErr } = await supabase
            .from('client_documents')
            .update({
                extraction_status: 'processing',
                extraction_started_at: new Date().toISOString(),
                extraction_error: null,
            })
            .eq('id', documentId);

        if (updateProcessingErr) {
            console.error('[Ben] ETAPA 1 FALHOU:', updateProcessingErr);
        } else {
            console.log('[Ben] ETAPA 1 OK: Status atualizado para processing');
        }

        // ── ETAPA 2: Download do Storage ─────────────────────────────
        console.log(`[Ben] ETAPA 2: Baixando arquivo do Storage: ${filePath}`);

        const { data: fileBlob, error: dlErr } = await supabase.storage
            .from('documents')
            .download(filePath);

        if (dlErr || !fileBlob) {
            throw new Error(`Download falhou: ${dlErr?.message ?? 'fileBlob null'}`);
        }

        console.log(`[Ben] ETAPA 2 OK: Arquivo baixado. Tamanho: ${fileBlob.size} bytes. Type: ${fileBlob.type}`);

        // ── ETAPA 3: Preparação (Base64 + Media Type) ────────────────
        console.log('[Ben] ETAPA 3: Convertendo para base64...');

        const { isPdf, mediaType } = resolveMediaType(fileBlob, filePath);
        const base64Data = toBase64(await fileBlob.arrayBuffer());

        console.log(`[Ben] ETAPA 3 OK: isPdf=${isPdf}, mediaType=${mediaType}, base64Length=${base64Data.length}`);

        // ── ETAPA 4: Chamada para a Anthropic ────────────────────────
        console.log('[Ben] ETAPA 4: Preparando chamada Anthropic...');

        const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
        if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY não configurada nos Secrets do Supabase.');

        console.log(`[Ben] ETAPA 4: API Key presente (prefix: ${anthropicKey.substring(0, 8)}...)`);

        // Headers — SEM beta header para Sonnet 4.5 (PDF é nativo)
        const requestHeaders: Record<string, string> = {
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
        };

        // Montar o content block correto: "document" para PDF, "image" para imagens
        const fileContentBlock = isPdf
            ? {
                type: 'document' as const,
                source: {
                    type: 'base64' as const,
                    media_type: 'application/pdf' as const,
                    data: base64Data,
                },
            }
            : {
                type: 'image' as const,
                source: {
                    type: 'base64' as const,
                    media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                    data: base64Data,
                },
            };

        const requestBody = {
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: 2048,
            system: "Você é o Ben, um analista sênior de documentos de imigração para processos I-485. Sua missão é extrair dados com precisão total. Responda APENAS em JSON.",
            messages: [{
                role: 'user',
                content: [
                    fileContentBlock,
                    {
                        type: 'text',
                        text: "Extraia os dados deste documento e retorne um JSON com 'document_type', 'fields' (objeto com chaves e valores) e 'confidence' (0 a 1).",
                    },
                ],
            }],
        };

        console.log('[Ben] ETAPA 4: Enviando para Anthropic...', {
            model: requestBody.model,
            contentType: isPdf ? 'document (PDF)' : `image (${mediaType})`,
            base64SizeKB: Math.round(base64Data.length / 1024),
        });

        const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: requestHeaders,
            body: JSON.stringify(requestBody),
        });

        console.log(`[Ben] ETAPA 4: Anthropic respondeu com HTTP ${claudeRes.status}`);

        if (!claudeRes.ok) {
            const errorText = await claudeRes.text();
            console.error(`[Ben] ETAPA 4 ERRO: ${errorText}`);
            throw new Error(`Claude API Erro ${claudeRes.status}: ${errorText}`);
        }

        const claudeData = await claudeRes.json();
        console.log('[Ben] ETAPA 4 OK: Resposta recebida.', {
            stopReason: claudeData.stop_reason,
            inputTokens: claudeData.usage?.input_tokens,
            outputTokens: claudeData.usage?.output_tokens,
        });

        // ── ETAPA 5: Parse do JSON ───────────────────────────────────
        console.log('[Ben] ETAPA 5: Parseando JSON da resposta...');

        const aiText = claudeData.content?.[0]?.text;
        if (!aiText) {
            console.error('[Ben] ETAPA 5 ERRO: Nenhum texto na resposta. Content:', JSON.stringify(claudeData.content));
            throw new Error('Nenhum texto na resposta da IA.');
        }

        console.log(`[Ben] ETAPA 5: Texto bruto (primeiros 300 chars): ${aiText.substring(0, 300)}`);

        const match = aiText.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("JSON não encontrado na resposta da IA.");
        const parsed = JSON.parse(match[0]);

        console.log('[Ben] ETAPA 5 OK: JSON parseado.', {
            documentType: parsed.document_type,
            fieldsCount: Object.keys(parsed.fields || {}).length,
            confidence: parsed.confidence,
        });

        // ── ETAPA 6: Salvar campos extraídos ─────────────────────────
        console.log('[Ben] ETAPA 6: Salvando extracted_fields...');

        const rows = Object.entries(parsed.fields || {})
            .filter(([, v]) => v && v !== 'null')
            .map(([key, value]) => ({
                document_id: documentId,
                field_key: key,
                field_value: String(value),
                confidence: parsed.confidence || 0.9,
            }));

        console.log(`[Ben] ETAPA 6: ${rows.length} campos para inserir`);

        if (rows.length > 0) {
            const { error: insErr } = await supabase.from('extracted_fields').insert(rows);
            if (insErr) {
                console.error('[Ben] ETAPA 6 ERRO no INSERT extracted_fields:', insErr);
                throw new Error(`Erro ao salvar campos: ${insErr.message}`);
            }
            console.log('[Ben] ETAPA 6 OK: Campos salvos');
        }

        // ── ETAPA 7: UPDATE final — status 'completed' ──────────────
        console.log(`[Ben] ETAPA 7: Atualizando status para 'completed' (documentId: ${documentId})`);

        const { data: updateResult, error: updateErr } = await supabase
            .from('client_documents')
            .update({
                extraction_status: 'completed',
                document_type: parsed.document_type || 'Desconhecido',
                document_type_confidence: parsed.confidence || 0.9,
                extraction_completed_at: new Date().toISOString(),
                raw_extraction_json: JSON.stringify(parsed),
                updated_at: new Date().toISOString(),
            })
            .eq('id', documentId)
            .select('id, extraction_status');

        if (updateErr) {
            console.error('[Ben] ETAPA 7 ERRO no UPDATE:', updateErr);
            throw new Error(`UPDATE falhou: ${updateErr.message}`);
        }

        console.log('[Ben] ETAPA 7 OK: UPDATE realizado.', {
            rowsReturned: updateResult?.length ?? 0,
            result: updateResult,
        });

        if (!updateResult || updateResult.length === 0) {
            console.error('[Ben] ⚠️ AVISO GRAVE: UPDATE retornou 0 rows! O documentId pode estar errado ou RLS está bloqueando.');
        }

        console.log(`[Ben] ✅ Documento ${documentId} processado com SUCESSO!`);

    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Erro desconhecido';
        console.error(`[Ben] ❌ FALHA FATAL: ${msg}`);
        await logError(msg);
    }
}

// ── Handler Principal ────────────────────────────────────────────────────
Deno.serve(async (req) => {
    console.log(`[Ben] Request recebida: ${req.method}`);

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const body = await req.json();
        const { documentId, filePath } = body;

        console.log('[Ben] Payload recebido:', { documentId, filePath });

        if (!documentId || !filePath) {
            throw new Error(`Parâmetros ausentes. Recebido: documentId=${documentId}, filePath=${filePath}`);
        }

        // Verificar variáveis de ambiente
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');

        console.log('[Ben] Env check:', {
            hasUrl: !!supabaseUrl,
            hasServiceKey: !!serviceRoleKey,
            hasAnthropicKey: !!anthropicKey,
        });

        if (!supabaseUrl || !serviceRoleKey) {
            throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY em falta.');
        }

        const supabase = createClient(supabaseUrl, serviceRoleKey);

        // Fire-and-forget: responde 202 e processa em background
        // NOTA: EdgeRuntime.waitUntil não existe em Deno Deploy.
        // Usamos a abordagem de não aguardar a promise mas garantir que ela execute.
        const processingPromise = extractDocument(supabase, documentId, filePath);

        // Em Deno Deploy, a função termina quando a Response é enviada.
        // Para garantir que o processamento termine, NÃO usamos fire-and-forget.
        // Em vez disso, aguardamos o processamento completo ANTES de responder.
        await processingPromise;

        return new Response(
            JSON.stringify({ status: 'completed', documentId }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
        );

    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Erro desconhecido';
        console.error('[Ben] Erro no handler:', msg);
        return new Response(
            JSON.stringify({ error: msg }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
        );
    }
});

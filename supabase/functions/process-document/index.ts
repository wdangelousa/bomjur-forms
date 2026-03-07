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
 * Lógica principal de extração — COM LOGGING PESADO E FAIL-SAFE
 */
async function extractDocument(
    supabase: ReturnType<typeof createClient>,
    documentId: string,
    filePath: string,
) {
    // ── logError RESILIENTE ────────────────────────────────────────────────────
    // Primeiro atualiza o status (crítico). Depois tenta salvar a mensagem de erro
    // (a coluna extraction_error pode não existir — tratado como não-fatal).
    const logError = async (msg: string) => {
        console.error(`[Ben-Error] [${documentId}]: ${msg}`);

        // Atualização crítica: apenas o status
        const { error: statusErr } = await supabase
            .from('client_documents')
            .update({
                extraction_status: 'failed',
                updated_at: new Date().toISOString(),
            })
            .eq('id', documentId);

        if (statusErr) {
            console.error('[Ben-Error] CRÍTICO: falha ao salvar status=failed:', statusErr.message);
        } else {
            console.log('[Ben-Error] Status atualizado para failed com sucesso.');
        }

        // Tentativa não-fatal: salvar mensagem de erro (coluna opcional)
        supabase
            .from('client_documents')
            .update({ extraction_error: msg.substring(0, 500) })
            .eq('id', documentId)
            .then(({ error: e }) => {
                if (e) console.warn('[Ben-Error] Coluna extraction_error indisponível (não-fatal):', e.message);
            });
    };

    try {
        // ── ETAPA 1: Marcar como processing ──────────────────────────────────
        console.log(`[Ben] ETAPA 1: Marcando documento ${documentId} como 'processing'`);
        const { error: updProcErr } = await supabase
            .from('client_documents')
            .update({
                extraction_status: 'processing',
                extraction_started_at: new Date().toISOString(),
                extraction_error: null,
            })
            .eq('id', documentId);
        if (updProcErr) console.error('[Ben] ETAPA 1 aviso:', updProcErr.message);
        else console.log('[Ben] ETAPA 1 OK');

        // ── ETAPA 2: Download do Storage ─────────────────────────────────────
        console.log(`[Ben] ETAPA 2: Baixando arquivo: ${filePath}`);
        const { data: fileBlob, error: dlErr } = await supabase.storage
            .from('documents')
            .download(filePath);
        if (dlErr || !fileBlob) throw new Error(`Download falhou: ${dlErr?.message ?? 'fileBlob null'}`);
        console.log(`[Ben] ETAPA 2 OK: ${fileBlob.size} bytes, tipo: ${fileBlob.type}`);

        // ── ETAPA 3: Base64 + Media Type ─────────────────────────────────────
        console.log('[Ben] ETAPA 3: Convertendo para base64...');
        const { isPdf, mediaType } = resolveMediaType(fileBlob, filePath);
        const base64Data = toBase64(await fileBlob.arrayBuffer());
        console.log(`[Ben] ETAPA 3 OK: isPdf=${isPdf}, mediaType=${mediaType}, base64Length=${base64Data.length}`);

        // ── ETAPA 4: Chamada Anthropic ────────────────────────────────────────
        const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
        if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY não configurada nos Secrets do Supabase.');
        console.log(`[Ben] ETAPA 4: API Key presente (${anthropicKey.substring(0, 8)}...)`);

        // Headers: adiciona beta header para suporte a PDF nativo
        const requestHeaders: Record<string, string> = {
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
        };
        if (isPdf) {
            requestHeaders['anthropic-beta'] = 'pdfs-2024-09-25';
            console.log('[Ben] ETAPA 4: Header PDF beta adicionado');
        }

        // Content block: "document" para PDF, "image" para imagens
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
            // CORREÇÃO: modelo atualizado para a versão estável atual
            model: 'claude-sonnet-4-6',
            max_tokens: 2048,
            system: "Você é o Ben, analista sênior de documentos de imigração (processos I-140 / I-485). Extraia dados com precisão máxima. Responda APENAS em JSON válido, sem texto adicional.",
            messages: [{
                role: 'user',
                content: [
                    fileContentBlock,
                    {
                        type: 'text',
                        text: "Extraia todos os dados visíveis neste documento. Retorne um JSON com:\n- document_type (string, ex: 'passport', 'i94', 'birth_certificate')\n- fields (objeto com chave → valor de cada campo encontrado)\n- confidence (número de 0 a 1 indicando sua certeza geral)\n\nRetorne APENAS o JSON, sem markdown ou explicações.",
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

        console.log(`[Ben] ETAPA 4: Anthropic respondeu HTTP ${claudeRes.status}`);

        if (!claudeRes.ok) {
            const errorText = await claudeRes.text();
            console.error(`[Ben] ETAPA 4 ERRO Anthropic: ${errorText}`);
            throw new Error(`Claude API ${claudeRes.status}: ${errorText.substring(0, 300)}`);
        }

        const claudeData = await claudeRes.json();
        console.log('[Ben] ETAPA 4 OK:', {
            stopReason: claudeData.stop_reason,
            inputTokens: claudeData.usage?.input_tokens,
            outputTokens: claudeData.usage?.output_tokens,
        });

        // ── ETAPA 5: Parse do JSON ────────────────────────────────────────────
        const aiText = claudeData.content?.[0]?.text;
        if (!aiText) throw new Error('Nenhum texto na resposta da IA.');
        console.log(`[Ben] ETAPA 5: Texto bruto (300 chars): ${aiText.substring(0, 300)}`);

        const match = aiText.match(/\{[\s\S]*\}/);
        if (!match) throw new Error('JSON não encontrado na resposta da IA.');
        const parsed = JSON.parse(match[0]);
        console.log('[Ben] ETAPA 5 OK:', {
            documentType: parsed.document_type,
            fieldsCount: Object.keys(parsed.fields || {}).length,
            confidence: parsed.confidence,
        });

        // ── ETAPA 6: Salvar extracted_fields ─────────────────────────────────
        const rows = Object.entries(parsed.fields || {})
            .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '' && String(v) !== 'null')
            .map(([key, value]) => ({
                document_id: documentId,
                field_key: key,
                field_value: String(value),
                confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.85,
            }));

        console.log(`[Ben] ETAPA 6: Inserindo ${rows.length} campos...`);
        if (rows.length > 0) {
            const { error: insErr } = await supabase.from('extracted_fields').insert(rows);
            if (insErr) throw new Error(`Erro ao salvar campos: ${insErr.message}`);
        }
        console.log('[Ben] ETAPA 6 OK');

        // ── ETAPA 7: UPDATE crítico — apenas extraction_status ───────────────
        // ATENÇÃO: NÃO sobrescrevemos document_type para preservar a categoria
        // original (ex: 'passport') que alimenta o agrupamento do dashboard.
        console.log(`[Ben] ETAPA 7: Atualizando status para 'completed'...`);

        const { data: updateResult, error: updateErr } = await supabase
            .from('client_documents')
            .update({ extraction_status: 'completed' })
            .eq('id', documentId)
            .select('id, extraction_status');

        if (updateErr) throw new Error(`UPDATE status falhou: ${updateErr.message}`);

        if (!updateResult || updateResult.length === 0) {
            console.error('[Ben] ⚠️ UPDATE retornou 0 linhas! Possível problema de RLS ou documentId errado.');
        } else {
            console.log('[Ben] ETAPA 7 OK:', updateResult);
        }

        // ── ETAPA 7b: Colunas opcionais (não-fatal) ───────────────────────────
        // document_type_confidence, raw_extraction_json, extraction_completed_at
        // podem não existir — ignoramos erros aqui.
        supabase
            .from('client_documents')
            .update({
                document_type_detected: parsed.document_type || null,
                document_type_confidence: typeof parsed.confidence === 'number' ? parsed.confidence : null,
                extraction_completed_at: new Date().toISOString(),
                raw_extraction_json: JSON.stringify(parsed),
                updated_at: new Date().toISOString(),
            })
            .eq('id', documentId)
            .then(({ error: optErr }) => {
                if (optErr) console.warn('[Ben] ETAPA 7b: Colunas opcionais não disponíveis (não-fatal):', optErr.message);
                else console.log('[Ben] ETAPA 7b: Metadados opcionais salvos.');
            });

        console.log(`[Ben] ✅ Documento ${documentId} processado com SUCESSO!`);

    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Erro desconhecido';
        console.error(`[Ben] ❌ FALHA FATAL: ${msg}`);
        await logError(msg);
    }
}

// ── Handler Principal ─────────────────────────────────────────────────────────
Deno.serve(async (req) => {
    console.log(`[Ben] Request: ${req.method} ${new URL(req.url).pathname}`);

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

        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        console.log('[Ben] Env check:', { hasUrl: !!supabaseUrl, hasServiceKey: !!serviceRoleKey });

        if (!supabaseUrl || !serviceRoleKey) {
            throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes nos Secrets.');
        }

        const supabase = createClient(supabaseUrl, serviceRoleKey);

        // Aguarda extração completa ANTES de responder (Deno Deploy encerra no Response)
        await extractDocument(supabase, documentId, filePath);

        return new Response(
            JSON.stringify({ status: 'completed', documentId }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
        );

    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Erro desconhecido';
        console.error('[Ben] Erro no handler principal:', msg);
        return new Response(
            JSON.stringify({ error: msg }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
        );
    }
});

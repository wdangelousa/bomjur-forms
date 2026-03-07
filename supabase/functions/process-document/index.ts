// supabase/functions/process-document/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Converte ArrayBuffer para base64 byte a byte.
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
 * Lógica principal de extração — BULLETPROOF
 */
async function extractDocument(
    supabase: ReturnType<typeof createClient>,
    documentId: string,
    filePath: string,
) {
    const logError = async (msg: string) => {
        console.error(`[Ben-Error] [${documentId}]: ${msg}`);

        const baseUpdate = {
            extraction_status: 'failed',
            updated_at: new Date().toISOString(),
        };

        try {
            // Tentativa de update unificado (status + erro) com await
            const { error: err } = await supabase
                .from('client_documents')
                .update({
                    ...baseUpdate,
                    extraction_error: msg.substring(0, 500)
                })
                .eq('id', documentId);

            if (err && err.code === '42703') {
                console.warn('[Ben-Error] Coluna extraction_error não disponível, salvando apenas status.');
                await supabase
                    .from('client_documents')
                    .update(baseUpdate)
                    .eq('id', documentId);
            }
        } catch (updateEx) {
            console.error('[Ben-Error] Falha crítica ao atualizar status de erro:', updateEx);
        }
    };

    try {
        // ── ETAPA 1: Marcar como processing ──────────────────────────────────
        console.log(`[Ben] ETAPA 1: Iniciando processamento do documento ${documentId}`);
        const { error: updProcErr } = await supabase
            .from('client_documents')
            .update({
                extraction_status: 'processing',
                extraction_started_at: new Date().toISOString(),
            })
            .eq('id', documentId);

        if (updProcErr && updProcErr.code !== '42703') {
            console.error('[Ben] ETAPA 1 aviso:', updProcErr.message);
        }

        // ── ETAPA 2: Download do Storage ─────────────────────────────────────
        console.log(`[Ben] ETAPA 2: Baixando arquivo: ${filePath}`);
        const { data: fileBlob, error: dlErr } = await supabase.storage
            .from('documents')
            .download(filePath);
        if (dlErr || !fileBlob) throw new Error(`Download falhou: ${dlErr?.message ?? 'fileBlob null'}`);

        // ── ETAPA 3: Base64 + Media Type ─────────────────────────────────────
        console.log('[Ben] ETAPA 3: Convertendo para base64...');
        const { isPdf, mediaType } = resolveMediaType(fileBlob, filePath);
        const base64Data = toBase64(await fileBlob.arrayBuffer());

        // ── ETAPA 4: Chamada Anthropic ────────────────────────────────────────
        const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
        if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY não configurada.');

        const requestHeaders: Record<string, string> = {
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
        };
        if (isPdf) {
            requestHeaders['anthropic-beta'] = 'pdfs-2024-09-25';
        }

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
            model: 'claude-3-5-sonnet-20241022',
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

        const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: requestHeaders,
            body: JSON.stringify(requestBody),
        });

        if (!claudeRes.ok) {
            const errorText = await claudeRes.text();
            throw new Error(`Claude API ${claudeRes.status}: ${errorText.substring(0, 300)}`);
        }

        const claudeData = await claudeRes.json();
        const aiText = claudeData.content?.[0]?.text;
        if (!aiText) throw new Error('Nenhum texto na resposta da IA.');

        const match = aiText.match(/\{[\s\S]*\}/);
        if (!match) throw new Error('JSON não encontrado na resposta da IA.');
        const parsed = JSON.parse(match[0]);

        // ── ETAPA 6: Salvar extracted_fields ─────────────────────────────────
        const rows = Object.entries(parsed.fields || {})
            .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '' && String(v) !== 'null')
            .map(([key, value]) => ({
                document_id: documentId,
                field_key: key,
                field_value: String(value),
                confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.85,
            }));

        if (rows.length > 0) {
            const { error: insErr } = await supabase.from('extracted_fields').insert(rows);
            if (insErr) console.error('[Ben] Erro ao salvar campos (não-fatal):', insErr.message);
        }

        // ── ETAPA 7: UPDATE Unificado (Bulletproof) ───────────────────────────
        console.log(`[Ben] ETAPA 7: Salvando extração e metadados...`);

        // Fail-safe: Busca metadados atuais para merge
        const { data: currentDoc } = await supabase
            .from('client_documents')
            .select('metadata')
            .eq('id', documentId)
            .single();

        const mergedMetadata = {
            ...(currentDoc?.metadata || {}),
            extracted_data: parsed
        };

        const updatePayload: any = {
            extraction_status: 'completed',
            document_type_detected: parsed.document_type || null,
            document_type_confidence: typeof parsed.confidence === 'number' ? parsed.confidence : null,
            extraction_completed_at: new Date().toISOString(),
            raw_extraction_json: parsed,
            metadata: mergedMetadata,
            updated_at: new Date().toISOString(),
        };

        const { error: updateErr } = await supabase
            .from('client_documents')
            .update(updatePayload)
            .eq('id', documentId);

        if (updateErr) {
            console.error('[Ben] Erro no UPDATE final:', updateErr.message);
            // Se falhou por falta de coluna (42703), tentamos apenas as colunas garantidas
            if (updateErr.code === '42703' || updateErr.message.includes('column')) {
                console.warn('[Ben] Colunas opcionais ausentes. Executando fallback para metadata.');
                const { error: fallbackErr } = await supabase
                    .from('client_documents')
                    .update({
                        extraction_status: 'completed',
                        metadata: mergedMetadata,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', documentId);

                if (fallbackErr) throw new Error(`Fallback falhou: ${fallbackErr.message}`);
                else console.log('[Ben] Fallback para metadata concluído.');
            } else {
                throw new Error(`UPDATE crítico falhou: ${updateErr.message}`);
            }
        }

        console.log(`[Ben] ✅ Documento ${documentId} processado com SUCESSO!`);

    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Erro desconhecido';
        console.error(`[Ben] ❌ FALHA FATAL: ${msg}`);
        await logError(msg);
    }
}

// ── Handler Principal ─────────────────────────────────────────────────────────
Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { documentId, filePath } = await req.json();

        if (!documentId || !filePath) {
            throw new Error('Parâmetros documentId ou filePath ausentes.');
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!supabaseUrl || !serviceRoleKey) {
            throw new Error('Configuração do Supabase ausente.');
        }

        const supabase = createClient(supabaseUrl, serviceRoleKey);

        // Aguarda a extração completa ANTES de responder. 
        // Deno Deploy pode encerrar o processo assim que a Response é retornada.
        await extractDocument(supabase, documentId, filePath);

        return new Response(
            JSON.stringify({ status: 'success', documentId }),
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

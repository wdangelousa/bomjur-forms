import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
 * Lógica principal de extração do Ben
 */
async function extractDocument(
    supabase: any,
    documentId: string,
    filePath: string,
) {
    const logError = async (msg: string) => {
        console.error(`[Ben-Error] [${documentId}]: ${msg}`);
        await supabase.from('client_documents').update({
            extraction_status: 'error',
            extraction_error: msg.substring(0, 500)
        }).eq('id', documentId);
    };

    try {
        // 1. Início do processamento
        await supabase.from('client_documents').update({
            extraction_status: 'processing',
            extraction_started_at: new Date().toISOString(),
            extraction_error: null,
        }).eq('id', documentId);

        // 2. Download do Storage (Bucket: documents)
        const { data: fileBlob, error: dlErr } = await supabase.storage
            .from('documents')
            .download(filePath);

        if (dlErr || !fileBlob) throw new Error(`Download falhou: ${dlErr?.message}`);

        // 3. Preparação do arquivo
        const { isPdf, mediaType } = resolveMediaType(fileBlob, filePath);
        const base64Data = toBase64(await fileBlob.arrayBuffer());

        // 4. Chamada para a Anthropic
        const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
        if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY não configurada nos Secrets do Supabase.');

        const requestHeaders: Record<string, string> = {
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
        };

        // Header necessário para suporte a PDF
        if (isPdf) requestHeaders['anthropic-beta'] = 'pdfs-2024-09-25';

        const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: requestHeaders,
            body: JSON.stringify({
                model: 'claude-3-5-sonnet-20240620', // ID estável para evitar Erro 404
                max_tokens: 2048,
                system: "Você é o Ben, um analista sênior de documentos de imigração para processos I-485. Sua missão é extrair dados com precisão total. Responda APENAS em JSON.",
                messages: [{
                    role: 'user',
                    content: [
                        {
                            type: isPdf ? 'document' : 'image',
                            source: {
                                type: 'base64',
                                media_type: isPdf ? 'application/pdf' : mediaType,
                                data: base64Data
                            },
                        },
                        {
                            type: 'text',
                            text: "Extraia os dados deste documento e retorne um JSON com 'document_type', 'fields' (objeto com chaves e valores) e 'confidence' (0 a 1).",
                        },
                    ],
                }],
            }),
        });

        if (!claudeRes.ok) {
            const errorText = await claudeRes.text();
            throw new Error(`Claude API Erro ${claudeRes.status}: ${errorText}`);
        }

        const claudeData = await claudeRes.json();
        const aiText = claudeData.content[0].text;

        // 5. Parse do JSON
        const match = aiText.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("JSON não encontrado na resposta da IA.");
        const parsed = JSON.parse(match[0]);

        // 6. Salvar campos extraídos
        const rows = Object.entries(parsed.fields || {})
            .filter(([, v]) => v && v !== 'null')
            .map(([key, value]) => ({
                document_id: documentId,
                field_key: key,
                field_value: String(value),
                confidence: parsed.confidence || 0.9,
            }));

        if (rows.length > 0) {
            const { error: insErr } = await supabase.from('extracted_fields').insert(rows);
            if (insErr) throw new Error(`Erro ao salvar campos: ${insErr.message}`);
        }

        // 7. Finalização com sucesso
        await supabase.from('client_documents').update({
            extraction_status: 'extracted',
            document_type: parsed.document_type || 'Desconhecido',
            document_type_confidence: parsed.confidence || 0.9,
            extraction_completed_at: new Date().toISOString(),
            raw_extraction_json: JSON.stringify(parsed),
        }).eq('id', documentId);

        console.log(`[Ben] ✅ Documento ${documentId} processado com sucesso.`);

    } catch (e: any) {
        await logError(e.message);
    }
}

// Handler Principal
serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { documentId, filePath } = await req.json();
        if (!documentId || !filePath) throw new Error('Parâmetros ausentes.');

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        );

        // Executa em background para não travar a resposta HTTP
        const edgeRuntime = (globalThis as any).EdgeRuntime;
        if (edgeRuntime?.waitUntil) {
            edgeRuntime.waitUntil(extractDocument(supabase, documentId, filePath));
        } else {
            extractDocument(supabase, documentId, filePath);
        }

        return new Response(
            JSON.stringify({ status: 'processing', message: 'O Ben iniciou a leitura.' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 202 },
        );

    } catch (e: any) {
        return new Response(
            JSON.stringify({ error: e.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
        );
    }
});
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function toBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

async function extractDocument(supabase: any, documentId: string, filePath: string) {
    try {
        await supabase.from('client_documents').update({
            extraction_status: 'processing',
            extraction_started_at: new Date().toISOString(),
            extraction_error: null,
        }).eq('id', documentId);

        const { data: fileBlob, error: dlErr } = await supabase.storage.from('bomjur-documents').download(filePath);
        if (dlErr || !fileBlob) throw new Error(`Download falhou: ${dlErr?.message}`);

        const base64Data = toBase64(await fileBlob.arrayBuffer());
        const isPdf = filePath.toLowerCase().endsWith('.pdf');

        const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
        const headers: Record<string, string> = {
            'x-api-key': anthropicKey!,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
        };
        if (isPdf) headers['anthropic-beta'] = 'pdfs-2024-09-25';

        // O Ben usa o modelo estável claude-3-5-sonnet-20240620 para evitar erros 404
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: 'claude-3-5-sonnet-latest',
                max_tokens: 2048,
                system: "Você é o Ben, um analista sênior de documentos de imigração. Sua missão é extrair dados com precisão cirúrgica. Responda APENAS em JSON.",
                messages: [{
                    role: 'user',
                    content: [
                        isPdf ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } }
                            : { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64Data } },
                        { type: 'text', text: "Extraia o document_type e todos os campos visíveis. Retorne um JSON com 'document_type', 'fields' e 'confidence'." }
                    ],
                }],
            }),
        });

        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`Erro Claude ${response.status}: ${errBody}`);
        }

        const data = await response.json();
        const aiText = data.content[0].text;
        const match = aiText.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("JSON não encontrado na resposta.");
        const parsed = JSON.parse(match[0]);

        const rows = Object.entries(parsed.fields || {})
            .filter(([, v]) => v && v !== 'null')
            .map(([key, value]) => ({
                document_id: documentId,
                field_key: key,
                field_value: String(value),
                confidence: parsed.confidence || 0.9,
            }));

        if (rows.length > 0) {
            await supabase.from('extracted_fields').insert(rows);
        }

        await supabase.from('client_documents').update({
            extraction_status: 'extracted',
            document_type: parsed.document_type || 'Documento Processado',
            extraction_completed_at: new Date().toISOString(),
            raw_extraction_json: JSON.stringify(parsed),
        }).eq('id', documentId);

    } catch (e: any) {
        console.error('[Ben Error]:', e.message);
        await supabase.from('client_documents').update({
            extraction_status: 'error',
            extraction_error: e.message.substring(0, 500),
        }).eq('id', documentId);
    }
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    const { documentId, filePath } = await req.json();
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Inicia extração em background
    const edgeRuntime = (globalThis as any).EdgeRuntime;
    if (edgeRuntime?.waitUntil) {
        edgeRuntime.waitUntil(extractDocument(supabase, documentId, filePath));
    } else {
        extractDocument(supabase, documentId, filePath);
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 202 });
});
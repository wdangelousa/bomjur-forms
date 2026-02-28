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

        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: req.headers.get('Authorization')! } }
        });

        const { data: fileData, error: downloadError } = await supabase
            .storage
            .from('bomjur-documents')
            .download(filePath);

        if (downloadError) throw downloadError;

        const arrayBuffer = await fileData.arrayBuffer();
        const base64Image = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

        const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');

        const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': anthropicKey!,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 1024,
                messages: [{
                    role: 'user',
                    content: [
                        {
                            type: 'image',
                            source: { type: 'base64', media_type: fileData.type, data: base64Image }
                        },
                        {
                            type: 'text',
                            text: 'Extraia os dados deste documento de imigração. Retorne APENAS o objeto JSON puro, sem explicações, sem markdown, sem blocos de código. Exemplo de saída: {"nome": "JOAO", "passaporte": "123"}'
                        }
                    ]
                }]
            })
        });

        const anthropicData = await anthropicResponse.json();
        let aiText = anthropicData.content[0].text.trim();

        // Limpeza extra para garantir que só o JSON sobreviva
        if (aiText.includes('{')) {
            aiText = aiText.substring(aiText.indexOf('{'), aiText.lastIndexOf('}') + 1);
        }

        const { error: insertError } = await supabase
            .from('extracted_fields')
            .insert({
                document_id: documentId,
                field_key: 'extracao_bruta_json',
                extracted_value: aiText,
                confidence: 0.95,
                maps_to: 'dados_gerais'
            });

        if (insertError) throw insertError;

        await supabase.from('client_documents')
            .update({ extraction_status: 'extracted' })
            .eq('id', documentId);

        return new Response(
            JSON.stringify({ status: 'success' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
    }
});
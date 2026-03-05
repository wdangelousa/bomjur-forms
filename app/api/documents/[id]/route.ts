import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data: doc, error: docErr } = await supabase
        .from('client_documents')
        .select('id,file_name,file_path,file_url,mime_type,document_type,document_type_confidence,extraction_status,client_id')
        .eq('id', id)
        .single();

    if (docErr || !doc) {
        return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 });
    }

    const { data: signedData } = await supabase.storage
        .from('documents')
        .createSignedUrl(doc.file_path, 3600);

    const { data: fields } = await supabase
        .from('extracted_fields')
        .select('id,field_key,field_value,confidence,review_status,corrected_value,maps_to_i140_field,maps_to_i485_field,maps_to_i485_mission')
        .eq('document_id', id)
        .order('confidence', { ascending: false });

    return NextResponse.json({
        doc,
        previewUrl: signedData?.signedUrl ?? null,
        fields: fields ?? [],
    });
}

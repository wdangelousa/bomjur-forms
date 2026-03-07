import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const CATEGORY_TO_DOC_TYPE_ENUM: Record<string, string> = {
    passport: 'passport',
    i94: 'i94',
    birth_certificate: 'birth_certificate',
    passport_photos: 'photo_2x2',
}

function makeClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
}

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    const supabase = makeClient();

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

// ─── POST /api/documents/[id]/confirm ─────────────────────────────────────────
// Executa toda a mutação de confirmação server-side (service role key, bypassa RLS)
interface ConfirmField {
    id: string
    editedValue: string
    field_value: string | null
    maps_to_i140_field: string | null
    maps_to_i485_field: string | null
    maps_to_i485_mission: number | null
    confidence: number
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const supabase = makeClient()

    const { fields } = await req.json() as { fields: ConfirmField[] }

    // 1. Busca o documento para obter client_id/uploaded_by e document_type
    const { data: doc } = await supabase
        .from('client_documents')
        .select('id,document_type,client_id,uploaded_by')
        .eq('id', id)
        .single()

    if (!doc) return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 })

    const clientId: string | null = doc.client_id ?? doc.uploaded_by ?? null

    // 2. Salva correções nos campos extraídos
    await Promise.all(fields.map(f =>
        supabase.from('extracted_fields').update({
            review_status: 'confirmed',
            corrected_value: f.editedValue !== f.field_value ? f.editedValue : null,
        }).eq('id', f.id)
    ))

    // 3. Marca client_document como concluído
    await supabase
        .from('client_documents')
        .update({ extraction_status: 'completed' })
        .eq('id', id)

    // 4. Atualiza case_documents → 'approved' (alimenta o dashboard)
    if (clientId) {
        const { data: caseData } = await supabase
            .from('cases')
            .select('id')
            .eq('client_id', clientId)
            .neq('status', 'archived')
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (caseData) {
            const docTypeEnum = CATEGORY_TO_DOC_TYPE_ENUM[doc.document_type ?? ''] ?? doc.document_type
            await supabase
                .from('case_documents')
                .update({ status: 'in_review' }) // Não aprova a categoria automaticamente
                .eq('case_id', caseData.id)
                .eq('document_type', docTypeEnum)
        }
    }

    // 5. Propaga para i140_answers (se mapeado)
    const i140Fields = fields.filter(f => f.maps_to_i140_field)
    if (i140Fields.length > 0 && clientId) {
        const { data: petition } = await supabase
            .from('i140_petitions')
            .select('id')
            .eq('client_id', clientId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (petition) {
            await supabase.from('i140_answers').upsert(
                i140Fields.map(f => ({
                    petition_id: petition.id,
                    section: 'document_extraction',
                    field_key: f.maps_to_i140_field!,
                    field_value: f.editedValue,
                    source: 'ai_extraction',
                    source_document_id: id,
                    source_confidence: f.confidence,
                    was_manually_confirmed: true,
                })),
                { onConflict: 'petition_id,field_key' }
            )
        }
    }

    // 6. Propaga para application_answers (se mapeado)
    const i485Fields = fields.filter(f => f.maps_to_i485_field)
    if (i485Fields.length > 0 && clientId) {
        const { data: application } = await supabase
            .from('i485_applications')
            .select('id')
            .eq('client_id', clientId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (application) {
            await supabase.from('application_answers').upsert(
                i485Fields.map(f => ({
                    application_id: application.id,
                    mission_number: f.maps_to_i485_mission ?? 1,
                    field_key: f.maps_to_i485_field!,
                    field_value: f.editedValue,
                    source: 'ai_extraction',
                    source_document_id: id,
                    source_confidence: f.confidence,
                    client_confirmed: true,
                    client_confirmed_at: new Date().toISOString(),
                })),
                { onConflict: 'application_id,field_key' }
            )
        }
    }

    return NextResponse.json({ ok: true })
}

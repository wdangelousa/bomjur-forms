import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
    arrayBufferToBase64,
    resolveMediaType,
    buildFileBlock,
    callClaude,
    extractJson,
} from '@/src/lib/ai-utils'

export const maxDuration = 60

const I140_EXTRACTION_PROMPT = `Analise este documento I-140 ou comprovante de recibo (Notice of Action) e extraia os dados do beneficiário. Retorne APENAS JSON no formato abaixo. Se um campo não for encontrado, coloque null.

{
  "beneficiary_name": "nome completo do beneficiário",
  "priority_date": "data no formato YYYY-MM-DD",
  "receipt_number": "número de recibo USCIS (ex: WAC2190012345)",
  "category": "categoria EB exata (ex: EB-1A, EB-1B, EB-1C, EB-2 NIW, EB-2, EB-3)",
  "date_of_birth": "data no formato YYYY-MM-DD",
  "country_of_birth": "país de nascimento em inglês",
  "alien_number": "número A (somente os dígitos, ex: 123456789)",
  "employer_name": "nome do peticionário/empregador",
  "confidence": 0.90
}`

export async function POST(req: NextRequest) {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const applicationId = formData.get('applicationId') as string | null
    const clientId = formData.get('clientId') as string | null

    if (!file || !applicationId || !clientId) {
        return NextResponse.json(
            { error: 'Os campos file, applicationId e clientId são obrigatórios.' },
            { status: 400 }
        )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    if (!serviceRoleKey) {
        return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada.' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // 1. Verificar que a aplicação pertence ao cliente
    const { data: app, error: appErr } = await supabase
        .from('i485_applications')
        .select('id, client_id, tenant_id')
        .eq('id', applicationId)
        .eq('client_id', clientId)
        .single()

    if (appErr || !app) {
        return NextResponse.json({ error: 'Aplicação não encontrada ou acesso negado.' }, { status: 404 })
    }

    // 2. Fazer upload do arquivo para o Storage
    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = file.name.split('.').pop() || 'pdf'
    const filePath = `${clientId}/i485-i140/${Date.now()}.${ext}`

    const { error: uploadErr } = await supabase.storage
        .from('bomjur-documents')
        .upload(filePath, buffer, { contentType: file.type, upsert: true })

    if (uploadErr) {
        return NextResponse.json({ error: 'Erro ao fazer upload: ' + uploadErr.message }, { status: 500 })
    }

    // 3. Extrair dados com Claude Vision (não-fatal: continua mesmo se falhar)
    let extracted: Record<string, string | null> = {}
    try {
        const { isPdf, mediaType } = resolveMediaType(file.name, file.type)
        const base64 = arrayBufferToBase64(buffer.buffer as ArrayBuffer)
        const fileBlock = buildFileBlock(isPdf, mediaType, base64)
        const rawResponse = await callClaude(I140_EXTRACTION_PROMPT, fileBlock, isPdf, 1024)
        extracted = extractJson<Record<string, string | null>>(rawResponse)
    } catch (aiErr: any) {
        console.error('[upload-i140] Extração IA falhou (non-fatal):', aiErr.message)
    }

    // 4. Criar registro em i140_petitions
    const { data: petition, error: petErr } = await supabase
        .from('i140_petitions')
        .insert([{
            client_id: clientId,
            tenant_id: app.tenant_id,
            source: 'client_upload',
            file_path: filePath,
            original_filename: file.name,
            beneficiary_name: extracted.beneficiary_name ?? null,
            priority_date: extracted.priority_date ?? null,
            category: extracted.category ?? null,
            status: 'active',
        }])
        .select('id')
        .single()

    if (petErr || !petition) {
        return NextResponse.json(
            { error: 'Erro ao criar registro de petição: ' + petErr?.message },
            { status: 500 }
        )
    }

    // 5. Salvar campos extraídos em extracted_fields
    const fieldsToSave = [
        { field_id: 'receipt_number', extracted_value: extracted.receipt_number },
        { field_id: 'date_of_birth', extracted_value: extracted.date_of_birth },
        { field_id: 'country_of_birth', extracted_value: extracted.country_of_birth },
        { field_id: 'alien_number', extracted_value: extracted.alien_number },
        { field_id: 'employer_name', extracted_value: extracted.employer_name },
    ].filter(f => f.extracted_value)

    if (fieldsToSave.length > 0) {
        await supabase.from('extracted_fields').insert(
            fieldsToSave.map(f => ({
                i140_petition_id: petition.id,
                client_id: clientId,
                field_id: f.field_id,
                extracted_value: f.extracted_value,
            }))
        )
    }

    // 6. Vincular a petição à aplicação I-485
    await supabase
        .from('i485_applications')
        .update({ i140_petition_id: petition.id })
        .eq('id', applicationId)

    return NextResponse.json({
        success: true,
        petitionId: petition.id,
        extracted: {
            beneficiary_name: extracted.beneficiary_name ?? null,
            priority_date: extracted.priority_date ?? null,
            category: extracted.category ?? null,
        },
    })
}

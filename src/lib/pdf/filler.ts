import { PDFDocument } from 'pdf-lib'
import { createAdminClient } from '@/lib/supabase/server'
import path from 'path'
import fs from 'fs'

/**
 * Mapeamento genérico de campos do Supabase para o PDF da USCIS.
 * NOTA: Os nomes dos campos no PDF real podem variar (ex: "form1[0].#subform[0].Name[0]").
 * Esta função tenta encontrar o campo por aproximação ou nome exato.
 */
const FIELD_MAP: Record<string, string[]> = {
    // Personal Data
    'last_name': ['Line1a_FamilyName', 'Family Name', 'Last Name'],
    'first_name': ['Line1b_GivenName', 'Given Name', 'First Name'],
    'middle_name': ['Line1c_MiddleName', 'Middle Name'],
    'dob': ['Date of Birth', 'DOB', 'Line 13. Date of Birth'],
    'ssn': ['SSN', 'Social Security Number', 'Line 14. SSN'],
    'gender': ['Gender', 'Sex'],

    // Address Data
    'street': ['Street Number and Name', 'Address'],
    'apt': ['Apt', 'Ste', 'Flr'],
    'city': ['City or Town'],
    'state': ['State'],
    'zip': ['Zip Code', 'Zip'],
}

export async function fillUscisForm(caseId: string, formType: 'I-485' | 'I-140') {
    const supabase = createAdminClient()

    // 1. Buscar dados do caso
    const { data: caseData, error: caseError } = await supabase
        .from('cases')
        .select('*')
        .eq('id', caseId)
        .single()

    if (caseError || !caseData) throw new Error('Caso não encontrado')

    // 2. Carregar o PDF Original
    const fileName = formType.toLowerCase() + '.pdf'
    const filePath = path.join(process.cwd(), fileName)

    if (!fs.existsSync(filePath)) {
        throw new Error(`Arquivo base ${fileName} não encontrado na raiz do projeto.`)
    }

    const pdfBytes = fs.readFileSync(filePath)
    const pdfDoc = await PDFDocument.load(pdfBytes)
    const form = pdfDoc.getForm()

    // 3. Mesclar dados (Personal + Address)
    const allData = {
        ...(caseData.personal_data || {}),
        ...(caseData.address_data || {})
    }

    // 4. Preencher formulário
    const fields = form.getFields()

    // Log para depuração (opcional)
    // fields.forEach(f => console.log('PDF Field:', f.getName()))

    for (const [dataKey, value] of Object.entries(allData)) {
        const possiblePdfNames = FIELD_MAP[dataKey] || [dataKey]

        for (const pdfName of possiblePdfNames) {
            try {
                const field = form.getTextField(pdfName)
                if (field) {
                    field.setText(String(value))
                    break // Encontrou e preencheu
                }
            } catch (e) {
                // Tenta próximo nome possível se o campo não existir com esse nome exato
            }
        }
    }

    // 5. Salvar PDF Gerado
    const filledPdfBytes = await pdfDoc.save()
    const finalFileName = `generated-${formType}-${caseId}-${Date.now()}.pdf`
    const storagePath = `generated-forms/${finalFileName}`

    // 6. Upload para Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('documents')
        .upload(storagePath, filledPdfBytes, {
            contentType: 'application/pdf',
            upsert: true
        })

    if (uploadError) {
        console.error('Erro no upload do PDF:', uploadError)
        throw uploadError
    }

    // 7. Retornar URL assinada para download
    const { data: urlData, error: urlError } = await supabase
        .storage
        .from('documents')
        .createSignedUrl(storagePath, 3600) // 1 hora de validade

    if (urlError) throw urlError

    return {
        url: urlData.signedUrl,
        path: storagePath
    }
}

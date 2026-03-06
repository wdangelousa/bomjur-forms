import { PDFDocument } from 'pdf-lib'
import { createAdminClient } from '@/lib/supabase/server'
import path from 'path'
import fs from 'fs'

/**
 * Achata objetos aninhados para chaves com ponto (ex: { applicant: { firstName: 'John' } } vira { 'applicant.firstName': 'John' })
 */
function flattenObject(ob: any, prefix = ''): Record<string, any> {
    const result: Record<string, any> = {}
    if (!ob) return result
    for (const i in ob) {
        if (Object.prototype.hasOwnProperty.call(ob, i)) {
            const key = prefix ? `${prefix}.${i}` : i
            if (typeof ob[i] === 'object' && ob[i] !== null && !Array.isArray(ob[i])) {
                Object.assign(result, flattenObject(ob[i], key))
            } else {
                result[key] = ob[i]
            }
        }
    }
    return result
}

/**
 * Mapeamento robusto entre as chaves achatadas do JSON extraído e os nomes exatos do PDF (AcroForm/XFA).
 * Baseado na extração real dos arquivos i-485.pdf e i-140.pdf da USCIS.
 */
const FIELD_MAP: Record<string, string[]> = {
    // === Applicant Personal Data ===
    'applicant.firstName': ['Pt1Line1_GivenName[0]', 'Pt1Line2_GivenName[0]', 'Pt5Line1_GivenName[0]', 'Pt5Line2_GivenName[0]'],
    'applicant.middleName': ['Pt1Line1_MiddleName[0]', 'Pt1Line2_MiddleName[0]', 'Pt5Line1_MiddleName[0]', 'Pt5Line2_MiddleName[0]'],
    'applicant.lastName': ['Pt1Line1_FamilyName[0]', 'Pt1Line2_FamilyName[0]', 'Pt5Line1_FamilyName[0]', 'Pt5Line2_FamilyName[0]'],
    'applicant.dateOfBirth': ['Pt1Line3_DOB[0]', 'Pt1Line2_DOB[0]', 'Pt5Line3_DateofBirth[0]'],
    'applicant.cityOfBirth': ['Pt1Line7_CityTownOfBirth[0]', 'Pt5Line5_CityTownOfBirth[0]', 'Pt6Line10_CityTownOfBirth[0]', 'Pt6Line18_CityTownOfBirth[0]'],
    'applicant.countryOfBirth': ['Pt1Line7_CountryOfBirth[0]'],
    'applicant.sex': ['Pt1Line6_CB_Sex[0]', 'Pt1Line6_CB_Sex[1]'], // 0 = Male, 1 = Female em alguns PDFs
    'applicant.nationality': ['Pt1Line8_CountryofCitizenshipNationality[0]'],

    // === Identifiers ===
    'alienNumber': ['AlienNumber[0]', 'AlienNumber[1]', 'Pt1Line4_AlienNumber[0]'],
    'uscisAccountNumber': ['Pt1Line9_USCISAccountNumber[0]'],
    'socialSecurityNumber': ['Pt1Line19_SSN[0]'],

    // === Passport & Travel ===
    'passport.passportNumber': ['Pt1Line10_PassportNum[0]'],
    'passport.expirationDate': ['Pt1Line10_ExpDate[0]'],
    'passport.issuingCountry': ['Pt1Line10_Passport[0]'],
    'visa.visaNumber': ['Pt1Line10_VisaNum[0]'],

    // === I-94 ===
    'i94.i94Number': ['P1Line12_I94[0]'],
    'i94.arrivalDate': ['Pt1Line10_DateofArrival[0]', 'Pt1Line12_Date[0]'],
    'i94.admittedAs': ['Pt1Line12_Status[0]'],
    'i94.admittedUntil': ['Pt1Line10_NonImmDate[0]'], // Valid until

    // === Address ===
    'address.street': ['Pt1Line18_StreetNumberName[0]', 'Pt1Line18_CurrentStreetNumberName[0]'],
    'address.apt': ['Pt1Line18US_AptSteFlrNumber[0]', 'Pt1Line18_CurrentAptSteFlrNumber[0]'],
    'address.city': ['Pt1Line18_CityOrTown[0]', 'Pt1Line18_CurrentCityOrTown[0]'],
    'address.state': ['Pt1Line18_State[0]', 'Pt1Line18_CurrentState[0]'],
    'address.zipCode': ['Pt1Line18_ZipCode[0]', 'Pt1Line18_CurrentZipCode[0]'],

    // === Mapeamentos antigos de fallback ===
    'last_name': ['Line1a_FamilyName', 'Family Name', 'Last Name'],
    'first_name': ['Line1b_GivenName', 'Given Name', 'First Name'],
    'middle_name': ['Line1c_MiddleName', 'Middle Name'],
    'dob': ['Date of Birth', 'DOB', 'Line 13. Date of Birth'],
    'ssn': ['SSN', 'Social Security Number', 'Line 14. SSN'],
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
    // Usamos ignoreEncryption pois formulários USCIS costumam ter encriptação por senha vazia
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
    const form = pdfDoc.getForm()

    // 3. Mesclar e Achatar dados (Extracted AI Data + DB Data)
    const rawData = {
        ...(caseData.personal_data || {}),
        ...(caseData.address_data || {}),
        // Pegando também dados extraídos, se existirem e usarem a mesma estrutura semântica
        ...(caseData.extracted_data || {})
    }

    const flatData = flattenObject(rawData)

    // 4. Preencher formulário
    for (const [dataKey, value] of Object.entries(flatData)) {
        if (value === null || value === undefined) continue;

        const possiblePdfNames = FIELD_MAP[dataKey] || [dataKey]

        for (const pdfName of possiblePdfNames) {
            try {
                // Tenta preencher como TextField
                const field = form.getTextField(pdfName)
                if (field) {
                    field.setText(String(value))
                    break // Encontrou e preencheu com sucesso
                }
            } catch (e) {
                // Se falhar (ex: não é TextField), tenta como CheckBox
                try {
                    const checkbox = form.getCheckBox(pdfName)
                    if (checkbox) {
                        if (value === true || value === 'true' || value === 'Yes' || value === 'Y') {
                            checkbox.check()
                        } else if (value === false || value === 'false' || value === 'No' || value === 'N') {
                            checkbox.uncheck()
                        }
                        break
                    }
                } catch (err) {
                    // Ignora silently e tenta a próxima chave mapeada
                }
            }
        }
    }

    // Processamento customizado de checkbox para o campo de Sexo (Exemplo I-485)
    if (flatData['applicant.sex']) {
        const sex = String(flatData['applicant.sex']).toUpperCase();
        try {
            if (sex === 'M' || sex === 'MALE') {
                form.getCheckBox('Pt1Line6_CB_Sex[0]')?.check()
            } else if (sex === 'F' || sex === 'FEMALE') {
                form.getCheckBox('Pt1Line6_CB_Sex[1]')?.check()
            }
        } catch (e) { }
    }

    // 5. Salvar PDF Gerado
    const filledPdfBytes = await pdfDoc.save()
    const finalFileName = `generated-${formType}-${caseId}-${Date.now()}.pdf`
    const storagePath = `generated-forms/${finalFileName}`

    // 6. Upload para Supabase Storage no bucket documents
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

// ============================================================
// ai-utils.ts — Utilitários centralizados para chamadas de IA
// Importar daqui em vez de duplicar nas rotas de API
// ============================================================

import type { I485ExtractedData } from '@/types/i485-schema'

/**
 * Converte um ArrayBuffer em string Base64.
 * Processa em chunks para evitar stack overflow em arquivos grandes.
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    const chunkSize = 8192
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
    }
    return btoa(binary)
}

/**
 * Determina o mediaType correto para um arquivo (PDF vs imagem).
 * Retorna { isPdf, mediaType }.
 */
export function resolveMediaType(
    fileName: string,
    mimeType: string,
): { isPdf: boolean; mediaType: string } {
    const ext = fileName.split('.').pop()?.toLowerCase()
    const isPdf = ext === 'pdf' || mimeType === 'application/pdf'

    if (isPdf) return { isPdf: true, mediaType: 'application/pdf' }

    let mediaType = mimeType || 'image/jpeg'
    if (mediaType.includes('jpg') || mediaType.includes('jpeg')) mediaType = 'image/jpeg'
    else if (mediaType.includes('png')) mediaType = 'image/png'
    else if (mediaType.includes('gif')) mediaType = 'image/gif'
    else if (mediaType.includes('webp')) mediaType = 'image/webp'
    else mediaType = 'image/jpeg'

    return { isPdf: false, mediaType }
}

/**
 * Monta o bloco de arquivo para o payload da Anthropic API.
 */
export function buildFileBlock(
    isPdf: boolean,
    mediaType: string,
    base64Data: string,
): Record<string, unknown> {
    if (isPdf) {
        return {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64Data },
        }
    }
    return {
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: base64Data },
    }
}

/**
 * Chama a API da Anthropic (Claude) e retorna o texto bruto da resposta.
 * Lança um Error se a chamada falhar.
 *
 * @param prompt    - Mensagem do usuário enviada ao Claude
 * @param fileBlock - Bloco de documento/imagem montado por buildFileBlock()
 * @param isPdf     - true ativa o header anthropic-beta para PDFs
 * @param maxTokens - Limite de tokens na resposta (default: 1024)
 * @param system    - System prompt opcional para controlar o comportamento do Claude
 */
export async function callClaude(
    prompt: string,
    fileBlock: Record<string, unknown>,
    isPdf: boolean,
    maxTokens = 1024,
    system?: string,
): Promise<string> {
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY não configurada.')

    const headers: Record<string, string> = {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
    }
    if (isPdf) headers['anthropic-beta'] = 'pdfs-2024-09-25'

    const body: Record<string, unknown> = {
        model: 'claude-sonnet-4-6',
        max_tokens: maxTokens,
        messages: [{
            role: 'user',
            content: [fileBlock, { type: 'text', text: prompt }],
        }],
    }
    if (system) body.system = system

    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    })

    if (!res.ok) {
        const bodyText = await res.text()
        throw new Error(`Claude erro ${res.status}: ${bodyText.substring(0, 300)}`)
    }

    const data = await res.json()
    const text: string = data.content?.[0]?.text ?? ''
    if (!text) throw new Error('Resposta vazia da IA.')
    return text
}

/**
 * Extrai o primeiro bloco JSON de uma string de texto.
 * Lança um Error se não encontrar JSON válido.
 */
export function extractJson<T = Record<string, unknown>>(text: string): T {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error(`JSON não encontrado na resposta da IA: ${text.substring(0, 100)}`)
    try {
        return JSON.parse(match[0]) as T
    } catch {
        throw new Error('JSON inválido na resposta da IA.')
    }
}

// ============================================================
// I485_EXTRACTION_PROMPT
// Sistema de extração estruturada para documentos do I-485.
// Instrui o Claude a identificar o tipo de documento e retornar
// um JSON que corresponde exatamente a I485ExtractedData.
// ============================================================

/**
 * System prompt que instrui o Claude a atuar como analista de documentos
 * de imigração especializado em processos I-485 (Green Card).
 *
 * Enviado como campo `system` na Anthropic Messages API para separar
 * instruções de comportamento do conteúdo do usuário.
 */
export const I485_SYSTEM_PROMPT = `\
You are an expert immigration document analyst specializing in USCIS I-485 \
(Application to Register Permanent Residence) Green Card cases. \
You have deep knowledge of all document formats used in employment-based \
immigration: passports from any country (current or expired), US visa stamps, \
CBP Form I-94 records, USCIS Form I-797 approval notices for I-140 petitions, \
Form I-693 medical examination records, civil registry documents \
(birth, marriage, divorce, death certificates), and USCIS fee receipts. \
You read documents in any language and extract data with precision. \
You always respond with valid JSON only — no explanatory text before or after.`

/**
 * User-turn prompt que acompanha o documento e especifica o schema JSON exato
 * que o Claude deve retornar, correspondendo à interface I485ExtractedData.
 *
 * Use junto com I485_SYSTEM_PROMPT em callClaude() para garantir
 * que a resposta seja parseável por extractJson<I485ExtractedData>().
 */
export const I485_EXTRACTION_PROMPT = `\
Analyze the attached document and extract all relevant immigration data.

## STEP 1 — IDENTIFY THE DOCUMENT TYPE

Choose the single best match from this list:
- "passport"               → Passport photo/data page (any country, current or expired)
- "i94"                    → Form I-94 Arrival/Departure Record (printed or online screenshot)
- "current_visa"           → US Visa stamp page from a passport
- "i797_i140"              → Form I-797 Notice of Action confirming I-140 approval
- "status_history"         → Prior visas, Form I-20, EAD, or other historical immigration documents
- "birth_cert_primary"     → Birth certificate of the primary I-485 applicant
- "birth_cert_spouse"      → Birth certificate of the applicant's spouse
- "birth_cert_child"       → Birth certificate of a child derivative beneficiary
- "marriage_cert"          → Marriage certificate
- "divorce_cert"           → Divorce decree, annulment order, or death certificate (proving prior marriage ended)
- "medical_receipt"        → Receipt or sealed envelope cover page for Form I-693 Medical Examination
- "passport_photos"        → Passport-style photographs (2"×2" / 5×5 cm)
- "i485_fee_receipt"       → USCIS fee receipt for Form I-485 filing
- "biometrics_fee_receipt" → USCIS fee receipt for Biometric Services (ASC appointment)
- "unknown"                → Document type cannot be determined

## STEP 2 — EXTRACTION RULES

- **Dates**: always ISO format YYYY-MM-DD. If only month/year is visible, use the 1st of the month.
- **Names**: preserve the exact spelling as printed on the document.
- **Omit** any field that is not legible or not present — do not guess or hallucinate values.
- **Passport MRZ**: if the Machine Readable Zone is visible, include both lines verbatim.
- **I-797 receipt number**: 3-letter prefix + 10 digits, e.g. "SRC2312345678" or "EAC2309876543".
- **I-94 number**: exactly 11 digits.
- **I-693**: this document is sealed — you will only see a cover/receipt page. Extract the physician name, clinic, and exam date if printed on the envelope or receipt.
- **Old/expired passports**: treat identically to current passports; note expiration in warnings if expired.
- **Translated documents**: set hasTranslation: true only if a certified translation is visibly attached.
- **formAutoFill**: populate ALL I-485 form fields that can be derived from this document, regardless of document type. A passport, for example, populates p1_first_name, p1_date_of_birth, p1_passport_number, etc.
- **warnings**: flag actionable issues such as:
  - Passport expires within 6 months of today
  - Document is in a foreign language without a visible certified translation
  - I-693 exam date is more than 2 years ago (may be outside USCIS validity window)
  - I-140 priority date visible — attorney should verify bulletin currency
  - Passport has fewer than 6 months of validity remaining
- **missingFields**: list camelCase field names that are expected for this documentType but could not be read from the image.
- **confidence**:
  - "high"   → all primary fields clearly legible, document fully visible
  - "medium" → most fields readable but some unclear or partially cut off
  - "low"    → document is blurry, damaged, partially visible, or type is uncertain

## STEP 3 — OUTPUT

Return ONLY the following JSON object. Include only sections relevant to the detected document type. Omit sections entirely (not just null them) when they do not apply. For example, a passport should not include "i797_i140" or "civilCertificate".

{
  "documentType": "<id from the list above>",
  "confidence": "<high | medium | low>",
  "applicant": {
    "firstName": "",
    "middleName": "",
    "lastName": "",
    "fullName": "",
    "dateOfBirth": "YYYY-MM-DD",
    "placeOfBirth": "",
    "cityOfBirth": "",
    "countryOfBirth": "",
    "sex": "<M | F>",
    "nationality": ""
  },
  "passport": {
    "passportNumber": "",
    "issueDate": "YYYY-MM-DD",
    "expirationDate": "YYYY-MM-DD",
    "issuingCountry": "",
    "issuingAuthority": "",
    "mrzLine1": "",
    "mrzLine2": ""
  },
  "visa": {
    "visaType": "",
    "visaNumber": "",
    "issueDate": "YYYY-MM-DD",
    "expirationDate": "YYYY-MM-DD",
    "issuingPost": "",
    "entries": "<M | S>",
    "annotations": ""
  },
  "i94": {
    "i94Number": "",
    "arrivalDate": "YYYY-MM-DD",
    "admittedUntil": "",
    "admittedAs": "",
    "portOfEntry": "",
    "travelDocument": ""
  },
  "i797_i140": {
    "receiptNumber": "",
    "noticeDate": "YYYY-MM-DD",
    "approvalDate": "YYYY-MM-DD",
    "petitionerName": "",
    "beneficiaryName": "",
    "employmentCategory": "",
    "priorityDate": "YYYY-MM-DD",
    "classPreferenceCode": "",
    "alienNumber": ""
  },
  "civilCertificate": {
    "documentType": "<birth | marriage | divorce | death>",
    "registryNumber": "",
    "registryDate": "YYYY-MM-DD",
    "registryCity": "",
    "registryState": "",
    "registryCountry": "",
    "hasTranslation": false,
    "subjectName": "",
    "subjectDateOfBirth": "YYYY-MM-DD",
    "fatherName": "",
    "motherName": "",
    "spouse1Name": "",
    "spouse2Name": "",
    "marriageDate": "YYYY-MM-DD",
    "marriageCity": "",
    "marriageState": "",
    "separationDate": "YYYY-MM-DD",
    "divorceDate": "YYYY-MM-DD",
    "divorceCity": ""
  },
  "medicalExam": {
    "physicianName": "",
    "clinicName": "",
    "clinicAddress": "",
    "examDate": "YYYY-MM-DD",
    "receiptNumber": "",
    "beneficiaryName": "",
    "estimatedExpiry": "YYYY-MM-DD"
  },
  "paymentReceipt": {
    "receiptNumber": "",
    "feeType": "<I-485 | biometrics | other>",
    "caseType": "",
    "amount": "",
    "paymentDate": "YYYY-MM-DD",
    "applicantName": "",
    "receivedDate": "YYYY-MM-DD"
  },
  "formAutoFill": {
    "p1_first_name": "",
    "p1_middle_name": "",
    "p1_last_name": "",
    "p1_date_of_birth": "YYYY-MM-DD",
    "p1_sex": "<M | F>",
    "p1_city_of_birth": "",
    "p1_country_of_birth": "",
    "p1_country_of_citizenship": "",
    "p1_alien_number": "",
    "p1_passport_number": "",
    "p1_i94_number": "",
    "p1_current_status": "",
    "p2_application_type": "",
    "p2_receipt_number": "",
    "p2_priority_date": "YYYY-MM-DD",
    "p2_employment_category": ""
  },
  "warnings": [],
  "missingFields": [],
  "rawText": ""
}`

/**
 * Extrai dados estruturados de um documento I-485 usando Claude Vision.
 *
 * Combina I485_SYSTEM_PROMPT + I485_EXTRACTION_PROMPT e retorna
 * um objeto tipado como I485ExtractedData.
 *
 * @param fileBlock - Bloco de documento/imagem montado por buildFileBlock()
 * @param isPdf     - true ativa o header anthropic-beta para PDFs
 * @returns         Dados extraídos tipados como I485ExtractedData
 *
 * @example
 * const base64    = arrayBufferToBase64(await file.arrayBuffer())
 * const { isPdf, mediaType } = resolveMediaType(file.name, file.type)
 * const fileBlock = buildFileBlock(isPdf, mediaType, base64)
 * const data      = await extractI485Data(fileBlock, isPdf)
 * // data.documentType → 'passport'
 * // data.passport?.passportNumber → 'BR1234567'
 */
export async function extractI485Data(
    fileBlock: Record<string, unknown>,
    isPdf: boolean,
): Promise<I485ExtractedData> {
    const raw = await callClaude(
        I485_EXTRACTION_PROMPT,
        fileBlock,
        isPdf,
        2048,
        I485_SYSTEM_PROMPT,
    )
    const data = extractJson<I485ExtractedData>(raw)
    data.extractedAt = new Date().toISOString()
    return data
}

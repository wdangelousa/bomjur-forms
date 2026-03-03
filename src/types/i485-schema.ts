// ============================================================
// i485-schema.ts — Schema central do processo I-485 Proexpand
//
// Três responsabilidades:
//   1. DocumentRequirement  — Catálogo de documentos com categorias e condicionais
//   2. ScreeningAnswers     — Respostas da triagem que determinam quais docs são exigidos
//   3. I485ExtractedData    — Estrutura JSON retornada pelo Claude após leitura de documento
// ============================================================

// ────────────────────────────────────────────────────────────
// SECTION 1 — ENUMS & UNION TYPES
// ────────────────────────────────────────────────────────────

/** Categorias de documentos espelhando a esteira física do USCIS */
export type DocumentCategory =
    | 'identification_travel'   // Passaporte, I-94, Histórico de Visto
    | 'civil_documents'         // Certidões de nascimento, casamento, divórcio
    | 'immigration_base'        // I-140 (I-797), histórico de status imigratório
    | 'medical_biometrics'      // I-693, fotos 5x5
    | 'fees_payments'           // Recibos de pagamento USCIS

/** IDs canônicos para cada tipo de documento */
export type DocumentTypeId =
    | 'passport'                // Passaporte — página com foto
    | 'i94'                     // Formulário I-94 (CBP)
    | 'current_visa'            // Visto atual (página completa)
    | 'i797_i140'               // I-797 Notice of Action — aprovação do I-140
    | 'status_history'          // Histórico de status (I-20, vistos anteriores)
    | 'birth_cert_primary'      // Certidão de nascimento do requerente
    | 'birth_cert_spouse'       // Certidão de nascimento do cônjuge
    | 'birth_cert_child'        // Certidão de nascimento de filho (repetível)
    | 'marriage_cert'           // Certidão de casamento
    | 'divorce_cert'            // Averbação de divórcio ou certidão de óbito
    | 'medical_receipt'         // Foto do recibo do exame médico (Form I-693)
    | 'passport_photos'         // 2 fotos estilo passaporte 5x5 cm
    | 'i485_fee_receipt'        // Recibo de pagamento da taxa do I-485
    | 'biometrics_fee_receipt'  // Recibo de pagamento de biometria

/** Categorias de visto de emprego (para identificar o tipo de I-140) */
export type EmploymentBasedCategory =
    | 'EB-1A' | 'EB-1B' | 'EB-1C'
    | 'EB-2'  | 'EB-2-NIW'
    | 'EB-3'  | 'EB-3W'
    | 'EB-4'  | 'EB-5'

/** Tipos de visto de não-imigrante mais comuns para requerentes de I-485 */
export type NonImmigrantVisaType =
    | 'H-1B' | 'H-1B1' | 'H-4'
    | 'L-1A' | 'L-1B'  | 'L-2'
    | 'E-2'  | 'E-3'
    | 'O-1A' | 'O-1B'
    | 'TN'
    | 'F-1'  | 'J-1'
    | 'other'

/** Confiança do Claude na extração de dados */
export type ExtractionConfidence = 'high' | 'medium' | 'low'

// ────────────────────────────────────────────────────────────
// SECTION 2 — DocumentRequirement
// ────────────────────────────────────────────────────────────

/**
 * Condição que determina se um documento é exigido.
 * Avaliada contra um objeto ScreeningAnswers.
 *
 * @example
 * // Certidão de casamento só é exigida se o requerente for casado:
 * { field: 'isMarried', operator: 'eq', value: true }
 *
 * @example
 * // Certidões dos filhos exigidas se houver pelo menos 1:
 * { field: 'childrenCount', operator: 'gte', value: 1 }
 */
export interface DocumentCondition {
    /** Campo de ScreeningAnswers a ser avaliado */
    field: keyof ScreeningAnswers
    /** Operador de comparação */
    operator: 'eq' | 'neq' | 'gte' | 'lte' | 'exists'
    /** Valor esperado (boolean, number ou string) */
    value: boolean | number | string
}

/**
 * Define um documento exigido no processo I-485.
 * Suporta categorias, condicionais e repetição por membro da família.
 */
export interface DocumentRequirement {
    /** ID canônico — usado como chave em mapas e no banco de dados */
    id: DocumentTypeId | string

    /** Categoria que determina o grupo na UI e na esteira de montagem */
    category: DocumentCategory

    /** Rótulo amigável em português (exibido ao cliente) */
    label: string

    /** Nome oficial USCIS em inglês (exibido na esteira admin) */
    labelEn: string

    /** Emoji representativo (sem lucide-react) */
    emoji: string

    /** Descrição curta do que enviar */
    description: string

    /**
     * Instrução adicional ou aviso exibido em texto menor.
     * Ex.: "Apenas a foto do recibo. Entregue o envelope lacrado fisicamente."
     */
    hint?: string

    /**
     * true  → sempre obrigatório, independente da triagem.
     * false → obrigatório apenas se as condições forem satisfeitas.
     */
    required: boolean

    /**
     * Lista de condições (todas devem ser verdadeiras — AND lógico)
     * para que o documento seja exigido. Ignorado se required=true.
     */
    conditions?: DocumentCondition[]

    /**
     * true  → o documento pode aparecer várias vezes (ex.: certidão por filho).
     * Usado junto com repeatFor e maxRepeat.
     */
    repeatable?: boolean

    /**
     * Define para quais membros da família o documento se repete.
     * 'children' → uma instância por filho (até childrenCount)
     * 'prior_spouses' → uma instância por casamento anterior
     */
    repeatFor?: 'children' | 'prior_spouses'

    /** Número máximo de repetições (normalmente derivado de ScreeningAnswers) */
    maxRepeat?: number

    /**
     * Campos de I485ExtractedData que este documento contribui quando processado pela IA.
     * Permite mapear "qual documento preenche qual campo do formulário".
     */
    aiExtractFields?: string[]

    /**
     * Ordem de posição na esteira de montagem física (USCIS assembly order).
     * Quanto menor, mais acima na pilha de documentos entregue ao USCIS.
     */
    assemblyOrder?: number
}

// ────────────────────────────────────────────────────────────
// SECTION 3 — ScreeningAnswers
// ────────────────────────────────────────────────────────────

/**
 * Respostas da triagem inicial do cliente.
 * Determina quais documentos são exigidos via DocumentCondition.
 * Espelha a lógica de getChecklistDocs() em app/i485/page.tsx.
 */
export interface ScreeningAnswers {
    // ── Situação Familiar ────────────────────────────────────

    /** O requerente é atualmente casado? */
    isMarried: boolean

    /** O requerente tem filhos que serão incluídos no I-485? */
    hasChildren: boolean

    /** Quantos filhos serão incluídos (0 se hasChildren=false) */
    childrenCount: number

    /** O requerente tem casamentos anteriores (divórcio ou viuvez)? */
    hasPreviousMarriages: boolean

    /** O cônjuge atual tem casamentos anteriores? */
    spouseHasPreviousMarriages?: boolean

    /** Nomes dos filhos (usado para gerar IDs únicos de documentos) */
    childrenNames?: string[]

    // ── Base Imigratória ─────────────────────────────────────

    /** O requerente possui I-140 aprovado? */
    hasI140Approved: boolean

    /** Categoria de preferência do I-140 */
    i140Category?: EmploymentBasedCategory

    /** O requerente possui data de prioridade com data atual? */
    priorityDateCurrent?: boolean

    /** Data de prioridade (formato MM/YYYY ou YYYY-MM-DD) */
    priorityDate?: string

    // ── Status Imigratório Atual ─────────────────────────────

    /** Tipo do visto atual (último status legal) */
    currentVisaType?: NonImmigrantVisaType

    /** O requerente possui registro I-94 ativo no sistema CBP? */
    hasI94Record: boolean

    /** O requerente entrou nos EUA nos últimos 2 anos? */
    recentEntry?: boolean

    // ── Exame Médico ─────────────────────────────────────────

    /** O requerente já realizou o exame médico (Form I-693)? */
    hasCompletedMedical: boolean

    /** Data de realização do exame (ISO: YYYY-MM-DD) */
    medicalExamDate?: string

    /**
     * O exame ainda está dentro do prazo de validade?
     * (I-693 válido por 2 anos a partir da assinatura do médico)
     */
    medicalExamValid?: boolean

    // ── Taxas e Pagamentos ───────────────────────────────────

    /** O requerente já pagou a taxa do I-485? */
    hasPaidI485Fee: boolean

    /** O requerente já pagou a taxa de biometria (ASC)? */
    hasPaidBiometricsFee: boolean

    /** O requerente é isento da taxa (menor de 14 anos, idoso, etc.)? */
    feeExempt?: boolean
}

// ────────────────────────────────────────────────────────────
// SECTION 4 — Sub-tipos para I485ExtractedData
// ────────────────────────────────────────────────────────────

/** Dados pessoais comuns a vários documentos */
export interface PersonInfo {
    firstName?:   string
    middleName?:  string
    lastName?:    string
    fullName?:    string    // Conforme aparece no documento original
    dateOfBirth?: string    // ISO: YYYY-MM-DD
    placeOfBirth?: string   // Cidade, Estado, País
    cityOfBirth?:    string
    countryOfBirth?: string
    sex?: 'M' | 'F'
    nationality?: string    // País de nacionalidade
}

/** Dados extraídos de um Passaporte */
export interface PassportData extends PersonInfo {
    passportNumber?:  string
    issueDate?:       string    // ISO: YYYY-MM-DD
    expirationDate?:  string
    issuingCountry?:  string    // Código ISO 3166-1 alpha-3, ex.: BRA
    issuingAuthority?: string
    /** Linhas MRZ (Machine Readable Zone) — úteis para validação */
    mrzLine1?: string
    mrzLine2?: string
}

/** Dados extraídos de um Visto americano (página do passaporte) */
export interface VisaData {
    visaType?:      string    // H-1B, L-1, O-1, TN, etc.
    visaNumber?:    string
    issueDate?:     string
    expirationDate?: string
    issuingPost?:   string    // Ex.: "São Paulo" (consulado)
    entries?:       'M' | 'S' // Multiple ou Single
    annotations?:  string     // Anotações impressas no visto
}

/** Dados extraídos do Formulário I-94 (online ou impresso) */
export interface I94Data {
    i94Number?:     string    // 11 dígitos
    arrivalDate?:   string    // ISO: YYYY-MM-DD
    admittedUntil?: string    // Data ou 'D/S' (Duration of Status)
    admittedAs?:    string    // Classe do visto na entrada
    portOfEntry?:   string    // Ex.: "John F. Kennedy Int'l Airport"
    travelDocument?: string   // Passaporte usado na entrada
}

/** Dados extraídos do I-797 Notice of Action (aprovação do I-140) */
export interface I797I140Data {
    receiptNumber?:      string   // Ex.: SRC2312345678
    noticeDate?:         string
    approvalDate?:       string
    /** Nome da empresa peticionária */
    petitionerName?:     string
    beneficiaryName?:    string
    /** Categoria de emprego — EB-1, EB-2, etc. */
    employmentCategory?: string
    priorityDate?:       string
    /** Código de preferência USCIS */
    classPreferenceCode?: string
    /** A number do beneficiário se constante no documento */
    alienNumber?:        string
}

/** Dados extraídos de Certidões Civis (nascimento, casamento, divórcio) */
export interface CivilCertificateData {
    documentType?: 'birth' | 'marriage' | 'divorce' | 'death'
    registryNumber?: string
    registryDate?:   string
    registryCity?:   string
    registryState?:  string
    registryCountry?: string
    hasTranslation?: boolean    // Indica se há tradução juramentada anexada

    // Certidão de Nascimento
    subjectName?:        string
    subjectDateOfBirth?: string
    fatherName?:         string
    motherName?:         string

    // Certidão de Casamento
    spouse1Name?:   string
    spouse2Name?:   string
    marriageDate?:  string
    marriageCity?:  string
    marriageState?: string

    // Averbação de Divórcio / Certidão de Óbito
    separationDate?: string
    divorceDate?:    string
    divorceCity?:    string
}

/** Dados extraídos do recibo do Exame Médico (Form I-693) */
export interface MedicalExamData {
    physicianName?:    string
    clinicName?:       string
    clinicAddress?:    string
    examDate?:         string
    /** Número do recibo ou protocolo emitido pelo médico designado USCIS */
    receiptNumber?:    string
    beneficiaryName?:  string
    /** Prazo de validade estimado (2 anos a partir da assinatura) */
    estimatedExpiry?:  string
}

/** Dados extraídos de um recibo de pagamento USCIS */
export interface PaymentReceiptData {
    receiptNumber?:  string   // Ex.: IOE0912345678
    feeType?:        'I-485' | 'biometrics' | 'other'
    caseType?:       string   // "Application to Register Permanent Residence"
    amount?:         string   // Ex.: "$1,440.00"
    paymentDate?:    string
    applicantName?:  string
    /** Data a partir da qual o USCIS reconhece a petição */
    receivedDate?:   string
}

/**
 * Mapeamento dos campos do Formulário I-485 que a IA pode auto-preencher.
 * Nomenclatura segue a estrutura oficial do I-485 (partes 1–4).
 */
export interface I485FormAutoFill {
    // Parte 1 — Informações sobre Você
    p1_first_name?:             string
    p1_middle_name?:            string
    p1_last_name?:              string
    p1_date_of_birth?:          string
    p1_sex?:                    'M' | 'F'
    p1_city_of_birth?:          string
    p1_country_of_birth?:       string
    p1_country_of_citizenship?: string
    p1_alien_number?:           string   // A-Number
    p1_passport_number?:        string
    p1_i94_number?:             string
    p1_current_status?:         string

    // Parte 2 — Base do Pedido
    p2_application_type?:       string   // Ex.: "(c)(2)" ou "(c)(9)"
    p2_receipt_number?:         string   // Número do I-140
    p2_priority_date?:          string
    p2_employment_category?:    string   // EB-1, EB-2, EB-3

    // Parte 3 — Processamento Adicional
    p3_attorney_name?:          string
    p3_attorney_bar_number?:    string

    // Parte 4 — Informações do Intérprete (se aplicável)
    p4_interpreter_name?:       string
    p4_interpreter_language?:   string
}

// ────────────────────────────────────────────────────────────
// SECTION 5 — I485ExtractedData (retorno principal da IA)
// ────────────────────────────────────────────────────────────

/**
 * Estrutura JSON retornada pelo Claude após análise de um documento.
 * Consumida por extractJson<I485ExtractedData>() de ai-utils.ts.
 *
 * O prompt enviado ao Claude deve solicitar exatamente este formato.
 *
 * @example
 * // Uso em uma API route:
 * const raw  = await callClaude(prompt, fileBlock, isPdf, 2048)
 * const data = extractJson<I485ExtractedData>(raw)
 * // data.documentType → 'passport'
 * // data.passport?.passportNumber → 'BR1234567'
 */
export interface I485ExtractedData {
    /** Tipo de documento identificado pelo Claude */
    documentType: DocumentTypeId | 'unknown'

    /**
     * Nível de confiança da extração.
     * - high   → todos os campos principais identificados com clareza
     * - medium → maioria dos campos identificada, mas com algumas incertezas
     * - low    → documento ilegível, incompleto ou tipo não reconhecido
     */
    confidence: ExtractionConfidence

    /** Timestamp da extração (ISO 8601) — gerado pelo servidor, não pelo Claude */
    extractedAt?: string

    // ── Dados do Solicitante (pessoa identificada no documento) ──

    /** Informações pessoais extraídas do documento */
    applicant?: PersonInfo

    // ── Dados específicos por tipo de documento ──
    // Apenas o campo correspondente ao documentType deve estar preenchido.

    passport?:          PassportData
    visa?:              VisaData
    i94?:               I94Data
    i797_i140?:         I797I140Data
    civilCertificate?:  CivilCertificateData
    medicalExam?:       MedicalExamData
    paymentReceipt?:    PaymentReceiptData

    // ── Auto-preenchimento do Formulário I-485 ──

    /**
     * Campos do I-485 que podem ser preenchidos automaticamente
     * com base nas informações extraídas deste documento.
     */
    formAutoFill?: Partial<I485FormAutoFill>

    // ── Metadados de Qualidade ──

    /**
     * Alertas que o Claude identificou durante a leitura.
     * Ex.: "Passaporte expira em 3 meses — verificar validade",
     *       "Documento em idioma diferente — tradução necessária"
     */
    warnings?: string[]

    /**
     * Campos esperados para este tipo de documento mas não encontrados.
     * Ex.: ["passportNumber", "expirationDate"]
     */
    missingFields?: string[]

    /**
     * Texto bruto detectado no documento (OCR completo).
     * Útil para auditoria e depuração, mas não exibido ao cliente.
     */
    rawText?: string
}

// ────────────────────────────────────────────────────────────
// SECTION 6 — Catálogo de documentos (DocumentRequirement[])
// ────────────────────────────────────────────────────────────

/**
 * Lista completa de documentos do processo I-485 da Proexpand.
 * Use buildRequiredDocs(answers) para filtrar pelos documentos
 * exigidos a partir das respostas de triagem.
 *
 * Ordem de assemblyOrder segue a sequência física exigida pelo USCIS.
 */
export const DOCUMENT_CATALOG: DocumentRequirement[] = [
    // ── Identificação e Viagem ──────────────────────────────

    {
        id: 'passport',
        category: 'identification_travel',
        label: 'Passaporte (Página com foto)',
        labelEn: 'Passport — Photo Page',
        emoji: '🛂',
        description: 'Página com foto e dados pessoais do passaporte atual',
        required: true,
        aiExtractFields: ['passport'],
        assemblyOrder: 1,
    },
    {
        id: 'i94',
        category: 'identification_travel',
        label: 'Formulário I-94',
        labelEn: 'Form I-94 — Arrival/Departure Record',
        emoji: '✈️',
        description: 'Print do site i94.cbp.dhs.gov com histórico de entradas',
        required: true,
        aiExtractFields: ['i94'],
        assemblyOrder: 2,
    },
    {
        id: 'current_visa',
        category: 'identification_travel',
        label: 'Visto Atual (Página Completa)',
        labelEn: 'Current Visa — Full Page',
        emoji: '📋',
        description: 'Página do passaporte com o visto vigente e carimbo de entrada',
        required: true,
        aiExtractFields: ['visa'],
        assemblyOrder: 3,
    },

    // ── Documentos Civis ────────────────────────────────────

    {
        id: 'birth_cert_primary',
        category: 'civil_documents',
        label: 'Certidão de Nascimento (Requerente)',
        labelEn: 'Birth Certificate — Primary Applicant',
        emoji: '👶',
        description: 'Com tradução juramentada para inglês',
        required: true,
        aiExtractFields: ['civilCertificate'],
        assemblyOrder: 4,
    },
    {
        id: 'birth_cert_spouse',
        category: 'civil_documents',
        label: 'Certidão de Nascimento (Cônjuge)',
        labelEn: 'Birth Certificate — Spouse',
        emoji: '👶',
        description: 'Certidão de nascimento do cônjuge com tradução juramentada',
        required: false,
        conditions: [{ field: 'isMarried', operator: 'eq', value: true }],
        aiExtractFields: ['civilCertificate'],
        assemblyOrder: 5,
    },
    {
        id: 'birth_cert_child',
        category: 'civil_documents',
        label: 'Certidão de Nascimento (Filho)',
        labelEn: 'Birth Certificate — Child',
        emoji: '👶',
        description: 'Uma certidão por filho incluído no processo, com tradução juramentada',
        required: false,
        conditions: [{ field: 'hasChildren', operator: 'eq', value: true }],
        repeatable: true,
        repeatFor: 'children',
        aiExtractFields: ['civilCertificate'],
        assemblyOrder: 6,
    },
    {
        id: 'marriage_cert',
        category: 'civil_documents',
        label: 'Certidão de Casamento',
        labelEn: 'Marriage Certificate',
        emoji: '💍',
        description: 'Com tradução juramentada para inglês',
        required: false,
        conditions: [{ field: 'isMarried', operator: 'eq', value: true }],
        aiExtractFields: ['civilCertificate'],
        assemblyOrder: 7,
    },
    {
        id: 'divorce_cert',
        category: 'civil_documents',
        label: 'Averbação de Divórcio ou Certidão de Óbito',
        labelEn: 'Divorce Decree or Death Certificate',
        emoji: '📋',
        description: 'Necessário para cada casamento anterior do requerente ou cônjuge',
        required: false,
        conditions: [{ field: 'hasPreviousMarriages', operator: 'eq', value: true }],
        repeatable: true,
        repeatFor: 'prior_spouses',
        aiExtractFields: ['civilCertificate'],
        assemblyOrder: 8,
    },

    // ── Base da Imigração ───────────────────────────────────

    {
        id: 'i797_i140',
        category: 'immigration_base',
        label: 'Aprovação do I-140 (Form I-797)',
        labelEn: 'I-797 Notice of Action — I-140 Approval',
        emoji: '📄',
        description: 'Notice of Action do USCIS confirmando a aprovação do I-140',
        required: true,
        aiExtractFields: ['i797_i140'],
        assemblyOrder: 9,
    },
    {
        id: 'status_history',
        category: 'immigration_base',
        label: 'Histórico de Status (I-20, Vistos Anteriores)',
        labelEn: 'Immigration Status History',
        emoji: '📁',
        description: 'Todos os documentos de status desde a primeira entrada nos EUA',
        required: true,
        aiExtractFields: ['visa'],
        assemblyOrder: 10,
    },

    // ── Biometria e Médico ──────────────────────────────────

    {
        id: 'passport_photos',
        category: 'medical_biometrics',
        label: '2 Fotos Estilo Passaporte (5x5 cm)',
        labelEn: '2 Passport-Style Photos (2"x2")',
        emoji: '📸',
        description: 'Fundo branco, rosto descoberto, tiradas nos últimos 6 meses',
        hint: 'Escreva seu nome e data de nascimento a lápis no verso de cada foto.',
        required: true,
        assemblyOrder: 11,
    },
    {
        id: 'medical_receipt',
        category: 'medical_biometrics',
        label: 'Exame Médico (Form I-693)',
        labelEn: 'Medical Examination — Form I-693',
        emoji: '🩺',
        description: 'Foto do recibo do exame médico realizado com médico credenciado USCIS',
        hint: 'Apenas a foto do recibo. Entregue o envelope lacrado fisicamente ao advogado — nunca abra.',
        required: true,
        aiExtractFields: ['medicalExam'],
        assemblyOrder: 12,
    },

    // ── Taxas e Pagamentos ──────────────────────────────────

    {
        id: 'i485_fee_receipt',
        category: 'fees_payments',
        label: 'Recibo de Pagamento — Taxa do I-485',
        labelEn: 'I-485 Filing Fee Receipt',
        emoji: '💳',
        description: 'Recibo de pagamento da taxa de protocolização do I-485 no USCIS',
        required: false,
        conditions: [{ field: 'hasPaidI485Fee', operator: 'eq', value: true }],
        aiExtractFields: ['paymentReceipt'],
        assemblyOrder: 13,
    },
    {
        id: 'biometrics_fee_receipt',
        category: 'fees_payments',
        label: 'Recibo de Pagamento — Biometria (ASC)',
        labelEn: 'Biometrics Service Fee Receipt',
        emoji: '🖐️',
        description: 'Recibo de pagamento da taxa de biometria para o Application Support Center',
        required: false,
        conditions: [{ field: 'hasPaidBiometricsFee', operator: 'eq', value: true }],
        aiExtractFields: ['paymentReceipt'],
        assemblyOrder: 14,
    },
]

// ────────────────────────────────────────────────────────────
// SECTION 7 — Helper: buildRequiredDocs
// ────────────────────────────────────────────────────────────

/**
 * Filtra o DOCUMENT_CATALOG retornando apenas os documentos
 * exigidos com base nas respostas de triagem do cliente.
 * Documentos repetíveis são expandidos (ex.: 3 filhos → 3 entradas).
 *
 * @example
 * const required = buildRequiredDocs({
 *     isMarried: true,
 *     hasChildren: true,
 *     childrenCount: 2,
 *     hasPreviousMarriages: false,
 *     hasI140Approved: true,
 *     hasI94Record: true,
 *     hasCompletedMedical: true,
 *     hasPaidI485Fee: false,
 *     hasPaidBiometricsFee: false,
 * })
 * // → 14 documentos, incluindo 2 certidões de filhos
 */
export function buildRequiredDocs(answers: ScreeningAnswers): DocumentRequirement[] {
    const result: DocumentRequirement[] = []

    for (const doc of DOCUMENT_CATALOG) {
        // Documentos sempre obrigatórios
        if (doc.required) {
            if (doc.repeatable && doc.repeatFor === 'children') {
                const count = answers.hasChildren ? Math.max(1, answers.childrenCount) : 0
                for (let i = 1; i <= count; i++) {
                    result.push({
                        ...doc,
                        id: `${doc.id}_${i}`,
                        label: `${doc.label} — Filho ${i}`,
                    })
                }
            } else {
                result.push(doc)
            }
            continue
        }

        // Documentos condicionais: todas as condições devem ser verdadeiras
        if (!doc.conditions || doc.conditions.length === 0) continue

        const allMet = doc.conditions.every(cond => {
            const val = answers[cond.field]
            if (cond.operator === 'eq')     return val === cond.value
            if (cond.operator === 'neq')    return val !== cond.value
            if (cond.operator === 'gte')    return typeof val === 'number' && val >= (cond.value as number)
            if (cond.operator === 'lte')    return typeof val === 'number' && val <= (cond.value as number)
            if (cond.operator === 'exists') return val !== undefined && val !== null
            return false
        })

        if (!allMet) continue

        // Documentos condicionais repetíveis (ex.: certidões por filho)
        if (doc.repeatable && doc.repeatFor === 'children') {
            const count = Math.max(1, answers.childrenCount)
            for (let i = 1; i <= count; i++) {
                result.push({
                    ...doc,
                    id: `${doc.id}_${i}`,
                    label: `${doc.label} — Filho ${i}`,
                })
            }
        } else if (doc.repeatable && doc.repeatFor === 'prior_spouses') {
            // Por simplicidade: 1 documento por casamento anterior (assume 1 se não especificado)
            result.push(doc)
        } else {
            result.push(doc)
        }
    }

    // Ordena pela posição na esteira de montagem USCIS
    return result.sort((a, b) => (a.assemblyOrder ?? 99) - (b.assemblyOrder ?? 99))
}

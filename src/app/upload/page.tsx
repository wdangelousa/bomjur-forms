'use client'

import React, { useCallback, useMemo, useRef, useState } from 'react'
import { createClient } from '@/src/lib/supabase/client'
import type { DocumentRequirement, DocumentCategory, ScreeningAnswers, DocumentCondition } from '@/src/types/i485-schema'

// ══════════════════════════════════════════════════════════
// DOCS_CONFIG — Fonte da verdade para os cards de upload.
// Tipado como DocumentRequirement[] para garantir consistência
// com o schema central em src/types/i485-schema.ts.
// Para adicionar ou remover documentos, edite apenas este array.
// ══════════════════════════════════════════════════════════
const DOCS_CONFIG: DocumentRequirement[] = [
    // ── Identificação e Viagem ──────────────────────────────
    {
        id: 'passport',
        category: 'identification_travel',
        label: 'Passaporte',
        labelEn: 'Passport — Photo Page',
        emoji: '🛂',
        description: 'Página com foto e dados pessoais do passaporte atual.',
        required: true,
        assemblyOrder: 1,
    },
    {
        id: 'i94',
        category: 'identification_travel',
        label: 'Formulário I-94',
        labelEn: 'Form I-94 — Arrival/Departure Record',
        emoji: '✈️',
        description: 'Print do site i94.cbp.dhs.gov com histórico de entradas nos EUA.',
        required: true,
        assemblyOrder: 2,
    },
    {
        id: 'current_visa',
        category: 'identification_travel',
        label: 'Visto Atual (Página Completa)',
        labelEn: 'Current Visa — Full Page',
        emoji: '📋',
        description: 'Página do passaporte com o visto vigente e carimbo de entrada.',
        required: true,
        assemblyOrder: 3,
    },
    // ── Documentos Civis ────────────────────────────────────
    {
        id: 'birth_cert_primary',
        category: 'civil_documents',
        label: 'Certidão de Nascimento',
        labelEn: 'Birth Certificate — Primary Applicant',
        emoji: '👶',
        description: 'Sua certidão com tradução juramentada para inglês.',
        required: true,
        assemblyOrder: 4,
    },
    {
        id: 'birth_cert_child',
        category: 'civil_documents',
        label: 'Certidão de Nascimento (Filhos)',
        labelEn: 'Birth Certificate — Children',
        emoji: '👶',
        description: 'Uma por filho incluído no processo, com tradução juramentada para inglês.',
        required: false,
        conditions: [{ field: 'hasChildren', operator: 'eq', value: true }],
        assemblyOrder: 5,
    },
    {
        id: 'marriage_cert',
        category: 'civil_documents',
        label: 'Certidão de Casamento',
        labelEn: 'Marriage Certificate',
        emoji: '💍',
        description: 'Com tradução juramentada para inglês.',
        required: false,
        conditions: [{ field: 'isMarried', operator: 'eq', value: true }],
        assemblyOrder: 7,
    },
    {
        id: 'divorce_cert',
        category: 'civil_documents',
        label: 'Averbação de Divórcio ou Certidão de Óbito',
        labelEn: 'Divorce Decree or Death Certificate',
        emoji: '📁',
        description: 'Necessário para cada casamento anterior do requerente ou cônjuge.',
        required: false,
        conditions: [{ field: 'hasPreviousMarriages', operator: 'eq', value: true }],
        assemblyOrder: 8,
    },
    // ── Base da Imigração ───────────────────────────────────
    {
        id: 'i797_i140',
        category: 'immigration_base',
        label: 'Aprovação do I-140 (Form I-797)',
        labelEn: 'I-797 Notice of Action — I-140 Approval',
        emoji: '📄',
        description: 'Notice of Action do USCIS confirmando a aprovação do I-140.',
        required: true,
        assemblyOrder: 9,
    },
    {
        id: 'status_history',
        category: 'immigration_base',
        label: 'Histórico de Status (I-20, Vistos Anteriores)',
        labelEn: 'Immigration Status History',
        emoji: '📁',
        description: 'Todos os documentos de status desde a primeira entrada nos EUA.',
        required: true,
        assemblyOrder: 10,
    },
    // ── Médico e Biometria ──────────────────────────────────
    {
        id: 'passport_photos',
        category: 'medical_biometrics',
        label: '2 Fotos Estilo Passaporte (5x5 cm)',
        labelEn: '2 Passport-Style Photos (2"x2")',
        emoji: '📸',
        description: 'Fundo branco, rosto descoberto, tiradas nos últimos 6 meses.',
        hint: 'Escreva seu nome e data de nascimento a lápis no verso de cada foto.',
        required: true,
        assemblyOrder: 11,
    },
    {
        id: 'medical_receipt',
        category: 'medical_biometrics',
        label: 'Exame Médico (Form I-693)',
        labelEn: 'Medical Examination Receipt — Form I-693',
        emoji: '🩺',
        description: 'Foto do recibo do exame realizado com médico credenciado USCIS.',
        hint: 'Apenas a foto do recibo. Entregue o envelope lacrado fisicamente ao advogado — nunca abra.',
        required: true,
        assemblyOrder: 12,
    },
]

// ── Metadados de exibição por categoria ────────────────────
const CATEGORY_META: Record<DocumentCategory, { label: string; icon: string }> = {
    identification_travel: { label: 'Identificação e Viagem', icon: '🛂' },
    civil_documents:       { label: 'Documentos Civis',       icon: '📜' },
    immigration_base:      { label: 'Base da Imigração',      icon: '📋' },
    medical_biometrics:    { label: 'Médico e Biometria',     icon: '🩺' },
    fees_payments:         { label: 'Taxas e Pagamentos',     icon: '💳' },
}

// Categorias únicas em ordem de aparição no DOCS_CONFIG
const CATEGORIES = [...new Set(DOCS_CONFIG.map(d => d.category))]

// ── Avalia se todas as condições de um doc são satisfeitas ─
// Definida no módulo para não ser recriada a cada render.
function evaluateConditions(
    conditions: DocumentCondition[] | undefined,
    answers: ScreeningAnswers,
): boolean {
    if (!conditions || conditions.length === 0) return false
    return conditions.every(cond => {
        const val = answers[cond.field]
        switch (cond.operator) {
            case 'eq':     return val === cond.value
            case 'neq':    return val !== cond.value
            case 'gte':    return typeof val === 'number' && val >= (cond.value as number)
            case 'lte':    return typeof val === 'number' && val <= (cond.value as number)
            case 'exists': return val !== undefined && val !== null
            default:       return false
        }
    })
}

// ── Sub-componentes do Questionário de Triagem ─────────────

/** Linha de uma pergunta: label à esquerda, controle à direita */
function TriagemRow({ label, sub = false, last = false, children }: {
    label:    string
    sub?:     boolean
    last?:    boolean
    children: React.ReactNode
}) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 20,
            padding:      sub ? '10px 28px 10px 52px' : '16px 28px',
            borderBottom: last ? 'none' : '1px solid rgba(255,255,255,0.05)',
        }}>
            <span style={{
                fontSize: sub ? 13 : 14,
                fontWeight: sub ? 400 : 500,
                color: sub ? '#94a3b8' : '#cbd5e1',
            }}>
                {sub && <span style={{ marginRight: 6, opacity: 0.5 }}>↳</span>}
                {label}
            </span>
            {children}
        </div>
    )
}

/** Botões Sim / Não */
function TogglePair({ value, onChange }: {
    value:    boolean
    onChange: (v: boolean) => void
}) {
    const base: React.CSSProperties = {
        padding: '7px 20px', borderRadius: 8,
        fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none',
        transition: 'all 0.15s ease',
    }
    const active: React.CSSProperties = {
        ...base,
        background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
        color: '#fff',
        boxShadow: '0 2px 10px rgba(124,58,237,0.4)',
    }
    const inactive: React.CSSProperties = {
        ...base,
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        color: '#475569',
    }
    return (
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button style={value ? active : inactive} onClick={() => onChange(true)}>Sim</button>
            <button style={!value ? active : inactive} onClick={() => onChange(false)}>Não</button>
        </div>
    )
}

/** Estilo dos botões +/− do contador de filhos */
const stepBtnStyle: React.CSSProperties = {
    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
    background: 'rgba(139,92,246,0.15)',
    border: '1px solid rgba(139,92,246,0.3)',
    color: '#a78bfa', fontSize: 18, fontWeight: 700,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    lineHeight: 1,
}

// ══════════════════════════════════════════════════════════
// TIPOS INTERNOS
// ══════════════════════════════════════════════════════════
type DocPhase = 'idle' | 'uploading' | 'analyzing' | 'success' | 'error'

interface DocUploadState {
    phase:            DocPhase
    fileName?:        string
    fileSize?:        number
    fieldsExtracted?: number
    documentType?:    string
    errorMessage?:    string
}

// ══════════════════════════════════════════════════════════
// UTILITÁRIOS
// ══════════════════════════════════════════════════════════
function formatBytes(bytes: number, decimals = 1): string {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i]
}

// ══════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════
export default function UploadPage() {
    const supabase = createClient()

    // ── Respostas de triagem ────────────────────────────────
    const [answers, setAnswers] = useState<ScreeningAnswers>({
        isMarried:            false,
        hasChildren:          false,
        childrenCount:        0,
        hasPreviousMarriages: false,
        hasI140Approved:      true,
        hasI94Record:         true,
        hasCompletedMedical:  false,
        hasPaidI485Fee:       false,
        hasPaidBiometricsFee: false,
    })

    const setAnswer = <K extends keyof ScreeningAnswers>(key: K, value: ScreeningAnswers[K]) =>
        setAnswers(prev => ({ ...prev, [key]: value }))

    // ── Documentos visíveis com base nas respostas ──────────
    // Docs required:true → sempre visíveis.
    // Docs required:false → visíveis apenas se todas as conditions forem satisfeitas.
    const visibleDocs = useMemo<DocumentRequirement[]>(() =>
        DOCS_CONFIG.filter(doc =>
            doc.required || evaluateConditions(doc.conditions, answers)
        ),
        [answers]
    )

    // Estado por documento — chave = doc.id
    const [docStates, setDocStates] = useState<Record<string, DocUploadState>>(
        () => Object.fromEntries(DOCS_CONFIG.map(d => [d.id, { phase: 'idle' }]))
    )

    // Input de arquivo único compartilhado por todos os cards
    const fileInputRef   = useRef<HTMLInputElement>(null)
    const pendingDocRef  = useRef<string | null>(null)

    // Atualiza parcialmente o estado de um documento específico
    const updateDoc = (docId: string, patch: Partial<DocUploadState>) =>
        setDocStates(prev => ({ ...prev, [docId]: { ...prev[docId], ...patch } }))

    // Abre o seletor de arquivo apontando para um doc específico
    const triggerUpload = (docId: string) => {
        pendingDocRef.current = docId
        fileInputRef.current?.click()
    }

    // ── Pipeline completo para um arquivo + docId ──────────
    const processFileForDoc = useCallback(async (file: File, docId: string) => {
        const filePath = `uploads/${Date.now()}_${file.name}`

        updateDoc(docId, { phase: 'uploading', fileName: file.name, fileSize: file.size })

        // Etapa 1 — Upload para o Supabase Storage
        const { data: storageData, error: storageError } = await supabase.storage
            .from('bomjur-documents')
            .upload(filePath, file, { cacheControl: '3600', upsert: false })

        if (storageError) {
            updateDoc(docId, { phase: 'error', errorMessage: `Upload falhou: ${storageError.message}` })
            return
        }

        // Etapa 2 — URL pública
        const { data: { publicUrl } } = supabase.storage
            .from('bomjur-documents')
            .getPublicUrl(filePath)

        // Etapa 3 — Registro na tabela client_documents
        const { data: docRecord, error: dbError } = await supabase
            .from('client_documents')
            .insert({
                file_name:          file.name,
                file_path:          storageData.path,
                file_url:           publicUrl,
                file_size:          file.size,
                file_type:          file.type,
                bucket_name:        'bomjur-documents',
                processing_status:  'pending',
                document_category:  docId,    // ID canônico do tipo de documento
                uploaded_at:        new Date().toISOString(),
            })
            .select('id')
            .single()

        if (dbError || !docRecord) {
            updateDoc(docId, { phase: 'error', errorMessage: `Registro no banco falhou: ${dbError?.message}` })
            return
        }

        // Etapa 4 — Fase "Analisando com IA"
        updateDoc(docId, { phase: 'analyzing' })

        // Etapa 5 — Edge Function + polling de resultado
        const supabaseUrl    = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        const edgeFnUrl      = `${supabaseUrl}/functions/v1/process-document`

        let edgeError: string | null = null
        let fieldsExtracted = 0
        let documentType    = 'Documento'

        try {
            const response = await fetch(edgeFnUrl, {
                method: 'POST',
                headers: {
                    'Content-Type':  'application/json',
                    'Authorization': `Bearer ${supabaseAnonKey}`,
                    'apikey':        supabaseAnonKey,
                },
                body: JSON.stringify({ documentId: docRecord.id, filePath: storageData.path }),
            })

            if (!response.ok) {
                const errBody = await response.text()
                edgeError = `Análise falhou (${response.status}): ${errBody}`
            } else {
                // Edge Function retorna 202 — polling até a extração completar
                const POLL_INTERVAL_MS = 3000
                const POLL_TIMEOUT_MS  = 90000
                const deadline         = Date.now() + POLL_TIMEOUT_MS

                while (Date.now() < deadline) {
                    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))

                    const { data: doc } = await supabase
                        .from('client_documents')
                        .select('extraction_status, document_type, extraction_error')
                        .eq('id', docRecord.id)
                        .single()

                    if (!doc) continue

                    if (doc.extraction_status === 'extracted') {
                        const { count } = await supabase
                            .from('extracted_fields')
                            .select('id', { count: 'exact', head: true })
                            .eq('document_id', docRecord.id)
                        fieldsExtracted = count ?? 0
                        documentType    = doc.document_type ?? 'Documento'
                        break
                    }

                    if (doc.extraction_status === 'error') {
                        edgeError = doc.extraction_error ?? 'Erro desconhecido na extração.'
                        break
                    }
                }

                if (!edgeError && fieldsExtracted === 0) {
                    edgeError = 'Tempo limite atingido. O documento foi salvo, mas a análise não concluiu a tempo.'
                }
            }
        } catch (fetchErr) {
            edgeError = `Erro de rede ao chamar a análise: ${String(fetchErr)}`
        }

        // Etapa 6 — Status final
        if (edgeError) {
            updateDoc(docId, { phase: 'error', errorMessage: edgeError })
        } else {
            updateDoc(docId, { phase: 'success', fieldsExtracted, documentType })
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file  = e.target.files?.[0]
        const docId = pendingDocRef.current
        if (file && docId) processFileForDoc(file, docId)
        e.target.value  = ''
        pendingDocRef.current = null
    }

    // ── Contadores globais (baseados nos docs visíveis) ─────
    const visibleStates   = visibleDocs.map(d => docStates[d.id]).filter(Boolean)
    const analyzingCount  = visibleStates.filter(s => s.phase === 'analyzing').length
    const successCount    = visibleStates.filter(s => s.phase === 'success').length
    const errorCount      = visibleStates.filter(s => s.phase === 'error').length
    const totalRequired   = visibleDocs.filter(d => d.required).length
    const doneRequired    = visibleDocs.filter(d => d.required && docStates[d.id]?.phase === 'success').length
    const progressPercent = totalRequired === 0 ? 0 : Math.round((doneRequired / totalRequired) * 100)

    // ── Renderização de cada card de documento ─────────────
    const renderCard = (doc: DocumentRequirement) => {
        const state  = docStates[doc.id] ?? { phase: 'idle' }
        const { phase } = state
        const isActive  = phase === 'uploading' || phase === 'analyzing'

        const cardBg = phase === 'success'   ? 'rgba(16,185,129,0.07)'
                     : phase === 'error'     ? 'rgba(239,68,68,0.06)'
                     : phase === 'analyzing' ? 'rgba(139,92,246,0.08)'
                     : 'rgba(255,255,255,0.04)'

        const cardBorder = phase === 'success'   ? 'rgba(16,185,129,0.3)'
                         : phase === 'error'     ? 'rgba(239,68,68,0.3)'
                         : phase === 'analyzing' ? 'rgba(139,92,246,0.4)'
                         : 'rgba(255,255,255,0.08)'

        return (
            <div
                key={doc.id}
                style={{
                    background:    cardBg,
                    border:        `1px solid ${cardBorder}`,
                    borderRadius:  16,
                    padding:       '18px 20px',
                    display:       'flex',
                    flexDirection: 'column',
                    gap:           12,
                    transition:    'all 0.25s ease',
                }}
            >
                {/* ── Cabeçalho do card ── */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    {/* Ícone de estado */}
                    <div style={{
                        width: 44, height: 44, flexShrink: 0, borderRadius: 12, fontSize: 22,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: phase === 'success'   ? 'rgba(16,185,129,0.2)'
                                  : phase === 'error'     ? 'rgba(239,68,68,0.15)'
                                  : 'rgba(139,92,246,0.15)',
                    }}>
                        {phase === 'success' ? '✅' : phase === 'error' ? '❌' : doc.emoji}
                    </div>

                    {/* Título + badge + labelEn */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.3 }}>
                                {doc.label}
                            </span>
                            <span style={{
                                fontSize: 9, fontWeight: 800, flexShrink: 0,
                                padding: '2px 8px', borderRadius: 99,
                                textTransform: 'uppercase', letterSpacing: '0.05em',
                                background: doc.required ? 'rgba(99,102,241,0.2)' : 'rgba(100,116,139,0.15)',
                                color:      doc.required ? '#818cf8' : '#64748b',
                            }}>
                                {doc.required ? 'Obrigatório' : 'Opcional'}
                            </span>
                        </div>
                        <span style={{ fontSize: 11, color: '#475569', display: 'block', marginTop: 3 }}>
                            {doc.labelEn}
                        </span>
                    </div>
                </div>

                {/* ── Descrição ── */}
                <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
                    {doc.description}
                </p>

                {/* ── Hint / aviso especial ── */}
                {doc.hint && (
                    <div style={{
                        background: 'rgba(245,158,11,0.08)',
                        border: '1px solid rgba(245,158,11,0.2)',
                        borderRadius: 8, padding: '8px 12px',
                        fontSize: 11, color: '#fbbf24', lineHeight: 1.55,
                    }}>
                        ⚠️ {doc.hint}
                    </div>
                )}

                {/* ── Área de ação / status ── */}
                <div style={{ marginTop: 'auto' }}>

                    {/* IDLE — botão de upload */}
                    {phase === 'idle' && (
                        <button
                            onClick={() => triggerUpload(doc.id)}
                            style={{
                                width: '100%', padding: '10px 16px',
                                background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                                color: '#fff', border: 'none', borderRadius: 10,
                                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                                boxShadow: '0 2px 12px rgba(124,58,237,0.3)',
                                transition: 'opacity 0.2s, transform 0.15s',
                            }}
                            onMouseEnter={e => {
                                ;(e.currentTarget as HTMLElement).style.opacity = '0.88'
                                ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'
                            }}
                            onMouseLeave={e => {
                                ;(e.currentTarget as HTMLElement).style.opacity = '1'
                                ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
                            }}
                        >
                            ⬆️ Enviar Arquivo
                        </button>
                    )}

                    {/* UPLOADING / ANALYZING — barra animada */}
                    {isActive && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span className="spinner sm purple" />
                                <span style={{ fontSize: 12, color: '#a78bfa', fontWeight: 600 }}>
                                    {phase === 'uploading' ? 'Enviando arquivo...' : '🤖 Analisando com IA...'}
                                </span>
                            </div>
                            {state.fileName && (
                                <span style={{ fontSize: 11, color: '#475569' }}>
                                    {state.fileName}
                                    {state.fileSize ? ` · ${formatBytes(state.fileSize)}` : ''}
                                </span>
                            )}
                            <div className="progress-bar">
                                <div className={`progress-fill ${phase === 'analyzing' ? 'fill-purple' : 'fill-indigo'}`} />
                            </div>
                        </div>
                    )}

                    {/* SUCCESS */}
                    {phase === 'success' && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                            <div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#34d399' }}>
                                    ✓ {state.fieldsExtracted ?? 0} campos extraídos
                                </div>
                                {state.fileName && (
                                    <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                                        {state.fileName}
                                    </div>
                                )}
                            </div>
                            {/* Substituir: atualiza estado e abre input diretamente */}
                            <button
                                onClick={() => {
                                    updateDoc(doc.id, { phase: 'idle' })
                                    pendingDocRef.current = doc.id
                                    fileInputRef.current?.click()
                                }}
                                style={{
                                    padding: '6px 12px', borderRadius: 8, flexShrink: 0,
                                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                                    color: '#94a3b8', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                }}
                            >
                                Substituir
                            </button>
                        </div>
                    )}

                    {/* ERROR */}
                    {phase === 'error' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ fontSize: 12, color: '#f87171', lineHeight: 1.4 }}>
                                ✕ {state.errorMessage ?? 'Erro no processamento'}
                            </div>
                            <button
                                onClick={() => updateDoc(doc.id, { phase: 'idle', errorMessage: undefined })}
                                style={{
                                    padding: '7px 14px', borderRadius: 8, alignSelf: 'flex-start',
                                    background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                                    color: '#f87171', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                }}
                            >
                                Tentar Novamente
                            </button>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // ══════════════════════════════════════════════════════════
    // RENDER
    // ══════════════════════════════════════════════════════════
    return (
        <div className="upload-page">

            {/* Input de arquivo único — disparado por qualquer card */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                style={{ display: 'none' }}
                onChange={onInputChange}
            />

            {/* ── HEADER ── */}
            <header className="header">
                <div className="header-inner">
                    <div className="logo-area">
                        <span className="logo-icon">⚖️</span>
                        <div>
                            <h1 className="logo-title">Bomjur</h1>
                            <p className="logo-sub">Immigration Platform</p>
                        </div>
                    </div>
                    <nav className="nav-pills">
                        <span className="nav-pill active">Upload</span>
                        <span className="nav-pill">Documentos</span>
                        <span className="nav-pill">Status</span>
                    </nav>
                </div>
            </header>

            {/* ── MAIN ── */}
            <main className="main">

                {/* ── Cabeçalho + Stats ── */}
                <div className="section-header">
                    <div>
                        <h2 className="section-title">Documentos do I-485</h2>
                        <p className="section-desc">
                            Clique em "Enviar Arquivo" em cada card. Nossa IA (Claude Vision)
                            extrai automaticamente todos os campos necessários para o formulário.
                        </p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
                        <div style={{
                            fontSize: 26, fontWeight: 900, lineHeight: 1,
                            color: doneRequired === totalRequired ? '#34d399' : '#f1f5f9',
                        }}>
                            {doneRequired}/{totalRequired}
                            <span style={{ fontSize: 13, fontWeight: 500, color: '#64748b', marginLeft: 8 }}>
                                obrigatórios
                            </span>
                        </div>

                        <div className="stats-row">
                            {analyzingCount > 0 && (
                                <div className="stat-chip purple">
                                    <span className="spinner sm purple" /> {analyzingCount} analisando
                                </div>
                            )}
                            {successCount > 0 && (
                                <div className="stat-chip green">
                                    ✓ {successCount} concluído{successCount !== 1 ? 's' : ''}
                                </div>
                            )}
                            {errorCount > 0 && (
                                <div className="stat-chip red">✕ {errorCount} com erro</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Barra de progresso global ── */}
                <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 99, height: 6, overflow: 'hidden' }}>
                    <div style={{
                        height: '100%',
                        width: `${progressPercent}%`,
                        background: 'linear-gradient(90deg, #4f46e5, #7c3aed, #a78bfa)',
                        borderRadius: 99,
                        transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: progressPercent > 0 ? '0 0 10px rgba(167,139,250,0.5)' : 'none',
                    }} />
                </div>

                {/* ── Pipeline visual ── */}
                <div className="pipeline-row">
                    {[
                        { icon: '⬆️', label: 'Upload Seguro',  desc: 'Arquivo enviado com criptografia AES-256' },
                        { icon: '🧠', label: 'Claude Vision',  desc: 'IA analisa e extrai campos automaticamente' },
                        { icon: '🗄️', label: 'Banco de Dados', desc: 'Campos salvos com confidence scores' },
                    ].map((step, i) => (
                        <div key={step.label} className="pipeline-step">
                            <div className="pipeline-icon">{step.icon}</div>
                            <div className="pipeline-info">
                                <p className="pipeline-label">{step.label}</p>
                                <p className="pipeline-desc">{step.desc}</p>
                            </div>
                            {i < 2 && <div className="pipeline-arrow">→</div>}
                        </div>
                    ))}
                </div>

                {/* ══════════════════════════════════════════════════
                    QUESTIONÁRIO DE TRIAGEM
                    Filtra visibleDocs dinamicamente via answers + conditions
                ══════════════════════════════════════════════════ */}
                <div style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.09)',
                    borderRadius: 20,
                    overflow: 'hidden',
                }}>
                    {/* Cabeçalho */}
                    <div style={{
                        padding: '20px 28px',
                        borderBottom: '1px solid rgba(255,255,255,0.07)',
                        display: 'flex', alignItems: 'center', gap: 14,
                    }}>
                        <div style={{
                            width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                            background: 'rgba(139,92,246,0.18)',
                            border: '1px solid rgba(139,92,246,0.3)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 20,
                        }}>🎯</div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>
                                Questionário de Triagem
                            </h3>
                            <p style={{ margin: '3px 0 0', fontSize: 12, color: '#64748b' }}>
                                Responda para que sua lista de documentos seja personalizada automaticamente.
                            </p>
                        </div>
                        {/* Badge: total de docs visíveis */}
                        <div style={{
                            marginLeft: 'auto', flexShrink: 0,
                            background: 'rgba(139,92,246,0.15)',
                            border: '1px solid rgba(139,92,246,0.3)',
                            borderRadius: 99, padding: '6px 14px',
                            fontSize: 13, fontWeight: 700, color: '#a78bfa',
                            whiteSpace: 'nowrap',
                        }}>
                            📋 {visibleDocs.length} documentos
                        </div>
                    </div>

                    {/* Perguntas */}
                    <div style={{ padding: '8px 0' }}>

                        {/* ── Pergunta: casado(a)? ── */}
                        <TriagemRow label="Você é casado(a) atualmente?">
                            <TogglePair
                                value={answers.isMarried}
                                onChange={v => setAnswer('isMarried', v)}
                            />
                        </TriagemRow>

                        {/* ── Pergunta: filhos no processo? ── */}
                        <TriagemRow label="Tem filhos incluídos no processo?">
                            <TogglePair
                                value={answers.hasChildren}
                                onChange={v => {
                                    setAnswer('hasChildren', v)
                                    if (!v) setAnswer('childrenCount', 0)
                                    else if (answers.childrenCount === 0) setAnswer('childrenCount', 1)
                                }}
                            />
                        </TriagemRow>

                        {/* Sub-pergunta: quantos filhos? (aparece só se hasChildren) */}
                        {answers.hasChildren && (
                            <TriagemRow label="Quantos filhos?" sub>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <button
                                        onClick={() => setAnswer('childrenCount', Math.max(1, answers.childrenCount - 1))}
                                        style={stepBtnStyle}
                                    >−</button>
                                    <span style={{ fontSize: 18, fontWeight: 800, color: '#e2e8f0', minWidth: 24, textAlign: 'center' }}>
                                        {answers.childrenCount}
                                    </span>
                                    <button
                                        onClick={() => setAnswer('childrenCount', Math.min(6, answers.childrenCount + 1))}
                                        style={stepBtnStyle}
                                    >+</button>
                                </div>
                            </TriagemRow>
                        )}

                        {/* ── Pergunta: casamentos anteriores? ── */}
                        <TriagemRow label="Tem casamentos anteriores (divórcio ou viuvez)?" last>
                            <TogglePair
                                value={answers.hasPreviousMarriages}
                                onChange={v => setAnswer('hasPreviousMarriages', v)}
                            />
                        </TriagemRow>
                    </div>

                    {/* Rodapé informativo */}
                    <div style={{
                        padding: '14px 28px',
                        borderTop: '1px solid rgba(255,255,255,0.07)',
                        background: 'rgba(0,0,0,0.15)',
                        display: 'flex', alignItems: 'center', gap: 10,
                        flexWrap: 'wrap',
                    }}>
                        <span style={{ fontSize: 12, color: '#475569' }}>
                            Documentos ativos:
                        </span>
                        {visibleDocs.map(doc => (
                            <span key={doc.id} style={{
                                fontSize: 11, padding: '3px 10px', borderRadius: 99,
                                background: doc.required ? 'rgba(99,102,241,0.15)' : 'rgba(139,92,246,0.1)',
                                color:      doc.required ? '#818cf8' : '#a78bfa',
                                border: `1px solid ${doc.required ? 'rgba(99,102,241,0.25)' : 'rgba(139,92,246,0.2)'}`,
                                fontWeight: 600,
                            }}>
                                {doc.emoji} {doc.label}
                            </span>
                        ))}
                    </div>
                </div>

                {/* ══════════════════════════════════════════════════
                    CATEGORIAS DE DOCUMENTOS — renderizadas via .map()
                    sobre visibleDocs e CATEGORIES
                ══════════════════════════════════════════════════ */}
                {CATEGORIES.map(cat => {
                    const meta     = CATEGORY_META[cat]
                    const catDocs  = visibleDocs.filter(d => d.category === cat)
                    const catDone  = catDocs.filter(d => docStates[d.id]?.phase === 'success').length
                    const allDone  = catDone === catDocs.length

                    return (
                        <section key={cat}>
                            {/* Cabeçalho da categoria */}
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
                            }}>
                                <span style={{ fontSize: 20 }}>{meta.icon}</span>
                                <h3 style={{
                                    margin: 0, fontSize: 15, fontWeight: 700,
                                    color: allDone ? '#34d399' : '#cbd5e1',
                                    transition: 'color 0.4s',
                                }}>
                                    {meta.label}
                                </h3>
                                <span style={{
                                    marginLeft: 'auto', fontSize: 11, fontWeight: 800,
                                    padding: '3px 10px', borderRadius: 99,
                                    background: allDone ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)',
                                    color:      allDone ? '#34d399' : '#64748b',
                                    transition: 'all 0.4s',
                                }}>
                                    {catDone}/{catDocs.length}
                                </span>
                            </div>

                            {/* Grid de cards — renderizado via .map() sobre DOCS_CONFIG filtrado */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                                gap: 14,
                            }}>
                                {catDocs.map(renderCard)}
                            </div>
                        </section>
                    )
                })}
            </main>

            {/* ── ESTILOS ── */}
            <style>{`
                * { box-sizing: border-box; margin: 0; padding: 0; }

                .upload-page {
                    min-height: 100vh;
                    background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
                    font-family: 'Inter', system-ui, sans-serif;
                    color: #e2e8f0;
                }

                /* HEADER */
                .header {
                    background: rgba(255,255,255,0.04);
                    backdrop-filter: blur(20px);
                    border-bottom: 1px solid rgba(255,255,255,0.08);
                    position: sticky; top: 0; z-index: 100;
                }
                .header-inner {
                    max-width: 1100px; margin: 0 auto;
                    padding: 0 24px; height: 64px;
                    display: flex; align-items: center; justify-content: space-between;
                }
                .logo-area { display: flex; align-items: center; gap: 12px; }
                .logo-icon { font-size: 28px; }
                .logo-title {
                    font-size: 20px; font-weight: 700;
                    background: linear-gradient(90deg, #a78bfa, #818cf8);
                    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                }
                .logo-sub { font-size: 11px; color: #94a3b8; margin-top: 1px; }
                .nav-pills { display: flex; gap: 8px; }
                .nav-pill {
                    padding: 6px 16px; border-radius: 999px;
                    font-size: 13px; color: #94a3b8; cursor: pointer; transition: all 0.2s;
                }
                .nav-pill:hover  { color: #e2e8f0; background: rgba(255,255,255,0.06); }
                .nav-pill.active { background: rgba(139,92,246,0.2); color: #a78bfa; border: 1px solid rgba(139,92,246,0.4); }

                /* MAIN */
                .main {
                    max-width: 1100px; margin: 0 auto;
                    padding: 48px 24px 100px;
                    display: flex; flex-direction: column; gap: 32px;
                }

                /* SECTION HEADER */
                .section-header {
                    display: flex; align-items: flex-start;
                    justify-content: space-between; flex-wrap: wrap; gap: 20px;
                }
                .section-title { font-size: 28px; font-weight: 700; color: #f1f5f9; }
                .section-desc  { margin-top: 8px; font-size: 15px; color: #94a3b8; max-width: 560px; line-height: 1.6; }
                .stats-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
                .stat-chip {
                    display: flex; align-items: center; gap: 6px;
                    padding: 6px 14px; border-radius: 999px;
                    font-size: 13px; font-weight: 600;
                }
                .stat-chip.green  { background: rgba(16,185,129,0.15);  color: #34d399; border: 1px solid rgba(16,185,129,0.3); }
                .stat-chip.red    { background: rgba(239,68,68,0.15);   color: #f87171; border: 1px solid rgba(239,68,68,0.3); }
                .stat-chip.purple { background: rgba(139,92,246,0.15);  color: #a78bfa; border: 1px solid rgba(139,92,246,0.3); display: flex; align-items: center; gap: 6px; }

                /* PIPELINE */
                .pipeline-row {
                    display: flex; align-items: center;
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.07);
                    border-radius: 16px; padding: 18px 24px;
                    flex-wrap: wrap; gap: 8px;
                }
                .pipeline-step  { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 200px; }
                .pipeline-icon  { font-size: 26px; flex-shrink: 0; }
                .pipeline-info  { flex: 1; }
                .pipeline-label { font-size: 13px; font-weight: 700; color: #e2e8f0; }
                .pipeline-desc  { font-size: 11px; color: #64748b; margin-top: 2px; }
                .pipeline-arrow { font-size: 20px; color: #4b5563; padding: 0 16px; }

                /* PROGRESS BAR */
                .progress-bar {
                    width: 100%; height: 3px;
                    background: rgba(255,255,255,0.08);
                    border-radius: 999px; overflow: hidden;
                }
                .progress-fill {
                    height: 100%; border-radius: 999px;
                    animation: progress-anim 1.6s ease-in-out infinite;
                }
                .fill-indigo { background: linear-gradient(90deg, #4f46e5, #818cf8); }
                .fill-purple { background: linear-gradient(90deg, #7c3aed, #c084fc); }
                @keyframes progress-anim {
                    0%   { width: 5%;  margin-left: 0;   }
                    50%  { width: 60%; margin-left: 30%;  }
                    100% { width: 5%;  margin-left: 95%; }
                }

                /* SPINNER */
                .spinner {
                    display: inline-block; width: 16px; height: 16px;
                    border: 2px solid rgba(255,255,255,0.3);
                    border-top-color: #fff;
                    border-radius: 50%;
                    animation: spin 0.7s linear infinite;
                }
                .spinner.sm { width: 11px; height: 11px; border-width: 1.5px; border-color: rgba(129,140,248,0.3); border-top-color: #818cf8; }
                .spinner.sm.purple { border-color: rgba(167,139,250,0.3); border-top-color: #a78bfa; }
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    )
}

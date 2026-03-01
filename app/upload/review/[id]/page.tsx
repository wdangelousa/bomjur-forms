'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

// ─── Supabase ─────────────────────────────────────────────────────────────────
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface ExtractedField {
    id: string
    field_key: string
    field_value: string | null
    confidence: number
    review_status: string | null
    corrected_value: string | null
    maps_to_i140_field: string | null
    maps_to_i485_field: string | null
    maps_to_i485_mission: number | null
}

interface Document {
    id: string
    file_name: string
    file_path: string
    file_url: string
    mime_type: string
    document_type: string | null
    document_type_confidence: number | null
    extraction_status: string
    client_id: string | null
}

interface LocalField extends ExtractedField {
    editedValue: string
    isDirty: boolean
}

// ─── Confidence helpers ───────────────────────────────────────────────────────
function confidenceTier(score: number): 'green' | 'yellow' | 'red' | 'grey' {
    if (score >= 0.95) return 'green'
    if (score >= 0.70) return 'yellow'
    if (score >= 0.40) return 'red'
    return 'grey'
}

const TIER_STYLES = {
    green: { border: '#22c55e', bg: 'rgba(34,197,94,0.07)', label: '✓ Verificado', labelColor: '#22c55e' },
    yellow: { border: '#f59e0b', bg: 'rgba(245,158,11,0.07)', label: '⚠ Confirme este dado', labelColor: '#f59e0b' },
    red: { border: '#ef4444', bg: 'rgba(239,68,68,0.07)', label: '✕ Preenchimento necessário', labelColor: '#ef4444' },
    grey: { border: '#475569', bg: 'rgba(71,85,105,0.07)', label: '○ Insira manualmente', labelColor: '#94a3b8' },
}

function badge(color: string): React.CSSProperties {
    return {
        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
        background: `${color}18`, color, border: `1px solid ${color}40`,
    }
}

function friendlyLabel(key: string) {
    const map: Record<string, string> = {
        nome_completo: 'Nome Completo', data_nascimento: 'Data de Nascimento',
        numero_documento: 'Número do Documento', data_emissao: 'Data de Emissão',
        data_validade: 'Data de Validade', nacionalidade: 'Nacionalidade',
        numero_visto: 'Número do Visto', tipo_visto: 'Tipo de Visto',
        orgao_emissor: 'Órgão Emissor', cpf: 'CPF', passaporte_numero: 'Passaporte Nº',
        sexo: 'Sexo', naturalidade: 'Naturalidade', estado_civil: 'Estado Civil',
        profissao: 'Profissão', endereco: 'Endereço', cidade: 'Cidade',
        estado: 'Estado', cep: 'CEP', pais: 'País',
    }
    return map[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ReviewPage() {
    const { id } = useParams<{ id: string }>()
    const router = useRouter()

    const [doc, setDoc] = useState<Document | null>(null)
    const [fields, setFields] = useState<LocalField[]>([])
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // ── Carrega documento + campos via API route (service role key) ────────────
    useEffect(() => {
        if (!id) return

        const load = async () => {
            setLoading(true)
            setError(null)

            const res = await fetch(`/api/documents/${id}`)
            if (!res.ok) {
                setError('Documento não encontrado.')
                setLoading(false)
                return
            }

            const { doc: docData, previewUrl: pUrl, fields: rawFields } = await res.json()

            setDoc(docData as Document)
            if (pUrl) setPreviewUrl(pUrl)

            const local: LocalField[] = (rawFields ?? []).map((f: ExtractedField) => ({
                ...f,
                editedValue: f.corrected_value ?? f.field_value ?? '',
                isDirty: false,
            }))
            setFields(local)
            setLoading(false)
        }

        load()
    }, [id])

    // ── Edição local de um campo ───────────────────────────────────────────────
    const handleEdit = (fieldId: string, value: string) => {
        setFields(prev => prev.map(f =>
            f.id === fieldId ? { ...f, editedValue: value, isDirty: true } : f
        ))
    }

    // ── Confirmar todos os dados ───────────────────────────────────────────────
    const handleConfirm = useCallback(async () => {
        if (!doc) return
        setSaving(true)

        // 1. Atualiza extracted_fields para cada campo
        const updates = fields.map(f => supabase
            .from('extracted_fields')
            .update({
                review_status: 'confirmed',
                corrected_value: f.editedValue !== f.field_value ? f.editedValue : null,
            })
            .eq('id', f.id)
        )
        await Promise.all(updates)

        // 2. Se tem maps_to_i140_field → salva em i140_answers (busca petition pelo client)
        const i140Fields = fields.filter(f => f.maps_to_i140_field)
        if (i140Fields.length > 0 && doc.client_id) {
            const { data: petition } = await supabase
                .from('i140_petitions')
                .select('id')
                .eq('client_id', doc.client_id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single()

            if (petition) {
                const rows = i140Fields.map(f => ({
                    petition_id: petition.id,
                    section: 'document_extraction',
                    field_key: f.maps_to_i140_field!,
                    field_value: f.editedValue,
                    source: 'ai_extraction',
                    source_document_id: doc.id,
                    source_confidence: f.confidence,
                    was_manually_confirmed: true,
                }))
                await supabase.from('i140_answers').upsert(rows, { onConflict: 'petition_id,field_key' })
            }
        }

        // 3. Se tem maps_to_i485_field → salva em application_answers
        const i485Fields = fields.filter(f => f.maps_to_i485_field)
        if (i485Fields.length > 0 && doc.client_id) {
            const { data: application } = await supabase
                .from('i485_applications')
                .select('id')
                .eq('client_id', doc.client_id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single()

            if (application) {
                const rows = i485Fields.map(f => ({
                    application_id: application.id,
                    mission_number: f.maps_to_i485_mission ?? 1,
                    field_key: f.maps_to_i485_field!,
                    field_value: f.editedValue,
                    source: 'ai_extraction',
                    source_document_id: doc.id,
                    source_confidence: f.confidence,
                    client_confirmed: true,
                    client_confirmed_at: new Date().toISOString(),
                }))
                await supabase.from('application_answers').upsert(rows, { onConflict: 'application_id,field_key' })
            }
        }

        setSaving(false)
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
    }, [doc, fields])

    // ── Métricas de progresso ──────────────────────────────────────────────────
    const total = fields.length
    const confirmed = fields.filter(f => f.review_status === 'confirmed' || f.isDirty).length
    const greenCt = fields.filter(f => confidenceTier(f.confidence) === 'green').length
    const pct = total > 0 ? Math.round((confirmed / total) * 100) : 0

    const isPdf = doc?.mime_type === 'application/pdf' || doc?.file_path?.endsWith('.pdf')

    // ─── Render ───────────────────────────────────────────────────────────────
    if (loading) return (
        <div style={S.page}>
            <div style={S.loadingCenter}>
                <div style={S.spinnerLg} />
                <p style={{ color: '#94a3b8', marginTop: 16 }}>Carregando documento...</p>
            </div>
        </div>
    )

    if (error) return (
        <div style={S.page}>
            <div style={S.loadingCenter}>
                <p style={{ color: '#f87171', fontSize: 16 }}>❌ {error}</p>
                <button style={S.backBtn} onClick={() => router.push('/')}>← Voltar</button>
            </div>
        </div>
    )

    return (
        <div style={S.page}>
            {/* ── HEADER ── */}
            <header style={S.header}>
                <div style={S.headerInner}>
                    <div style={S.logoArea}>
                        <span style={{ fontSize: 26 }}>⚖️</span>
                        <div>
                            <h1 style={S.logoTitle}>Bomjur</h1>
                            <p style={S.logoSub}>Revisão de Documento</p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        {/* Barra de progresso */}
                        <div style={S.progressWrap}>
                            <div style={S.progressMeta}>
                                <span style={{ fontSize: 12, color: '#94a3b8' }}>Missão: Revisão de Extração</span>
                                <span style={{ fontSize: 12, color: '#a78bfa', fontWeight: 700 }}>{pct}%</span>
                            </div>
                            <div style={S.progressBar}>
                                <div style={{ ...S.progressFill, width: `${pct}%` }} />
                            </div>
                            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                                <span style={badge('#22c55e')}>✓ {greenCt} auto</span>
                                <span style={badge('#a78bfa')}>{confirmed}/{total} revisados</span>
                            </div>
                        </div>

                        <button
                            style={{ ...S.confirmBtn, opacity: saving ? 0.7 : 1 }}
                            onClick={handleConfirm}
                            disabled={saving}
                        >
                            {saving ? '⟳ Salvando...' : saved ? '✓ Salvo!' : '✓ Confirmar Dados'}
                        </button>
                    </div>
                </div>
            </header>

            {/* ── DOC INFO STRIP ── */}
            <div style={S.docStrip}>
                <div style={S.docChip}>
                    <span>{isPdf ? '📄' : '🖼️'}</span>
                    <span style={{ fontWeight: 600, color: '#e2e8f0' }}>{doc?.file_name}</span>
                </div>
                {doc?.document_type && (
                    <div style={S.docChip}>
                        <span>🔍</span>
                        <span style={{ color: '#a78bfa' }}>{doc.document_type}</span>
                        {doc.document_type_confidence && (
                            <span style={{ fontSize: 11, color: '#64748b' }}>
                                ({Math.round(doc.document_type_confidence * 100)}% conf.)
                            </span>
                        )}
                    </div>
                )}
                <div style={{ ...S.docChip, marginLeft: 'auto' }}>
                    <span style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: doc?.extraction_status === 'extracted' ? '#22c55e' : '#f59e0b',
                        display: 'inline-block'
                    }} />
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>{doc?.extraction_status}</span>
                </div>
            </div>

            {/* ── SPLIT VIEW ── */}
            <div style={S.splitView}>

                {/* Coluna Esquerda — Preview */}
                <div style={S.previewCol}>
                    <div style={S.panelHeader}>
                        <span style={S.panelIcon}>👁️</span>
                        <span style={S.panelTitle}>Documento Original</span>
                    </div>
                    <div style={S.previewBox}>
                        {previewUrl ? (
                            isPdf
                                ? <iframe src={previewUrl} style={S.iframe} title="Documento" />
                                : <img src={previewUrl} style={S.imgPreview} alt="Documento" />
                        ) : (
                            <div style={S.noPreview}>
                                <span style={{ fontSize: 40 }}>📄</span>
                                <p style={{ color: '#64748b', marginTop: 12 }}>Preview não disponível</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Coluna Direita — Campos */}
                <div style={S.fieldsCol}>
                    <div style={S.panelHeader}>
                        <span style={S.panelIcon}>🧠</span>
                        <span style={S.panelTitle}>Campos Extraídos pela IA</span>
                        <div style={S.legend}>
                            {(['green', 'yellow', 'red', 'grey'] as const).map(t => (
                                <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: TIER_STYLES[t].labelColor }}>
                                    <span style={{ width: 8, height: 8, borderRadius: 2, background: TIER_STYLES[t].border, display: 'inline-block' }} />
                                    {t === 'green' ? '≥95%' : t === 'yellow' ? '70-94%' : t === 'red' ? '40-69%' : '<40%'}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div style={S.fieldsList}>
                        {fields.length === 0 && (
                            <div style={S.emptyFields}>
                                <span style={{ fontSize: 32 }}>🤖</span>
                                <p style={{ color: '#64748b', marginTop: 8 }}>Nenhum campo extraído ainda.</p>
                            </div>
                        )}

                        {fields.map(field => {
                            const tier = confidenceTier(field.confidence)
                            const style = TIER_STYLES[tier]
                            const pctConf = Math.round(field.confidence * 100)
                            const isConfirmed = field.review_status === 'confirmed'

                            return (
                                <div
                                    key={field.id}
                                    style={{
                                        border: `1.5px solid ${isConfirmed ? '#22c55e' : style.border}`,
                                        background: isConfirmed ? 'rgba(34,197,94,0.06)' : style.bg,
                                        borderRadius: 12, padding: '14px 16px', marginBottom: 10,
                                        transition: 'all 0.2s',
                                    }}
                                >
                                    {/* Campo header */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                            {friendlyLabel(field.field_key)}
                                        </span>
                                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                            {/* Confidence badge */}
                                            <span style={{
                                                fontSize: 10, fontWeight: 700, padding: '2px 7px',
                                                borderRadius: 999, background: style.bg,
                                                color: style.labelColor, border: `1px solid ${style.border}`,
                                            }}>
                                                {pctConf}%
                                            </span>
                                            {isConfirmed && <span style={{ fontSize: 13, color: '#22c55e' }}>✓</span>}
                                        </div>
                                    </div>

                                    {/* Input */}
                                    {tier === 'green' && !field.isDirty ? (
                                        // Campo verde sem edição: exibe o valor com check e permite clicar para editar
                                        <div
                                            style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'text' }}
                                            onClick={() => handleEdit(field.id, field.editedValue)}
                                        >
                                            <span style={{ fontSize: 15, color: '#e2e8f0', fontWeight: 500, flex: 1 }}>
                                                {field.editedValue || '—'}
                                            </span>
                                            <span style={{ fontSize: 18, color: '#22c55e' }}>✓</span>
                                        </div>
                                    ) : (
                                        <input
                                            value={field.editedValue}
                                            onChange={e => handleEdit(field.id, e.target.value)}
                                            placeholder={tier === 'grey' ? 'Digite o valor manualmente...' : 'Edite se necessário...'}
                                            style={{
                                                width: '100%', background: 'rgba(0,0,0,0.2)', border: 'none',
                                                outline: 'none', color: '#f1f5f9', fontSize: 15, fontWeight: 500,
                                                padding: '4px 0', fontFamily: 'inherit',
                                                borderBottom: `1px solid ${style.border}40`,
                                            }}
                                        />
                                    )}

                                    {/* Label de status */}
                                    {!isConfirmed && (
                                        <p style={{ fontSize: 11, color: style.labelColor, marginTop: 6 }}>
                                            {style.label}
                                        </p>
                                    )}

                                    {/* Onde esse campo vai ser salvo */}
                                    {(field.maps_to_i140_field || field.maps_to_i485_field) && (
                                        <p style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>
                                            📌 {field.maps_to_i140_field ? `I-140: ${field.maps_to_i140_field}` : ''}
                                            {field.maps_to_i140_field && field.maps_to_i485_field ? ' · ' : ''}
                                            {field.maps_to_i485_field ? `I-485: ${field.maps_to_i485_field}` : ''}
                                        </p>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* ── ESTILOS GLOBAIS ── */}
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
        </div>
    )
}

// ─── Estilos ─────────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
    page: {
        minHeight: '100vh',
        background: 'linear-gradient(135deg,#0f0c29 0%,#302b63 50%,#24243e 100%)',
        fontFamily: "'Inter', system-ui, sans-serif",
        color: '#e2e8f0',
        display: 'flex',
        flexDirection: 'column',
    },
    loadingCenter: {
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        flex: 1, minHeight: '100vh',
    },
    spinnerLg: {
        width: 40, height: 40,
        border: '3px solid rgba(167,139,250,0.2)',
        borderTopColor: '#a78bfa',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
    },
    header: {
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        position: 'sticky', top: 0, zIndex: 100,
        flexShrink: 0,
    },
    headerInner: {
        maxWidth: 1400, margin: '0 auto',
        padding: '0 24px', height: 68,
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: 20,
    },
    logoArea: { display: 'flex', alignItems: 'center', gap: 12 },
    logoTitle: {
        fontSize: 18, fontWeight: 700,
        background: 'linear-gradient(90deg,#a78bfa,#818cf8)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
    },
    logoSub: { fontSize: 11, color: '#94a3b8' },
    progressWrap: { minWidth: 220 },
    progressMeta: { display: 'flex', justifyContent: 'space-between', marginBottom: 4 },
    progressBar: { height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden' },
    progressFill: { height: '100%', background: 'linear-gradient(90deg,#7c3aed,#a78bfa)', borderRadius: 999, transition: 'width 0.4s ease' },
    confirmBtn: {
        padding: '10px 22px',
        background: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
        color: '#fff', fontWeight: 700, fontSize: 13,
        border: 'none', borderRadius: 10, cursor: 'pointer',
        boxShadow: '0 4px 20px rgba(124,58,237,0.4)',
        whiteSpace: 'nowrap', transition: 'all 0.2s',
    },
    backBtn: {
        marginTop: 16, padding: '8px 20px',
        background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
        color: '#94a3b8', borderRadius: 8, cursor: 'pointer', fontSize: 13,
    },
    docStrip: {
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '8px 24px',
        background: 'rgba(255,255,255,0.02)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        flexShrink: 0,
    },
    docChip: {
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 13, color: '#94a3b8',
    },
    splitView: {
        flex: 1, display: 'flex',
        maxWidth: 1400, margin: '0 auto', width: '100%',
        padding: '24px', gap: 20,
        alignItems: 'flex-start',
    },
    previewCol: {
        flex: '0 0 48%', maxWidth: '48%',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 16, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        position: 'sticky', top: 88,
    },
    fieldsCol: {
        flex: 1, display: 'flex', flexDirection: 'column',
    },
    panelHeader: {
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 18px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(255,255,255,0.02)',
    },
    panelIcon: { fontSize: 18 },
    panelTitle: { fontSize: 14, fontWeight: 700, color: '#e2e8f0', flex: 1 },
    legend: { display: 'flex', gap: 12 },
    previewBox: {
        flex: 1, minHeight: 500,
        display: 'flex', alignItems: 'stretch',
    },
    iframe: { width: '100%', height: '70vh', border: 'none', minHeight: 500 },
    imgPreview: { width: '100%', objectFit: 'contain', maxHeight: '70vh' },
    noPreview: {
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        flex: 1, padding: 40,
    },
    fieldsList: { flex: 1, paddingTop: 4 },
    emptyFields: {
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '60px 20px', textAlign: 'center',
    },
}

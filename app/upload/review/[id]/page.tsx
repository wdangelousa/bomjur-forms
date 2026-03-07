'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'

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
    green: { border: '#22c55e', bg: 'rgba(34,197,94,0.06)', label: '✓ Verificado', labelColor: '#16a34a' },
    yellow: { border: '#f59e0b', bg: 'rgba(245,158,11,0.06)', label: '⚠ Confirme este dado', labelColor: '#b45309' },
    red: { border: '#ef4444', bg: 'rgba(239,68,68,0.06)', label: '✕ Preenchimento necessário', labelColor: '#dc2626' },
    grey: { border: '#94a3b8', bg: 'rgba(148,163,184,0.06)', label: '○ Insira manualmente', labelColor: '#64748b' },
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
    const [toast, setToast] = useState<'idle' | 'success' | 'error'>('idle')
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

    // ── Confirmar e persistir todos os dados (via API server-side) ────────────
    const handleConfirm = useCallback(async () => {
        if (!doc) return
        setSaving(true)

        try {
            const res = await fetch(`/api/documents/${id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fields: fields.map(f => ({
                        id: f.id,
                        editedValue: f.editedValue,
                        field_value: f.field_value,
                        maps_to_i140_field: f.maps_to_i140_field,
                        maps_to_i485_field: f.maps_to_i485_field,
                        maps_to_i485_mission: f.maps_to_i485_mission,
                        confidence: f.confidence,
                    })),
                }),
            })

            if (!res.ok) throw new Error('Falha na confirmação.')

            setSaving(false)
            setToast('success')
            router.refresh()
            setTimeout(() => router.push('/dashboard'), 2200)

        } catch (err) {
            console.error('Erro ao confirmar dados:', err)
            setSaving(false)
            setToast('error')
            setTimeout(() => setToast('idle'), 4000)
        }
    }, [doc, fields, id, router])

    // ── Métricas de progresso ──────────────────────────────────────────────────
    const total = fields.length
    const confirmed = fields.filter(f => f.isDirty || f.review_status === 'confirmed').length
    const greenCt = fields.filter(f => confidenceTier(f.confidence) === 'green').length
    const pct = total > 0 ? Math.round((confirmed / total) * 100) : 0

    const isPdf = doc?.mime_type === 'application/pdf' || doc?.file_path?.endsWith('.pdf')

    // ─── Render ───────────────────────────────────────────────────────────────
    if (loading) return (
        <div style={S.page}>
            <div style={S.loadingCenter}>
                <div style={S.spinnerLg} />
                <p style={{ color: '#64748b', marginTop: 16 }}>Carregando documento...</p>
            </div>
        </div>
    )

    if (error) return (
        <div style={S.page}>
            <div style={S.loadingCenter}>
                <p style={{ color: '#dc2626', fontSize: 16 }}>❌ {error}</p>
                <button style={S.backBtn} onClick={() => router.push('/dashboard')}>← Voltar ao Painel</button>
            </div>
        </div>
    )

    return (
        <div style={S.page}>
            {/* ── TOAST ── */}
            {toast !== 'idle' && (
                <div style={{
                    position: 'fixed', bottom: 32, right: 32, zIndex: 9999,
                    background: '#fff',
                    border: `1.5px solid ${toast === 'success' ? '#22c55e' : '#ef4444'}`,
                    borderRadius: 14, padding: '16px 22px',
                    boxShadow: '0 8px 40px rgba(0,0,0,0.12)',
                    display: 'flex', alignItems: 'center', gap: 14,
                    animation: 'slideUp 0.3s ease',
                }}>
                    <span style={{ fontSize: 24 }}>{toast === 'success' ? '✅' : '❌'}</span>
                    <div>
                        <p style={{ fontWeight: 700, color: '#0f172a', fontSize: 14, margin: 0 }}>
                            {toast === 'success' ? 'Dados confirmados com sucesso!' : 'Erro ao salvar. Tente novamente.'}
                        </p>
                        {toast === 'success' && (
                            <p style={{ color: '#64748b', fontSize: 12, marginTop: 3 }}>
                                Redirecionando para o painel...
                            </p>
                        )}
                    </div>
                </div>
            )}

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
                                <span style={{ fontSize: 12, color: '#64748b' }}>Missão: Revisão de Extração</span>
                                <span style={{ fontSize: 12, color: '#7c3aed', fontWeight: 700 }}>{pct}%</span>
                            </div>
                            <div style={S.progressBar}>
                                <div style={{ ...S.progressFill, width: `${pct}%` }} />
                            </div>
                            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                                <span style={badge('#16a34a')}>✓ {greenCt} auto</span>
                                <span style={badge('#7c3aed')}>{confirmed}/{total} revisados</span>
                            </div>
                        </div>

                        <button
                            style={{ ...S.confirmBtn, opacity: saving ? 0.7 : 1 }}
                            onClick={handleConfirm}
                            disabled={saving || toast === 'success'}
                        >
                            {saving ? '⟳ Salvando...' : toast === 'success' ? '✓ Aprovado!' : '✓ Confirmar Dados'}
                        </button>
                    </div>
                </div>
            </header>

            {/* ── DOC INFO STRIP ── */}
            <div style={S.docStrip}>
                <div style={S.docChip}>
                    <span>{isPdf ? '📄' : '🖼️'}</span>
                    <span style={{ fontWeight: 600, color: '#334155' }}>{doc?.file_name}</span>
                </div>
                {doc?.document_type && (
                    <div style={S.docChip}>
                        <span>🔍</span>
                        <span style={{ color: '#7c3aed', fontWeight: 600 }}>{doc.document_type}</span>
                        {doc.document_type_confidence && (
                            <span style={{ fontSize: 11, color: '#64748b' }}>
                                ({Math.round(doc.document_type_confidence * 100)}% conf.)
                            </span>
                        )}
                    </div>
                )}
                <button
                    style={{ ...S.docChip, marginLeft: 'auto', cursor: 'pointer', background: 'none', border: 'none', color: '#64748b', padding: 0 }}
                    onClick={() => router.push('/dashboard')}
                >
                    ← Voltar ao Painel
                </button>
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
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                                            {friendlyLabel(field.field_key)}
                                        </span>
                                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                            <span style={{
                                                fontSize: 10, fontWeight: 700, padding: '2px 7px',
                                                borderRadius: 999, background: style.bg,
                                                color: style.labelColor, border: `1px solid ${style.border}`,
                                            }}>
                                                {pctConf}%
                                            </span>
                                            {isConfirmed && <span style={{ fontSize: 13, color: '#16a34a' }}>✓</span>}
                                        </div>
                                    </div>

                                    {/* Input editável — todos os campos são editáveis diretamente */}
                                    <input
                                        className="bg-white border border-slate-200 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 rounded-lg px-3 py-2.5 text-slate-900 font-semibold w-full transition-all outline-none text-[15px]"
                                        value={field.editedValue}
                                        onChange={e => handleEdit(field.id, e.target.value)}
                                        placeholder={tier === 'grey' ? 'Digite o valor manualmente...' : 'Edite se necessário...'}
                                    />

                                    {/* Label de status */}
                                    {!isConfirmed && (
                                        <p style={{ fontSize: 11, color: style.labelColor, marginTop: 6, fontWeight: 500 }}>
                                            {style.label}
                                        </p>
                                    )}

                                    {/* Onde esse campo vai ser salvo */}
                                    {(field.maps_to_i140_field || field.maps_to_i485_field) && (
                                        <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>
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
        @keyframes slideUp { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        input::placeholder { color: #94a3b8; }
      `}</style>
        </div>
    )
}

// ─── Estilos ─────────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
    page: {
        minHeight: '100vh',
        background: '#f8fafc',
        fontFamily: "'Inter', system-ui, sans-serif",
        color: '#1e293b',
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
        border: '3px solid #e2e8f0',
        borderTopColor: '#3b82f6',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
    },
    header: {
        background: '#ffffff',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid #e2e8f0',
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
        background: 'linear-gradient(90deg,#2563eb,#3b82f6)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
    },
    logoSub: { fontSize: 11, color: '#64748b' },
    progressWrap: { minWidth: 220 },
    progressMeta: { display: 'flex', justifyContent: 'space-between', marginBottom: 4 },
    progressBar: { height: 5, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' },
    progressFill: { height: '100%', background: 'linear-gradient(90deg,#7c3aed,#a78bfa)', borderRadius: 999, transition: 'width 0.4s ease' },
    confirmBtn: {
        padding: '10px 22px',
        background: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
        color: '#fff', fontWeight: 700, fontSize: 13,
        border: 'none', borderRadius: 10, cursor: 'pointer',
        boxShadow: '0 4px 20px rgba(124,58,237,0.3)',
        whiteSpace: 'nowrap', transition: 'all 0.2s',
    },
    backBtn: {
        marginTop: 16, padding: '8px 20px',
        background: '#f1f5f9', border: '1px solid #e2e8f0',
        color: '#64748b', borderRadius: 8, cursor: 'pointer', fontSize: 13,
    },
    docStrip: {
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '8px 24px',
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        flexShrink: 0,
    },
    docChip: {
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 13, color: '#64748b',
    },
    splitView: {
        flex: 1, display: 'flex',
        maxWidth: 1400, margin: '0 auto', width: '100%',
        padding: '24px', gap: 20,
        alignItems: 'flex-start',
    },
    previewCol: {
        flex: '0 0 48%', maxWidth: '48%',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
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
        borderBottom: '1px solid #e2e8f0',
        background: '#f8fafc',
    },
    panelIcon: { fontSize: 18 },
    panelTitle: { fontSize: 14, fontWeight: 700, color: '#1e293b', flex: 1 },
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

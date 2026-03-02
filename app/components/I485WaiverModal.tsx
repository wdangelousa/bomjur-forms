'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Props {
    applicationId: string          // ID em i485_applications
    clientName: string             // Nome do cliente para personalizar
    onAccepted: () => void         // Callback ao aceitar — libera Missão 1
}

// ─── Textos legais dos checkboxes ─────────────────────────────────────────────
const CLAUSES = [
    {
        id: 'natureza_administrativa',
        icon: '📋',
        title: 'Natureza Administrativa',
        text: 'Compreendo que a PROEX VENTURE LLC atua exclusivamente na preparação administrativa de documentos e formulários de imigração, e não fornece aconselhamento jurídico, representação legal ou parecer sobre o mérito da solicitação.',
    },
    {
        id: 'manutencao_status',
        icon: '🛂',
        title: 'Manutenção de Status',
        text: 'Declaro ser minha responsabilidade exclusiva manter meu status imigratório válido e cumprir todas as leis e regulamentos de imigração dos Estados Unidos durante a tramitação do processo de Ajuste de Status.',
    },
    {
        id: 'isencao_responsabilidade',
        icon: '🛡️',
        title: 'Isenção de Responsabilidade',
        text: 'Declaro que decidi, por minha própria conta e risco, prosseguir com o pedido de Ajuste de Status via I-485, isentando expressamente a PROEX VENTURE LLC de qualquer responsabilidade civil, administrativa ou imigratória sobre o mérito legal, deferimento ou indeferimento da solicitação.',
    },
    {
        id: 'taxas_rfe_noid',
        icon: '💼',
        title: 'Taxas Governamentais e RFE/NOID',
        text: 'Estou ciente de que as taxas governamentais pagas ao USCIS não são reembolsáveis em nenhuma hipótese. Caso meu processo seja objeto de um RFE (Request for Evidence) ou NOID (Notice of Intent to Deny), os honorários advocatícios necessários para elaborar a resposta serão de minha exclusiva responsabilidade financeira.',
    },
]

// ─── Componente ───────────────────────────────────────────────────────────────
export default function I485WaiverModal({ applicationId, clientName, onAccepted }: Props) {
    const [checked, setChecked] = useState<Record<string, boolean>>({})
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const allChecked = CLAUSES.every(c => checked[c.id])
    const checkedCount = Object.values(checked).filter(Boolean).length

    const toggle = (id: string) =>
        setChecked(prev => ({ ...prev, [id]: !prev[id] }))

    const handleAccept = async () => {
        if (!allChecked) return
        setSaving(true)
        setError(null)

        const now = new Date().toISOString()

        // Salva o timestamp de aceite na tabela i485_applications
        const { error: updateErr } = await supabase
            .from('i485_applications')
            .update({ i485_waiver_accepted_at: now })
            .eq('id', applicationId)

        if (updateErr) {
            setError('Erro ao registrar aceite. Tente novamente.')
            setSaving(false)
            return
        }

        setSaving(false)
        onAccepted()   // libera a interface da Missão 1
    }

    return (
        // Overlay bloqueante — cobre toda a tela, não fecha ao clicar fora
        <div style={S.overlay}>
            <div style={S.modal}>

                {/* ── Cabeçalho ── */}
                <div style={S.header}>
                    <div style={S.headerTop}>
                        <span style={S.logoIcon}>🚀</span>
                        <div>
                            <p style={S.headerEyebrow}>PROEX VENTURE LLC · Plataforma Bomjur</p>
                            <h2 style={S.headerTitle}>Aditivo de Escopo e Declaração de Diretrizes</h2>
                        </div>
                    </div>
                    <div style={S.alertBar}>
                        <span style={{ fontSize: 18 }}>🔒</span>
                        <p style={S.alertText}>
                            Para iniciar o preenchimento do formulário I-485, você deve ler e aceitar
                            os 4 termos abaixo. Esta declaração é registrada com data e hora no sistema.
                        </p>
                    </div>
                </div>

                {/* ── Corpo: checkboxes ── */}
                <div style={S.body}>
                    {clientName && (
                        <p style={S.clientGreeting}>
                            Olá, <strong>{clientName}</strong>. Por favor, leia cada item com atenção.
                        </p>
                    )}

                    {CLAUSES.map((clause, i) => {
                        const isChecked = !!checked[clause.id]
                        return (
                            <div
                                key={clause.id}
                                style={{
                                    ...S.clauseCard,
                                    borderColor: isChecked ? '#22c55e' : 'rgba(255,255,255,0.1)',
                                    background: isChecked ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.03)',
                                }}
                                onClick={() => toggle(clause.id)}
                            >
                                {/* Número + ícone */}
                                <div style={S.clauseLeft}>
                                    <div style={{ ...S.clauseNum, background: isChecked ? '#22c55e' : 'rgba(255,255,255,0.1)' }}>
                                        {isChecked ? '✓' : i + 1}
                                    </div>
                                </div>

                                {/* Conteúdo */}
                                <div style={S.clauseContent}>
                                    <div style={S.clauseTitleRow}>
                                        <span style={{ fontSize: 16 }}>{clause.icon}</span>
                                        <span style={{ ...S.clauseTitle, color: isChecked ? '#22c55e' : '#e2e8f0' }}>
                                            {clause.title}
                                        </span>
                                    </div>
                                    <p style={S.clauseText}>{clause.text}</p>
                                </div>

                                {/* Checkbox customizado */}
                                <div style={{
                                    ...S.checkbox, borderColor: isChecked ? '#22c55e' : '#475569',
                                    background: isChecked ? '#22c55e' : 'transparent'
                                }}>
                                    {isChecked && <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>✓</span>}
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* ── Rodapé ── */}
                <div style={S.footer}>
                    {/* Progresso */}
                    <div style={S.progressArea}>
                        <div style={S.progressMeta}>
                            <span style={{ fontSize: 12, color: '#94a3b8' }}>
                                {checkedCount === 4 ? '✅ Todos os termos aceitos' : `${checkedCount} de 4 termos aceitos`}
                            </span>
                            <span style={{ fontSize: 12, color: '#a78bfa', fontWeight: 700 }}>
                                {Math.round((checkedCount / 4) * 100)}%
                            </span>
                        </div>
                        <div style={S.progressBar}>
                            <div style={{ ...S.progressFill, width: `${(checkedCount / 4) * 100}%` }} />
                        </div>
                    </div>

                    {/* Erro */}
                    {error && <p style={S.errorMsg}>⚠️ {error}</p>}

                    {/* Botão */}
                    <button
                        onClick={handleAccept}
                        disabled={!allChecked || saving}
                        style={{
                            ...S.confirmBtn,
                            opacity: allChecked && !saving ? 1 : 0.4,
                            cursor: allChecked && !saving ? 'pointer' : 'not-allowed',
                            boxShadow: allChecked ? '0 4px 24px rgba(34,197,94,0.35)' : 'none',
                        }}
                    >
                        {saving ? '⟳ Registrando aceite...' : '✓ Concordar e Iniciar I-485'}
                    </button>

                    <p style={S.disclaimer}>
                        Ao clicar em "Concordar", sua declaração de aceite é registrada com carimbo
                        de data/hora em nosso sistema. Este documento tem validade contratual.
                    </p>
                </div>
            </div>
        </div>
    )
}

// ─── Estilos ─────────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
    overlay: {
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
        fontFamily: "'Inter', system-ui, sans-serif",
    },
    modal: {
        background: 'linear-gradient(135deg,#1e1b4b 0%,#1e293b 100%)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 20, width: '100%', maxWidth: 680,
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 25px 80px rgba(0,0,0,0.8)',
        display: 'flex', flexDirection: 'column',
    },
    header: {
        padding: '28px 28px 0',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        paddingBottom: 20,
    },
    headerTop: { display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16 },
    logoIcon: { fontSize: 32, flexShrink: 0, marginTop: 2 },
    headerEyebrow: { fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
    headerTitle: { fontSize: 18, fontWeight: 700, color: '#f1f5f9', lineHeight: 1.3 },
    alertBar: {
        display: 'flex', gap: 12, alignItems: 'flex-start',
        background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)',
        borderRadius: 10, padding: '12px 16px',
    },
    alertText: { fontSize: 13, color: '#fbbf24', lineHeight: 1.5 },
    body: { padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 12 },
    clientGreeting: { fontSize: 14, color: '#94a3b8', marginBottom: 4 },
    clauseCard: {
        display: 'flex', gap: 14, alignItems: 'flex-start',
        padding: '14px 16px', borderRadius: 12,
        border: '1.5px solid', cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
    clauseLeft: { flexShrink: 0, paddingTop: 2 },
    clauseNum: {
        width: 26, height: 26, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700, color: '#fff', transition: 'all 0.2s',
    },
    clauseContent: { flex: 1 },
    clauseTitleRow: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 },
    clauseTitle: { fontSize: 14, fontWeight: 700, transition: 'color 0.2s' },
    clauseText: { fontSize: 13, color: '#94a3b8', lineHeight: 1.6 },
    checkbox: {
        flexShrink: 0, width: 22, height: 22, borderRadius: 6,
        border: '2px solid', display: 'flex', alignItems: 'center',
        justifyContent: 'center', transition: 'all 0.2s', marginTop: 2,
    },
    footer: {
        padding: '20px 28px 28px',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', flexDirection: 'column', gap: 14,
    },
    progressArea: {},
    progressMeta: { display: 'flex', justifyContent: 'space-between', marginBottom: 6 },
    progressBar: { height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden' },
    progressFill: {
        height: '100%', borderRadius: 999,
        background: 'linear-gradient(90deg,#22c55e,#86efac)',
        transition: 'width 0.4s ease',
    },
    errorMsg: { fontSize: 13, color: '#f87171' },
    confirmBtn: {
        width: '100%', padding: '14px 0',
        background: 'linear-gradient(135deg,#16a34a,#22c55e)',
        color: '#fff', fontWeight: 700, fontSize: 15,
        border: 'none', borderRadius: 12,
        transition: 'all 0.2s',
    },
    disclaimer: { fontSize: 11, color: '#475569', textAlign: 'center', lineHeight: 1.5 },
}

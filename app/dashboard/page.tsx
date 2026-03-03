'use client'

import { useState, useRef, useCallback } from 'react'

// ══════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════
type Status = 'pending' | 'done'
type Phase  = 'idle' | 'reading' | 'success'

interface DocItem {
    id:       string
    label:    string
    hint?:    string
    emoji:    string
    category: string
    status:   Status
}

// ══════════════════════════════════════════════════════════
// DATA — 4 categorias, 8 documentos
// TODO: Conectar ao Supabase:
//   const { data: { user } } = await supabase.auth.getUser()
//   const { data: profile } = await supabase.from('user_profiles').select('full_name').eq('id', user.id).single()
//   const { data: docs } = await supabase.from('client_documents').select('*').eq('client_id', user.id)
// ══════════════════════════════════════════════════════════
const MOCK_NAME = 'Eduardo'

const CATEGORIES = [
    { id: 'travel', icon: '🛂', label: 'Identificação e Viagem' },
    { id: 'civil',  icon: '📜', label: 'Documentos Civis' },
    { id: 'immi',   icon: '📋', label: 'Base da Imigração' },
    { id: 'final',  icon: '✅', label: 'Exigências Finais' },
]

const INITIAL_DOCS: DocItem[] = [
    // Categoria 1 — Identificação e Viagem
    {
        id: 'passport', emoji: '🛂', category: 'travel', status: 'pending',
        label: 'Passaporte',
        hint: 'Página com foto e dados pessoais',
    },
    {
        id: 'i94', emoji: '✈️', category: 'travel', status: 'pending',
        label: 'Histórico de Viagem',
        hint: 'Form I-94 e último visto com entrada nos EUA',
    },
    // Categoria 2 — Documentos Civis
    {
        id: 'birth_cert', emoji: '👶', category: 'civil', status: 'pending',
        label: 'Certidão de Nascimento',
        hint: 'Sua e dos dependentes — com tradução juramentada',
    },
    {
        id: 'marriage', emoji: '💍', category: 'civil', status: 'pending',
        label: 'Certidão de Casamento ou Divórcio',
        hint: 'Com tradução juramentada para inglês',
    },
    // Categoria 3 — Base da Imigração
    {
        id: 'i797', emoji: '📄', category: 'immi', status: 'pending',
        label: 'Aprovação do I-140 (Form I-797)',
        hint: 'Notice of Action emitido pelo USCIS',
    },
    {
        id: 'status_history', emoji: '📁', category: 'immi', status: 'pending',
        label: 'Histórico de Status (I-20, vistos anteriores)',
        hint: 'Todos os documentos de status desde a entrada nos EUA',
    },
    // Categoria 4 — Exigências Finais
    {
        id: 'photos', emoji: '📸', category: 'final', status: 'pending',
        label: '2 Fotos Estilo Passaporte (5x5 cm)',
        hint: 'Fundo branco, tiradas nos últimos 6 meses',
    },
    {
        id: 'medical', emoji: '🩺', category: 'final', status: 'pending',
        label: 'Exame Médico (Form I-693)',
        hint: 'Apenas a foto do recibo. Entregue o envelope lacrado fisicamente.',
    },
]

// ══════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════
export default function ClientDashboard() {
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [docs,      setDocs]      = useState<DocItem[]>(INITIAL_DOCS)
    const [phase,     setPhase]     = useState<Phase>('idle')
    const [fileName,  setFileName]  = useState('')
    const [celebId,   setCelebId]   = useState<string | null>(null)
    const [isDragging, setDragging] = useState(false)

    const done     = docs.filter(d => d.status === 'done').length
    const total    = docs.length
    const progress = Math.round((done / total) * 100)

    // simulateUpload — pega o próximo item pendente, espera 2 s, marca como Concluído
    const simulateUpload = useCallback((file: File) => {
        if (phase !== 'idle') return
        setFileName(file.name)
        setPhase('reading')

        // TODO: Substituir por chamada real:
        // const formData = new FormData()
        // formData.append('file', file)
        // formData.append('clientId', userId)
        // const res = await fetch('/api/process-document', { method: 'POST', body: formData })
        setTimeout(() => {
            const pending = docs.filter(d => d.status === 'pending')
            if (pending.length > 0) {
                const target = pending[0]
                setDocs(prev => prev.map(d =>
                    d.id === target.id ? { ...d, status: 'done' } : d
                ))
                // Dispara efeito visual no item concluído
                setCelebId(target.id)
                setTimeout(() => setCelebId(null), 1400)
            }
            setPhase('success')
            setTimeout(() => { setPhase('idle'); setFileName('') }, 1600)
        }, 2000)
    }, [phase, docs])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) simulateUpload(file)
        e.target.value = ''
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setDragging(false)
        const file = e.dataTransfer.files?.[0]
        if (file) simulateUpload(file)
    }

    // ── Tokens ────────────────────────────────────────────
    const G = '#22c55e'   // Verde Proexpand
    const S = '#0f172a'   // Slate-900 (texto principal)
    const M = '#64748b'   // Muted

    // ── Render ────────────────────────────────────────────
    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'Inter, system-ui, sans-serif' }}>
            {/* ── ANIMATIONS & GLOBALS ── */}
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
                *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

                @keyframes shimmer {
                    0%   { background-position: -600% 0; }
                    100% { background-position:  600% 0; }
                }
                @keyframes blinkGreen {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
                    50%      { box-shadow: 0 0 0 8px rgba(34,197,94,0.28); }
                }
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(10px); }
                    to   { opacity: 1; transform: translateY(0);    }
                }
                @keyframes successBounce {
                    0%   { transform: scale(0.82); opacity: 0; }
                    60%  { transform: scale(1.08); opacity: 1; }
                    100% { transform: scale(1);    opacity: 1; }
                }
                @keyframes scanLine {
                    from { top: -3px; }
                    to   { top: 100%; }
                }
                @keyframes dotBounce {
                    0%, 80%, 100% { transform: translateY(0) scale(0.75); opacity: 0.4; }
                    40%           { transform: translateY(-8px) scale(1);  opacity: 1;   }
                }

                .shimmer-zone {
                    background: linear-gradient(90deg, #f0fdf4 20%, #bbf7d0 50%, #f0fdf4 80%) !important;
                    background-size: 600% 100% !important;
                    animation: shimmer 1.8s linear infinite !important;
                }
                .celebrate-item {
                    animation: blinkGreen 0.65s ease-in-out 2 !important;
                    border-color: #22c55e !important;
                    background: #f0fdf4 !important;
                }
                .upload-btn:hover {
                    transform: translateY(-2px) !important;
                    box-shadow: 0 14px 36px rgba(34,197,94,0.5) !important;
                }
            `}</style>

            {/* ════════════════════════════════════════════════════
                NAV
            ════════════════════════════════════════════════════ */}
            <nav style={{
                position: 'sticky', top: 0, zIndex: 60,
                background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(14px)',
                borderBottom: '1px solid #e2e8f0',
                height: 58, display: 'flex', alignItems: 'center',
                padding: '0 36px', gap: 14,
            }}>
                <span style={{ fontSize: 20 }}>🇧🇷</span>
                <span style={{ fontSize: 15, fontWeight: 900, color: S, letterSpacing: '-0.3px' }}>Proexpand</span>
                <span style={{ color: '#e2e8f0', fontSize: 18 }}>|</span>
                <span style={{ fontSize: 12, color: M, fontWeight: 500 }}>Portal do Beneficiário — I-485</span>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: G, boxShadow: `0 0 6px ${G}` }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: G }}>Processo Ativo</span>
                </div>
            </nav>

            {/* ════════════════════════════════════════════════════
                GRID PRINCIPAL — 2 COLUNAS
            ════════════════════════════════════════════════════ */}
            <div style={{
                maxWidth: 1160, margin: '0 auto',
                padding: '32px 24px 100px',
                display: 'grid',
                gridTemplateColumns: '1fr 400px',
                gap: 24,
                alignItems: 'start',
            }}>

                {/* ╔═══════════════════════════════════╗
                    ║   COLUNA ESQUERDA                 ║
                    ╚═══════════════════════════════════╝ */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                    {/* ── 1. SAUDAÇÃO + PROGRESSO ── */}
                    <div style={{
                        background: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: 22,
                        padding: '28px 32px',
                        boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
                        animation: 'fadeUp 0.5s ease both',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, marginBottom: 26 }}>
                            <div>
                                <h1 style={{ fontSize: 28, fontWeight: 900, color: S, letterSpacing: '-0.5px', lineHeight: 1.15 }}>
                                    Olá, {MOCK_NAME}! 👋
                                </h1>
                                <p style={{ fontSize: 14, color: M, marginTop: 6, fontWeight: 500, lineHeight: 1.55 }}>
                                    Seu processo de Green Card está em andamento.<br />
                                    Continue enviando os documentos abaixo — a IA faz o resto.
                                </p>
                            </div>
                            <div style={{
                                flexShrink: 0,
                                textAlign: 'center',
                                background: '#f0fdf4',
                                border: '1.5px solid #bbf7d0',
                                borderRadius: 18,
                                padding: '16px 22px',
                            }}>
                                <div style={{ fontSize: 32, fontWeight: 900, color: '#16a34a', lineHeight: 1 }}>
                                    {done}/{total}
                                </div>
                                <div style={{ fontSize: 10, fontWeight: 800, color: G, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                    documentos
                                </div>
                            </div>
                        </div>

                        {/* Barra de progresso */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: M }}>
                                    Progresso do seu Green Card
                                </span>
                                <span style={{
                                    fontSize: 22, fontWeight: 900,
                                    color: progress === 100 ? '#16a34a' : S,
                                    transition: 'color 0.4s',
                                }}>
                                    {progress}% concluído
                                </span>
                            </div>

                            {/* Track */}
                            <div style={{ height: 16, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden', position: 'relative' }}>
                                <div style={{
                                    height: '100%',
                                    width: `${progress}%`,
                                    background: progress === 100
                                        ? 'linear-gradient(90deg, #16a34a, #22c55e)'
                                        : 'linear-gradient(90deg, #16a34a, #22c55e, #4ade80)',
                                    borderRadius: 99,
                                    transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)',
                                    boxShadow: '0 0 12px rgba(34,197,94,0.55)',
                                }} />
                            </div>

                            {/* Marcos */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                                {[
                                    { pct: 25,  label: '🚀 Iniciado'  },
                                    { pct: 50,  label: '💪 Metade'    },
                                    { pct: 75,  label: '⚡ Quase lá'  },
                                    { pct: 100, label: '🎉 Completo!' },
                                ].map(m => (
                                    <div key={m.pct} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                        <div style={{
                                            width: 8, height: 8, borderRadius: '50%',
                                            background: progress >= m.pct ? G : '#cbd5e1',
                                            transition: 'background 0.5s',
                                            boxShadow: progress >= m.pct ? `0 0 5px ${G}` : 'none',
                                        }} />
                                        <span style={{
                                            fontSize: 10, fontWeight: 700,
                                            color: progress >= m.pct ? G : '#94a3b8',
                                            transition: 'color 0.5s',
                                            whiteSpace: 'nowrap',
                                        }}>
                                            {m.label}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* ── 2. CAIXA MÁGICA DE UPLOAD ── */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,.pdf"
                        style={{ display: 'none' }}
                        onChange={handleChange}
                    />

                    <div
                        className={phase === 'reading' ? 'shimmer-zone' : ''}
                        onClick={() => phase === 'idle' && fileInputRef.current?.click()}
                        onDragOver={e => { e.preventDefault(); if (phase === 'idle') setDragging(true) }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={handleDrop}
                        style={{
                            background: phase === 'success'
                                ? '#f0fdf4'
                                : phase === 'reading'
                                    ? undefined        /* shimmer-zone cuida */
                                    : isDragging ? '#f0fdf4' : '#fff',
                            border: (isDragging || phase !== 'idle')
                                ? `2.5px solid ${G}`
                                : '2.5px dashed #cbd5e1',
                            borderRadius: 26,
                            padding: '56px 44px',
                            textAlign: 'center',
                            cursor: phase === 'idle' ? 'pointer' : 'default',
                            transition: 'border-color 0.3s, background 0.3s, box-shadow 0.3s',
                            position: 'relative',
                            overflow: 'hidden',
                            boxShadow: phase !== 'idle'
                                ? `0 0 0 5px rgba(34,197,94,0.13), 0 2px 12px rgba(0,0,0,0.05)`
                                : '0 1px 6px rgba(0,0,0,0.04)',
                            animation: phase === 'idle' ? 'fadeUp 0.5s 0.1s ease both' : 'none',
                        }}
                    >
                        {/* Linha de scan durante leitura */}
                        {phase === 'reading' && (
                            <div style={{
                                position: 'absolute', left: 0, right: 0, height: 3, zIndex: 3,
                                background: 'linear-gradient(90deg, transparent, #22c55e, transparent)',
                                animation: 'scanLine 1.6s linear infinite',
                            }} />
                        )}

                        {/* ── IDLE ── */}
                        {phase === 'idle' && (
                            <div style={{ animation: 'fadeUp 0.4s ease both' }}>
                                <div style={{ fontSize: 68, lineHeight: 1, marginBottom: 18 }}>
                                    {isDragging ? '✨' : '📸'}
                                </div>
                                <h2 style={{ fontSize: 24, fontWeight: 900, color: S, marginBottom: 10, letterSpacing: '-0.4px' }}>
                                    Suba um documento
                                </h2>
                                <p style={{ fontSize: 14, color: M, lineHeight: 1.75, maxWidth: 460, margin: '0 auto 30px', fontWeight: 500 }}>
                                    Arraste ou tire uma foto.{' '}
                                    <strong style={{ color: S }}>Nossa IA lerá automaticamente</strong>{' '}
                                    e organizará na sua pasta do I-485. ✨
                                </p>
                                <button
                                    className="upload-btn"
                                    onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}
                                    style={{
                                        padding: '18px 48px',
                                        background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                                        color: '#fff', border: 'none', borderRadius: 16,
                                        fontSize: 16, fontWeight: 800, cursor: 'pointer',
                                        boxShadow: '0 8px 26px rgba(34,197,94,0.42)',
                                        display: 'inline-flex', alignItems: 'center', gap: 10,
                                        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                                    }}
                                >
                                    📸 Selecionar Arquivo ou Tirar Foto
                                </button>
                                <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 16 }}>
                                    PDF, JPG ou PNG · Até 20 MB · Seus dados são criptografados 🔒
                                </p>
                            </div>
                        )}

                        {/* ── READING ── */}
                        {phase === 'reading' && (
                            <div style={{ animation: 'fadeUp 0.35s ease both', position: 'relative', zIndex: 4 }}>
                                <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 16 }}>🤖</div>
                                <h2 style={{ fontSize: 22, fontWeight: 900, color: '#166534', marginBottom: 10 }}>
                                    IA analisando documento...
                                </h2>
                                <p style={{ fontSize: 14, color: '#15803d', marginBottom: 22, fontWeight: 500 }}>
                                    {fileName
                                        ? <><strong>"{fileName}"</strong> está sendo processado.</>
                                        : 'Extraindo dados automaticamente para o I-485...'
                                    }
                                </p>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
                                    {[0, 1, 2].map(i => (
                                        <div key={i} style={{
                                            width: 13, height: 13, borderRadius: '50%', background: G,
                                            animation: `dotBounce 1.4s ease-in-out ${i * 0.22}s infinite`,
                                        }} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── SUCCESS ── */}
                        {phase === 'success' && (
                            <div style={{ animation: 'successBounce 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) both' }}>
                                <div style={{ fontSize: 68, lineHeight: 1, marginBottom: 14 }}>✅</div>
                                <h2 style={{ fontSize: 24, fontWeight: 900, color: '#166534', marginBottom: 8 }}>
                                    Dados extraídos!
                                </h2>
                                <p style={{ fontSize: 15, color: G, fontWeight: 700 }}>
                                    Documento adicionado com sucesso à sua pasta. ✨
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* ╔═══════════════════════════════════╗
                    ║   COLUNA DIREITA — CHECKLIST      ║
                    ╚═══════════════════════════════════╝ */}
                <div style={{
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 24,
                    overflow: 'hidden',
                    boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
                    position: 'sticky',
                    top: 74,
                    animation: 'fadeUp 0.5s 0.15s ease both',
                }}>

                    {/* Header */}
                    <div style={{
                        padding: '22px 24px 18px',
                        borderBottom: '1px solid #f1f5f9',
                        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                    }}>
                        <h3 style={{ fontSize: 16, fontWeight: 900, color: '#f1f5f9', marginBottom: 4 }}>
                            📋 Documentos Necessários
                        </h3>
                        <p style={{ fontSize: 12, color: '#94a3b8' }}>
                            {done} de {total} documentos enviados à Proexpand
                        </p>
                    </div>

                    {/* Categorias + Itens */}
                    <div>
                        {CATEGORIES.map((cat, ci) => {
                            const catDocs = docs.filter(d => d.category === cat.id)
                            const catDone = catDocs.filter(d => d.status === 'done').length
                            const allDone = catDone === catDocs.length

                            return (
                                <div key={cat.id} style={{ borderBottom: ci < CATEGORIES.length - 1 ? '1px solid #f1f5f9' : 'none' }}>

                                    {/* Cabeçalho da categoria */}
                                    <div style={{
                                        padding: '13px 24px 8px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                            <span style={{ fontSize: 14 }}>{cat.icon}</span>
                                            <span style={{
                                                fontSize: 10, fontWeight: 800,
                                                color: allDone ? '#16a34a' : '#475569',
                                                textTransform: 'uppercase', letterSpacing: '0.08em',
                                            }}>
                                                {cat.label}
                                            </span>
                                        </div>
                                        <span style={{
                                            fontSize: 10, fontWeight: 800,
                                            background: allDone ? '#dcfce7' : '#f1f5f9',
                                            color: allDone ? '#166534' : M,
                                            padding: '2px 8px', borderRadius: 99,
                                            transition: 'background 0.4s, color 0.4s',
                                        }}>
                                            {catDone}/{catDocs.length}
                                        </span>
                                    </div>

                                    {/* Itens da categoria */}
                                    {catDocs.map((doc) => {
                                        const isCelebrating = celebId === doc.id
                                        const isDone        = doc.status === 'done'

                                        return (
                                            <div
                                                key={doc.id}
                                                className={isCelebrating ? 'celebrate-item' : ''}
                                                style={{
                                                    display: 'flex', alignItems: 'flex-start', gap: 12,
                                                    padding: '11px 20px 11px 24px',
                                                    borderTop: '1px solid #f8fafc',
                                                    background: isDone ? '#fafffe' : '#fff',
                                                    borderLeft: isCelebrating ? `3px solid ${G}` : '3px solid transparent',
                                                    transition: 'background 0.4s, border-color 0.3s',
                                                }}
                                            >
                                                {/* Ícone */}
                                                <div style={{
                                                    width: 38, height: 38, flexShrink: 0, borderRadius: 10,
                                                    background: isDone ? '#dcfce7' : '#f8fafc',
                                                    border: `1.5px solid ${isDone ? '#bbf7d0' : '#e2e8f0'}`,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: 18,
                                                    transition: 'background 0.4s, border-color 0.4s',
                                                }}>
                                                    {doc.emoji}
                                                </div>

                                                {/* Texto */}
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{
                                                        fontSize: 13, fontWeight: isDone ? 700 : 600,
                                                        color: isDone ? '#166534' : S,
                                                        lineHeight: 1.35, marginBottom: doc.hint ? 3 : 0,
                                                        transition: 'color 0.3s',
                                                    }}>
                                                        {doc.label}
                                                    </div>
                                                    {doc.hint && (
                                                        <div style={{
                                                            fontSize: 11,
                                                            color: doc.id === 'medical' ? '#b45309' : '#94a3b8',
                                                            lineHeight: 1.45,
                                                            fontStyle: doc.id === 'medical' ? 'normal' : 'normal',
                                                        }}>
                                                            {doc.id === 'medical' && '⚠️ '}{doc.hint}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Badge de status */}
                                                <div style={{
                                                    flexShrink: 0,
                                                    fontSize: 11, fontWeight: 800,
                                                    padding: '5px 10px', borderRadius: 20,
                                                    background: isDone ? '#dcfce7' : '#fef9c3',
                                                    color:      isDone ? '#166534' : '#854d0e',
                                                    display: 'flex', alignItems: 'center', gap: 4,
                                                    transition: 'background 0.4s, color 0.4s',
                                                    animation: isCelebrating ? 'successBounce 0.5s ease both' : 'none',
                                                    whiteSpace: 'nowrap',
                                                }}>
                                                    {isDone ? '✅ Concluído' : '⏳ Pendente'}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )
                        })}
                    </div>

                    {/* Footer — botão atalho */}
                    <div style={{ padding: '16px 20px', borderTop: '1px solid #f1f5f9', background: '#fafafa' }}>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={phase !== 'idle'}
                            style={{
                                width: '100%', padding: '12px 16px',
                                background: phase !== 'idle' ? '#f8fafc' : '#fff',
                                border: `1.5px dashed ${phase !== 'idle' ? '#e2e8f0' : '#cbd5e1'}`,
                                borderRadius: 10, fontSize: 13, fontWeight: 600,
                                color: phase !== 'idle' ? '#94a3b8' : M,
                                cursor: phase !== 'idle' ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                transition: 'background 0.2s, border-color 0.2s',
                            }}
                        >
                            {phase === 'reading' ? '🤖 IA processando...' : '📸 Enviar próximo documento'}
                        </button>
                        <p style={{ margin: '10px 0 0', fontSize: 10, color: '#94a3b8', textAlign: 'center', lineHeight: 1.5 }}>
                            🔒 Dados criptografados (AES-256) · Uso exclusivo do seu I-485
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

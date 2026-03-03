'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

// ══════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════
type Severity = 'critical' | 'warning' | 'info'
type AlertType = 'no_activity' | 'ai_failure' | 'awaiting_approval' | 'expiring_status' | 'missing_doc'
type HealthStatus = 'online' | 'degraded' | 'offline'
type LogLevel = 'info' | 'success' | 'warn' | 'error'

interface AlertItem {
    id: string
    clientName: string
    clientId: string
    caseId: string
    severity: Severity
    type: AlertType
    message: string
    daysElapsed: number
}

interface PipelineStage {
    id: string
    label: string
    sublabel: string
    emoji: string
    count: number
    isBottleneck: boolean
    color: string
    bg: string
    borderColor: string
}

interface HealthItem {
    service: string
    status: HealthStatus
    detail: string
    latency?: string
}

interface LogEntry {
    id: string
    time: string
    level: LogLevel
    message: string
}

interface ClientRecord {
    id: string
    name: string
    email: string
    caseId: string
    aNumber: string
    stage: string
}

// ══════════════════════════════════════════════════════════
// MOCK DATA — Substitua pelas queries reais do Supabase
// ══════════════════════════════════════════════════════════
// TODO: Buscar com service role key via API Route:
//   GET /api/admin/metrics → { totalClients, packagesReady, aiPages, avgDays }
//   GET /api/admin/pipeline → [{ stage, count }]
//   GET /api/admin/alerts → AlertItem[]
//   Realtime: supabase.channel('admin-ops').on('postgres_changes', ...).subscribe()

const MOCK_METRICS = {
    totalClients: 128,
    clientGrowth: '+5%',
    packagesReady: 17,
    aiPagesRead: 1247,
    avgDaysProcessing: 14,
    openCases: 92,
    filedThisMonth: 11,
}

const MOCK_PIPELINE: PipelineStage[] = [
    {
        id: 'collecting',
        label: 'Coletando Documentos',
        sublabel: 'No cliente',
        emoji: '📂',
        count: 42,
        isBottleneck: false,
        color: '#2563eb',
        bg: '#eff6ff',
        borderColor: '#bfdbfe',
    },
    {
        id: 'ai_reading',
        label: 'IA Extraindo',
        sublabel: 'Motor Bomjur',
        emoji: '🤖',
        count: 8,
        isBottleneck: false,
        color: '#7c3aed',
        bg: '#f5f3ff',
        borderColor: '#ddd6fe',
    },
    {
        id: 'revision',
        label: 'Revisão da Equipe',
        sublabel: 'Gargalo humano',
        emoji: '🔍',
        count: 23,
        isBottleneck: true,
        color: '#d97706',
        bg: '#fffbeb',
        borderColor: '#fcd34d',
    },
    {
        id: 'printed',
        label: 'Pacote Impresso',
        sublabel: 'Aguardando despacho',
        emoji: '🖨️',
        count: 5,
        isBottleneck: false,
        color: '#0891b2',
        bg: '#ecfeff',
        borderColor: '#a5f3fc',
    },
    {
        id: 'filed',
        label: 'Protocolado USCIS',
        sublabel: '🇺🇸 Enviado',
        emoji: '✅',
        count: 22,
        isBottleneck: false,
        color: '#16a34a',
        bg: '#f0fdf4',
        borderColor: '#86efac',
    },
]

const MOCK_ALERTS: AlertItem[] = [
    {
        id: 'a1',
        clientName: 'José Roberto Imigrante',
        clientId: 'c2',
        caseId: 'PRX-2024-I485-00038',
        severity: 'critical',
        type: 'no_activity',
        message: 'Sem enviar documentos. Status de imigração pode expirar em breve.',
        daysElapsed: 15,
    },
    {
        id: 'a2',
        clientName: 'Maria Fernanda Costa',
        clientId: 'c5',
        caseId: 'PRX-2024-I485-00040',
        severity: 'critical',
        type: 'expiring_status',
        message: 'Visto H-1B expira em 28 dias. I-485 ainda não protocolado.',
        daysElapsed: 28,
    },
    {
        id: 'a3',
        clientName: 'Ana Carolina Silva',
        clientId: 'c3',
        caseId: 'PRX-2024-I485-00041',
        severity: 'warning',
        type: 'ai_failure',
        message: 'Falha na leitura do Passaporte (imagem ilegível). Reenvio necessário.',
        daysElapsed: 3,
    },
    {
        id: 'a4',
        clientName: 'Carlos Eduardo Souza',
        clientId: 'c4',
        caseId: 'PRX-2024-I485-00035',
        severity: 'warning',
        type: 'awaiting_approval',
        message: 'Pacote completo aguardando aprovação final do sócio para impressão.',
        daysElapsed: 2,
    },
    {
        id: 'a5',
        clientName: 'Pedro Henrique Nunes',
        clientId: 'c6',
        caseId: 'PRX-2024-I485-00039',
        severity: 'warning',
        type: 'missing_doc',
        message: 'I-693 (exame médico lacrado) não recebido. Protocolo bloqueado.',
        daysElapsed: 7,
    },
    {
        id: 'a6',
        clientName: 'Roberta Lima Pinto',
        clientId: 'c7',
        caseId: 'PRX-2024-I485-00036',
        severity: 'info',
        type: 'no_activity',
        message: 'Sem atividade nos últimos 5 dias. Lembrete suave recomendado.',
        daysElapsed: 5,
    },
]

const MOCK_HEALTH: HealthItem[] = [
    { service: 'Banco de Dados (Supabase)', status: 'online', detail: 'PostgreSQL 15 — us-east-1', latency: '18ms' },
    { service: 'Motor de IA (Claude Vision)', status: 'online', detail: 'claude-sonnet-4-6 — Operante', latency: '1.2s' },
    { service: 'Storage de Documentos', status: 'degraded', detail: 'Uso: 87% da cota — Atenção', latency: '—' },
    { service: 'API de Autenticação', status: 'online', detail: 'Supabase Auth — 0 falhas', latency: '24ms' },
    { service: 'Edge Functions', status: 'online', detail: 'process-document — Deploy OK', latency: '340ms' },
    { service: 'Backup Automático', status: 'online', detail: 'Último backup: há 5 min', latency: '—' },
]

const MOCK_LOGS: LogEntry[] = [
    { id: 'l1', time: '09:41:02', level: 'success', message: 'Documento processado: Passaporte BR — Eduardo Santos (00042)' },
    { id: 'l2', time: '09:38:15', level: 'warn',    message: 'Storage em 87% — considerar upgrade do plano' },
    { id: 'l3', time: '09:35:07', level: 'success', message: 'Pacote I-485 aprovado para impressão — Carlos Souza (00035)' },
    { id: 'l4', time: '09:29:44', level: 'error',   message: 'Falha na leitura: passport_ana_silva.jpg (baixa resolução)' },
    { id: 'l5', time: '09:21:33', level: 'info',    message: 'Novo cliente cadastrado: Roberta Lima Pinto — PRX-2024-I485-00043' },
    { id: 'l6', time: '09:15:09', level: 'success', message: 'Protocolo confirmado USCIS — Receipt recebido: EAC2490012345' },
    { id: 'l7', time: '09:02:51', level: 'info',    message: 'Backup automático concluído — 847 registros exportados' },
]

// Global search mock index
const MOCK_CLIENT_INDEX: ClientRecord[] = [
    { id: 'c1', name: 'Eduardo Ferreira Santos',  email: 'eduardo@techcorp.com',         caseId: 'PRX-2024-I485-00042', aNumber: 'A-203456789', stage: 'Revisão da Equipe'  },
    { id: 'c2', name: 'José Roberto Imigrante',   email: 'jose.imigrante@example.com',   caseId: 'PRX-2024-I485-00038', aNumber: 'A-112233445', stage: 'Coletando Docs'     },
    { id: 'c3', name: 'Ana Carolina Silva',        email: 'ana.silva@startup.com',        caseId: 'PRX-2024-I485-00041', aNumber: 'A-987654321', stage: 'IA Extraindo'       },
    { id: 'c4', name: 'Carlos Eduardo Souza',      email: 'carlos.souza@corp.com',        caseId: 'PRX-2024-I485-00035', aNumber: 'A-567890123', stage: 'Pacote Impresso'    },
    { id: 'c5', name: 'Maria Fernanda Costa',      email: 'mfcosta@university.edu',       caseId: 'PRX-2024-I485-00040', aNumber: 'A-234567890', stage: 'Coletando Docs'     },
    { id: 'c6', name: 'Pedro Henrique Nunes',      email: 'pedro.nunes@tech.io',          caseId: 'PRX-2024-I485-00039', aNumber: 'A-345678901', stage: 'Revisão da Equipe'  },
    { id: 'c7', name: 'Roberta Lima Pinto',        email: 'roberta.pinto@finance.com',    caseId: 'PRX-2024-I485-00036', aNumber: 'A-456789012', stage: 'Coletando Docs'     },
    { id: 'c8', name: 'Henrique Barbosa Melo',     email: 'h.barbosa@engineering.co',     caseId: 'PRX-2024-I485-00033', aNumber: 'A-678901234', stage: 'Protocolado USCIS'  },
    { id: 'c9', name: 'Tatiana Vargas Correia',    email: 'tvargas@medtech.com',          caseId: 'PRX-2024-I485-00029', aNumber: 'A-789012345', stage: 'Protocolado USCIS'  },
]

// ══════════════════════════════════════════════════════════
// DESIGN TOKENS
// ══════════════════════════════════════════════════════════
const C = {
    bg: '#f8fafc',
    card: '#ffffff',
    border: '#e2e8f0',
    green: '#22c55e',
    greenDk: '#16a34a',
    text: '#0f172a',
    muted: '#64748b',
    faint: '#94a3b8',
}

// ══════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════
function severityStyle(s: Severity): { border: string; bg: string; dot: string; label: string } {
    return {
        critical: { border: '#fecaca', bg: '#fff5f5', dot: '#ef4444', label: '🚨 Crítico' },
        warning:  { border: '#fde68a', bg: '#fffdf0', dot: '#f59e0b', label: '⚠️ Atenção' },
        info:     { border: '#bfdbfe', bg: '#f0f8ff', dot: '#3b82f6', label: '💬 Info'    },
    }[s]
}

function healthDot(s: HealthStatus) {
    return { online: '#22c55e', degraded: '#f59e0b', offline: '#ef4444' }[s]
}

function logColor(l: LogLevel): string {
    return { success: '#4ade80', warn: '#fbbf24', error: '#f87171', info: '#94a3b8' }[l]
}

function logPrefix(l: LogLevel): string {
    return { success: '[OK]  ', warn:  '[WARN]', error: '[ERR] ', info:  '[LOG] ' }[l]
}

function highlight(text: string, query: string): React.ReactNode {
    if (!query || query.length < 2) return <>{text}</>
    const idx = text.toLowerCase().indexOf(query.toLowerCase())
    if (idx === -1) return <>{text}</>
    return (
        <>
            {text.slice(0, idx)}
            <mark style={{ background: '#dcfce7', color: '#166534', borderRadius: 3, padding: '0 2px' }}>
                {text.slice(idx, idx + query.length)}
            </mark>
            {text.slice(idx + query.length)}
        </>
    )
}

// ══════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════
export default function SuperAdminCommandCenter() {
    const router = useRouter()
    const searchRef = useRef<HTMLInputElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)

    const [search, setSearch] = useState('')
    const [searchFocused, setSearchFocused] = useState(false)
    const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set())
    const [notifiedClients, setNotifiedClients] = useState<Set<string>>(new Set())
    const [clockTime, setClockTime] = useState('')
    const [uptimeSeconds, setUptimeSeconds] = useState(0)
    const [hoveredStage, setHoveredStage] = useState<string | null>(null)

    // Live clock for system health terminal
    useEffect(() => {
        const tick = () => {
            const now = new Date()
            setClockTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
            setUptimeSeconds(s => s + 1)
        }
        tick()
        const id = setInterval(tick, 1000)
        return () => clearInterval(id)
    }, [])

    // Close search dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (
                dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
                searchRef.current && !searchRef.current.contains(e.target as Node)
            ) setSearchFocused(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    // Computed
    const searchResults = search.length >= 2
        ? MOCK_CLIENT_INDEX.filter(c =>
            c.name.toLowerCase().includes(search.toLowerCase()) ||
            c.email.toLowerCase().includes(search.toLowerCase()) ||
            c.caseId.toLowerCase().includes(search.toLowerCase()) ||
            c.aNumber.toLowerCase().includes(search.toLowerCase())
        ).slice(0, 6)
        : []

    const visibleAlerts = MOCK_ALERTS.filter(a => !dismissedAlerts.has(a.id))
    const criticalCount = visibleAlerts.filter(a => a.severity === 'critical').length

    const totalInPipeline = MOCK_PIPELINE.reduce((acc, s) => acc + s.count, 0)
    const maxPipelineCount = Math.max(...MOCK_PIPELINE.map(s => s.count))

    const uptimeStr = () => {
        const h = Math.floor(uptimeSeconds / 3600)
        const m = Math.floor((uptimeSeconds % 3600) / 60)
        const s = uptimeSeconds % 60
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    }

    // ── RENDER ─────────────────────────────────────────────
    return (
        <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'Inter, system-ui, sans-serif' }}>
            <style>{`
                @keyframes pulseGreen {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50%       { opacity: 0.4; transform: scale(0.7); }
                }
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(8px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes terminalBlink {
                    0%, 100% { opacity: 1; }
                    50%      { opacity: 0; }
                }
                @keyframes slideDown {
                    from { opacity: 0; transform: translateY(-6px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                .metric-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.07) !important; }
                .alert-row:hover   { background: #fafafa !important; }
                .stage-card:hover  { transform: translateY(-3px); }
                .action-btn:hover  { filter: brightness(1.08); }
            `}</style>

            {/* ════════════════════════════════════════════════════
                STICKY NAV
            ════════════════════════════════════════════════════ */}
            <nav style={{
                position: 'sticky', top: 0, zIndex: 200,
                background: 'rgba(255,255,255,0.93)', backdropFilter: 'blur(14px)',
                borderBottom: `1px solid ${C.border}`,
                height: 52, display: 'flex', alignItems: 'center',
                padding: '0 28px', gap: 16,
            }}>
                <button
                    onClick={() => router.push('/admin')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: C.muted, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5 }}
                >
                    ← Lista de Clientes
                </button>
                <span style={{ color: C.border }}>|</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>📊 Command Center</span>

                {criticalCount > 0 && (
                    <div style={{
                        marginLeft: 8,
                        background: '#fef2f2', border: '1px solid #fecaca',
                        borderRadius: 20, padding: '3px 10px',
                        fontSize: 11, fontWeight: 800, color: '#dc2626',
                        display: 'flex', alignItems: 'center', gap: 5,
                    }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', animation: 'pulseGreen 1s ease-in-out infinite' }} />
                        {criticalCount} alerta{criticalCount > 1 ? 's' : ''} crítico{criticalCount > 1 ? 's' : ''}
                    </div>
                )}

                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: C.green, animation: 'pulseGreen 2s ease-in-out infinite' }} />
                    <span style={{ fontSize: 11, color: C.green, fontWeight: 800 }}>Sistema Operacional</span>
                    <span style={{ fontSize: 11, color: C.faint, marginLeft: 4 }}>{clockTime}</span>
                </div>
            </nav>

            <div style={{ maxWidth: 1440, margin: '0 auto', padding: '24px 24px 80px' }}>

                {/* ════════════════════════════════════════════════════
                    SECTION 1 — HEADER & GLOBAL SEARCH
                ════════════════════════════════════════════════════ */}
                <div style={{ marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
                        <div>
                            <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: C.green, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                                Proexpand Brasil · Super Admin
                            </p>
                            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: C.text, letterSpacing: '-0.4px' }}>
                                Command Center — Visão Global 📊
                            </h1>
                            <p style={{ margin: '4px 0 0', fontSize: 13, color: C.muted }}>
                                {totalInPipeline} casos ativos · Uptime da sessão: {uptimeStr()}
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button style={{
                                padding: '9px 16px', borderRadius: 10,
                                background: C.card, border: `1px solid ${C.border}`,
                                fontSize: 12, fontWeight: 700, color: C.muted,
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                            }}>
                                📤 Exportar Relatório
                            </button>
                            <button style={{
                                padding: '9px 16px', borderRadius: 10,
                                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                                border: 'none', color: '#fff',
                                fontSize: 12, fontWeight: 800, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: 6,
                                boxShadow: '0 3px 10px rgba(34,197,94,0.3)',
                            }}>
                                ⚙️ Configurações
                            </button>
                        </div>
                    </div>

                    {/* God Mode Search */}
                    <div style={{ position: 'relative' }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            background: C.card,
                            border: `1.5px solid ${searchFocused ? C.green : C.border}`,
                            borderRadius: 14, padding: '0 18px',
                            boxShadow: searchFocused ? '0 0 0 3px rgba(34,197,94,0.12)' : '0 1px 4px rgba(0,0,0,0.04)',
                            transition: 'all 0.2s ease',
                        }}>
                            <span style={{ fontSize: 18, flexShrink: 0 }}>🔍</span>
                            <input
                                ref={searchRef}
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                onFocus={() => setSearchFocused(true)}
                                placeholder="Busca Global (God Mode) — Pesquise por cliente, e-mail, A-Number ou ID do Caso..."
                                style={{
                                    flex: 1, border: 'none', outline: 'none', background: 'transparent',
                                    fontSize: 14, fontWeight: 500, color: C.text,
                                    padding: '16px 0',
                                }}
                            />
                            {search && (
                                <button
                                    onClick={() => { setSearch(''); setSearchFocused(false) }}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: C.faint, padding: '4px' }}
                                >
                                    ✕
                                </button>
                            )}
                            <span style={{ fontSize: 11, color: C.faint, whiteSpace: 'nowrap', background: '#f8fafc', border: `1px solid ${C.border}`, borderRadius: 6, padding: '3px 8px' }}>
                                ⌘K
                            </span>
                        </div>

                        {/* Search Dropdown */}
                        {searchFocused && searchResults.length > 0 && (
                            <div
                                ref={dropdownRef}
                                style={{
                                    position: 'absolute', top: 'calc(100% + 6px)',
                                    left: 0, right: 0, zIndex: 300,
                                    background: C.card, border: `1px solid ${C.border}`,
                                    borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
                                    overflow: 'hidden',
                                    animation: 'slideDown 0.18s ease both',
                                }}
                            >
                                <div style={{ padding: '8px 14px 6px', fontSize: 10, fontWeight: 800, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                    {searchResults.length} resultado{searchResults.length > 1 ? 's' : ''} encontrado{searchResults.length > 1 ? 's' : ''}
                                </div>
                                {searchResults.map((c, i) => (
                                    <div
                                        key={c.id}
                                        onClick={() => { router.push(`/admin/clients/${c.id}`); setSearchFocused(false); setSearch('') }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 14,
                                            padding: '12px 16px',
                                            borderTop: i > 0 ? `1px solid #f8fafc` : 'none',
                                            cursor: 'pointer', transition: 'background 0.15s',
                                        }}
                                        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = '#f8fafc'}
                                        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                                    >
                                        <div style={{
                                            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                                            background: `${C.green}15`, color: C.green,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 15, fontWeight: 900,
                                        }}>
                                            {c.name.split(' ').slice(0, 2).map(n => n[0]).join('')}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                                                {highlight(c.name, search)}
                                            </div>
                                            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                                                {highlight(c.email, search)} · {highlight(c.caseId, search)} · {highlight(c.aNumber, search)}
                                            </div>
                                        </div>
                                        <div style={{ fontSize: 11, color: C.muted, background: '#f8fafc', border: `1px solid ${C.border}`, borderRadius: 20, padding: '2px 8px' }}>
                                            {c.stage}
                                        </div>
                                        <span style={{ fontSize: 12, color: C.faint }}>→</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {searchFocused && search.length >= 2 && searchResults.length === 0 && (
                            <div ref={dropdownRef} style={{
                                position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 300,
                                background: C.card, border: `1px solid ${C.border}`,
                                borderRadius: 14, padding: '20px', textAlign: 'center',
                                boxShadow: '0 12px 40px rgba(0,0,0,0.10)',
                                animation: 'slideDown 0.18s ease both',
                            }}>
                                <div style={{ fontSize: 24, marginBottom: 8 }}>🔍</div>
                                <div style={{ fontSize: 13, color: C.muted }}>Nenhum cliente encontrado para <strong>"{search}"</strong></div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ════════════════════════════════════════════════════
                    SECTION 2 — HUD DE MÉTRICAS
                ════════════════════════════════════════════════════ */}
                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 16, marginBottom: 20,
                }}>
                    {[
                        {
                            emoji: '👥', label: 'Clientes Ativos',
                            value: MOCK_METRICS.totalClients.toLocaleString('pt-BR'),
                            sub: `${MOCK_METRICS.clientGrowth} este mês`,
                            subColor: C.green,
                            accent: '#eff6ff', border: '#bfdbfe', labelColor: '#1d4ed8',
                        },
                        {
                            emoji: '🇺🇸', label: 'Pacotes Prontos para USCIS',
                            value: MOCK_METRICS.packagesReady.toString(),
                            sub: 'Prontos para despacho',
                            subColor: C.green,
                            accent: '#f0fdf4', border: '#86efac', labelColor: C.greenDk,
                        },
                        {
                            emoji: '🤖', label: 'Páginas Lidas pela IA',
                            value: MOCK_METRICS.aiPagesRead.toLocaleString('pt-BR'),
                            sub: 'Total extraídas no mês',
                            subColor: '#7c3aed',
                            accent: '#f5f3ff', border: '#ddd6fe', labelColor: '#7c3aed',
                        },
                        {
                            emoji: '⏳', label: 'Tempo Médio de Protocolo',
                            value: `${MOCK_METRICS.avgDaysProcessing} dias`,
                            sub: 'Da entrada ao depósito USCIS',
                            subColor: '#d97706',
                            accent: '#fffbeb', border: '#fde68a', labelColor: '#92400e',
                        },
                    ].map(m => (
                        <div
                            key={m.label}
                            className="metric-card"
                            style={{
                                background: C.card, borderRadius: 16,
                                border: `1px solid ${C.border}`,
                                padding: '20px 22px',
                                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                                transition: 'all 0.2s ease',
                                cursor: 'default',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                                <div style={{
                                    width: 40, height: 40, borderRadius: 10,
                                    background: m.accent, border: `1px solid ${m.border}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 18, flexShrink: 0,
                                }}>
                                    {m.emoji}
                                </div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, lineHeight: 1.3, marginTop: 2 }}>
                                    {m.label}
                                </div>
                            </div>
                            <div style={{ fontSize: 32, fontWeight: 900, color: C.text, letterSpacing: '-0.5px', lineHeight: 1, marginBottom: 6 }}>
                                {m.value}
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: m.subColor }}>
                                {m.sub}
                            </div>
                        </div>
                    ))}
                </div>

                {/* ════════════════════════════════════════════════════
                    SECTION 3 — FUNIL DE OPERAÇÃO (PIPELINE)
                ════════════════════════════════════════════════════ */}
                <div style={{
                    background: C.card, borderRadius: 18,
                    border: `1px solid ${C.border}`,
                    padding: '22px 24px', marginBottom: 20,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.text }}>
                                📈 Funil de Operação — Pipeline de Casos
                            </h2>
                            <p style={{ margin: '3px 0 0', fontSize: 12, color: C.muted }}>
                                {totalInPipeline} casos distribuídos em 5 etapas · Clique em um estágio para ver os clientes
                            </p>
                        </div>
                        <div style={{ fontSize: 12, background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 20, padding: '4px 12px', fontWeight: 700, color: '#92400e' }}>
                            ⚠️ Gargalo identificado: Revisão da Equipe
                        </div>
                    </div>

                    {/* Pipeline stages */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                        {MOCK_PIPELINE.map((stage, idx) => {
                            const barHeight = Math.max(18, Math.round((stage.count / maxPipelineCount) * 64))
                            return (
                                <div key={stage.id} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div
                                        className="stage-card"
                                        onMouseEnter={() => setHoveredStage(stage.id)}
                                        onMouseLeave={() => setHoveredStage(null)}
                                        style={{
                                            flex: 1,
                                            background: hoveredStage === stage.id ? stage.bg : '#fafafa',
                                            border: `2px solid ${stage.isBottleneck ? '#fcd34d' : stage.borderColor}`,
                                            borderRadius: 14,
                                            padding: '16px 14px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            position: 'relative',
                                            boxShadow: stage.isBottleneck
                                                ? '0 0 0 3px rgba(251,191,36,0.2)'
                                                : 'none',
                                        }}
                                    >
                                        {/* Bottleneck badge */}
                                        {stage.isBottleneck && (
                                            <div style={{
                                                position: 'absolute', top: -10, left: '50%',
                                                transform: 'translateX(-50%)',
                                                background: '#f59e0b', color: '#fff',
                                                fontSize: 9, fontWeight: 900,
                                                padding: '2px 8px', borderRadius: 99,
                                                whiteSpace: 'nowrap',
                                            }}>
                                                ⚠️ GARGALO
                                            </div>
                                        )}

                                        {/* Stage number */}
                                        <div style={{
                                            fontSize: 10, fontWeight: 800, color: stage.color,
                                            textTransform: 'uppercase', letterSpacing: '0.06em',
                                            marginBottom: 6,
                                        }}>
                                            Etapa {idx + 1}
                                        </div>

                                        {/* Emoji + label */}
                                        <div style={{ fontSize: 20, marginBottom: 4 }}>{stage.emoji}</div>
                                        <div style={{ fontSize: 12, fontWeight: 800, color: C.text, lineHeight: 1.3, marginBottom: 2 }}>
                                            {stage.label}
                                        </div>
                                        <div style={{ fontSize: 10, color: C.muted, marginBottom: 12 }}>
                                            {stage.sublabel}
                                        </div>

                                        {/* Count */}
                                        <div style={{ fontSize: 30, fontWeight: 900, color: stage.color, letterSpacing: '-0.5px', lineHeight: 1, marginBottom: 10 }}>
                                            {stage.count}
                                        </div>
                                        <div style={{ fontSize: 10, color: C.faint }}>
                                            clientes
                                        </div>

                                        {/* Mini volume bar */}
                                        <div style={{ marginTop: 10, height: 4, background: '#e2e8f0', borderRadius: 99 }}>
                                            <div style={{
                                                height: '100%', borderRadius: 99,
                                                width: `${Math.round((stage.count / maxPipelineCount) * 100)}%`,
                                                background: stage.isBottleneck
                                                    ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                                                    : `linear-gradient(90deg, ${stage.color}cc, ${stage.color})`,
                                                transition: 'width 0.6s ease',
                                            }} />
                                        </div>
                                    </div>

                                    {/* Arrow connector */}
                                    {idx < MOCK_PIPELINE.length - 1 && (
                                        <div style={{
                                            flexShrink: 0, fontSize: 16, color: '#cbd5e1',
                                            display: 'flex', alignItems: 'center',
                                        }}>
                                            →
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* ════════════════════════════════════════════════════
                    BOTTOM GRID — ALERTS (left) | HEALTH (right)
                ════════════════════════════════════════════════════ */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20 }}>

                    {/* ── SECTION 4: ALERTAS DE GARGALO ── */}
                    <div style={{
                        background: C.card, borderRadius: 18,
                        border: `1px solid ${C.border}`,
                        overflow: 'hidden',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                    }}>
                        <div style={{ padding: '18px 22px', borderBottom: `1px solid #f1f5f9`, display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 18 }}>🚨</span>
                            <div>
                                <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.text }}>
                                    Alertas de Gargalo — Ação Requerida
                                </h2>
                                <p style={{ margin: '2px 0 0', fontSize: 11, color: C.muted }}>
                                    {visibleAlerts.length} caso{visibleAlerts.length !== 1 ? 's' : ''} requer{visibleAlerts.length === 1 ? '' : 'em'} atenção
                                </p>
                            </div>
                            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                                {(['critical', 'warning', 'info'] as Severity[]).map(s => {
                                    const count = visibleAlerts.filter(a => a.severity === s).length
                                    if (!count) return null
                                    const style = severityStyle(s)
                                    return (
                                        <span key={s} style={{
                                            fontSize: 10, fontWeight: 800,
                                            background: style.bg, border: `1px solid ${style.border}`,
                                            borderRadius: 20, padding: '2px 8px',
                                            color: style.dot,
                                        }}>
                                            {count}
                                        </span>
                                    )
                                })}
                            </div>
                        </div>

                        <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                            {visibleAlerts.length === 0 ? (
                                <div style={{ padding: '40px', textAlign: 'center' }}>
                                    <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>Tudo em ordem!</div>
                                    <div style={{ fontSize: 12, color: C.muted }}>Nenhum alerta ativo no momento.</div>
                                </div>
                            ) : (
                                visibleAlerts.map((alert, i) => {
                                    const s = severityStyle(alert.severity)
                                    const isNotified = notifiedClients.has(alert.id)
                                    return (
                                        <div
                                            key={alert.id}
                                            className="alert-row"
                                            style={{
                                                padding: '14px 20px',
                                                borderBottom: i < visibleAlerts.length - 1 ? '1px solid #f8fafc' : 'none',
                                                borderLeft: `3px solid ${s.dot}`,
                                                background: '#fff',
                                                transition: 'background 0.15s',
                                                animation: 'fadeUp 0.3s ease both',
                                                animationDelay: `${i * 0.05}s`,
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                                {/* Severity dot */}
                                                <div style={{
                                                    width: 8, height: 8, borderRadius: '50%',
                                                    background: s.dot, flexShrink: 0, marginTop: 6,
                                                    animation: alert.severity === 'critical' ? 'pulseGreen 1.2s ease-in-out infinite' : 'none',
                                                }} />

                                                {/* Content */}
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                                                        <span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>
                                                            {alert.clientName}
                                                        </span>
                                                        <span style={{
                                                            fontSize: 9, fontWeight: 800,
                                                            background: s.bg, border: `1px solid ${s.border}`,
                                                            borderRadius: 99, padding: '2px 7px',
                                                            color: s.dot,
                                                        }}>
                                                            {s.label}
                                                        </span>
                                                        <span style={{ fontSize: 10, color: C.faint }}>
                                                            {alert.caseId}
                                                        </span>
                                                    </div>
                                                    <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.4, marginBottom: 10 }}>
                                                        {alert.message}
                                                    </div>
                                                    <div style={{ fontSize: 10, color: C.faint, marginBottom: 10 }}>
                                                        🕐 Há {alert.daysElapsed} dia{alert.daysElapsed !== 1 ? 's' : ''}
                                                    </div>

                                                    {/* Action buttons */}
                                                    <div style={{ display: 'flex', gap: 7 }}>
                                                        <button
                                                            className="action-btn"
                                                            onClick={() => setNotifiedClients(prev => new Set([...prev, alert.id]))}
                                                            disabled={isNotified}
                                                            style={{
                                                                padding: '6px 12px', borderRadius: 8,
                                                                background: isNotified ? '#f0fdf4' : C.card,
                                                                border: `1px solid ${isNotified ? '#86efac' : C.border}`,
                                                                color: isNotified ? C.greenDk : C.muted,
                                                                fontSize: 11, fontWeight: 700, cursor: isNotified ? 'default' : 'pointer',
                                                                display: 'flex', alignItems: 'center', gap: 5,
                                                                transition: 'all 0.15s',
                                                            }}
                                                        >
                                                            {isNotified ? '✅ Notificado' : '✉️ Notificar Cliente'}
                                                        </button>
                                                        <button
                                                            className="action-btn"
                                                            onClick={() => router.push(`/admin/clients/${alert.clientId}`)}
                                                            style={{
                                                                padding: '6px 12px', borderRadius: 8,
                                                                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                                                                border: 'none', color: '#fff',
                                                                fontSize: 11, fontWeight: 800, cursor: 'pointer',
                                                                display: 'flex', alignItems: 'center', gap: 5,
                                                                boxShadow: '0 2px 6px rgba(34,197,94,0.25)',
                                                                transition: 'all 0.15s',
                                                            }}
                                                        >
                                                            🎯 Assumir Caso
                                                        </button>
                                                        <button
                                                            className="action-btn"
                                                            onClick={() => setDismissedAlerts(prev => new Set([...prev, alert.id]))}
                                                            style={{
                                                                padding: '6px 10px', borderRadius: 8,
                                                                background: 'none', border: `1px solid #f1f5f9`,
                                                                color: C.faint, fontSize: 11,
                                                                cursor: 'pointer', marginLeft: 'auto',
                                                            }}
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>

                    {/* ── SECTION 5: SYSTEM HEALTH TERMINAL ── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{
                            background: '#0f172a',
                            borderRadius: 18, border: '1px solid #1e293b',
                            overflow: 'hidden',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                        }}>
                            {/* Terminal header */}
                            <div style={{ padding: '14px 18px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
                                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} />
                                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e' }} />
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', fontFamily: 'monospace', marginLeft: 4 }}>
                                    bomjur-ops-terminal — {clockTime}
                                </span>
                                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', animation: 'pulseGreen 2s ease-in-out infinite' }} />
                                    <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 700 }}>LIVE</span>
                                </div>
                            </div>

                            {/* Terminal title */}
                            <div style={{ padding: '14px 18px 10px', borderBottom: '1px solid #1e293b' }}>
                                <div style={{ fontSize: 10, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                                    ⚙️ Saúde do Sistema — Bomjur Technology
                                </div>
                                {MOCK_HEALTH.map((h, i) => (
                                    <div key={h.service} style={{
                                        display: 'flex', alignItems: 'center', gap: 10,
                                        padding: '8px 0',
                                        borderBottom: i < MOCK_HEALTH.length - 1 ? '1px solid #1e293b' : 'none',
                                    }}>
                                        <div style={{
                                            width: 7, height: 7, borderRadius: '50%',
                                            background: healthDot(h.status), flexShrink: 0,
                                            animation: h.status === 'online' ? 'pulseGreen 2.5s ease-in-out infinite' : 'none',
                                        }} />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', fontFamily: 'monospace' }}>
                                                {h.service}
                                            </div>
                                            <div style={{ fontSize: 10, color: '#475569', fontFamily: 'monospace' }}>
                                                {h.detail}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            {h.latency && h.latency !== '—' && (
                                                <span style={{ fontSize: 9, color: '#334155', fontFamily: 'monospace' }}>{h.latency}</span>
                                            )}
                                            <span style={{
                                                fontSize: 9, fontWeight: 800, fontFamily: 'monospace',
                                                color: healthDot(h.status),
                                                background: `${healthDot(h.status)}18`,
                                                border: `1px solid ${healthDot(h.status)}40`,
                                                borderRadius: 99, padding: '1px 7px',
                                            }}>
                                                {{ online: 'ONLINE', degraded: 'DEGRADED', offline: 'OFFLINE' }[h.status]}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Log output */}
                            <div style={{ padding: '12px 18px 16px' }}>
                                <div style={{ fontSize: 9, fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, fontFamily: 'monospace' }}>
                                    ▸ Log de Eventos
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {MOCK_LOGS.map(log => (
                                        <div key={log.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                            <span style={{ fontSize: 9, color: '#334155', fontFamily: 'monospace', whiteSpace: 'nowrap', marginTop: 1 }}>
                                                {log.time}
                                            </span>
                                            <span style={{ fontSize: 9, fontWeight: 800, color: logColor(log.level), fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                                                {logPrefix(log.level)}
                                            </span>
                                            <span style={{ fontSize: 9, color: '#64748b', fontFamily: 'monospace', lineHeight: 1.5 }}>
                                                {log.message}
                                            </span>
                                        </div>
                                    ))}
                                    {/* Blinking cursor */}
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                                        <span style={{ fontSize: 9, color: '#334155', fontFamily: 'monospace' }}>{clockTime}</span>
                                        <span style={{
                                            fontSize: 9, fontWeight: 800, color: '#22c55e',
                                            fontFamily: 'monospace', animation: 'terminalBlink 1s step-end infinite',
                                        }}>
                                            █
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Quick actions card */}
                        <div style={{
                            background: C.card, borderRadius: 16,
                            border: `1px solid ${C.border}`,
                            padding: '18px 20px',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                        }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                                Ações Rápidas do Super Admin
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {[
                                    { emoji: '👥', label: 'Ver Todos os Clientes', action: () => router.push('/admin') },
                                    { emoji: '📊', label: 'Exportar Relatório Mensal', action: () => {} },
                                    { emoji: '🤖', label: 'Re-processar Fila da IA', action: () => {} },
                                    { emoji: '🛂', label: 'Marcar Lote como Protocolado', action: () => {} },
                                ].map(({ emoji, label, action }) => (
                                    <button
                                        key={label}
                                        onClick={action}
                                        className="action-btn"
                                        style={{
                                            width: '100%', padding: '10px 14px',
                                            background: '#fafafa', border: `1px solid ${C.border}`,
                                            borderRadius: 10, fontSize: 12, fontWeight: 600,
                                            color: C.text, cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: 10,
                                            textAlign: 'left', transition: 'all 0.15s',
                                        }}
                                    >
                                        <span>{emoji}</span>
                                        <span style={{ flex: 1 }}>{label}</span>
                                        <span style={{ color: C.faint, fontSize: 14 }}>→</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

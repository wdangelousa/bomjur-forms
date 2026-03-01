'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Client {
    id: string
    full_name: string
    email: string
    last_active_at: string | null
    is_active: boolean
    application?: {
        id: string
        status: string
        overall_progress: number
        i485_waiver_accepted_at: string | null
    } | null
    documents_count?: number
}

export default function AdminDashboard() {
    const [clients, setClients] = useState<Client[]>([])
    const [adminName, setAdminName] = useState('')
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const router = useRouter()

    useEffect(() => {
        const load = async () => {
            // 1. Verifica se há usuário logado
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { router.push('/login'); return }

            // 2. Busca o role via API segura (usa service role key, sem bloqueio de RLS)
            const res = await fetch('/api/auth/role')
            const { role, tenantId } = await res.json()

            const isAdmin = (role === 'admin' || role === 'tenant_admin' || role === 'super_admin')
            if (!isAdmin) { router.push('/i485'); return }

            // 3. Busca o nome do admin também via API segura (já temos o user.id)
            setAdminName(user.email ?? 'Admin')

            // 4. Lista de clientes
            const { data: clientProfiles } = await supabase
                .from('user_profiles')
                .select('id, full_name, email, last_active_at, is_active')
                .eq('role', 'client')
                .order('full_name')

            if (!clientProfiles) { setLoading(false); return }

            // 5. Busca aplicações I-485 e contagem de documentos para cada cliente
            const enriched = await Promise.all(
                clientProfiles.map(async (c) => {
                    const [{ data: app }, { count }] = await Promise.all([
                        supabase.from('i485_applications')
                            .select('id, status, overall_progress, i485_waiver_accepted_at')
                            .eq('client_id', c.id)
                            .order('created_at', { ascending: false })
                            .limit(1)
                            .single(),
                        supabase.from('client_documents')
                            .select('*', { count: 'exact', head: true })
                            .eq('client_id', c.id),
                    ])
                    return { ...c, application: app ?? null, documents_count: count ?? 0 }
                })
            )

            setClients(enriched)
            setLoading(false)
        }
        load()
    }, [router])

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    const filtered = clients.filter(c =>
        c.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        c.email?.toLowerCase().includes(search.toLowerCase())
    )

    const statusColor = (status?: string) => {
        if (!status) return '#475569'
        const map: Record<string, string> = {
            draft: '#94a3b8', in_progress: '#6366f1', pending_review: '#f59e0b',
            filed: '#22c55e', approved: '#10b981', denied: '#ef4444',
        }
        return map[status] ?? '#94a3b8'
    }

    const statusLabel = (status?: string) => {
        if (!status) return 'Sem processo'
        const map: Record<string, string> = {
            draft: 'Rascunho', in_progress: 'Em andamento',
            pending_review: 'Ag. revisão', filed: 'Protocolado',
            approved: 'Aprovado', denied: 'Negado',
        }
        return map[status] ?? status
    }

    if (loading) return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg,#0f0c29,#302b63,#24243e)', fontFamily: 'Inter, sans-serif'
        }}>
            <p style={{ color: '#94a3b8' }}>Carregando clientes...</p>
        </div>
    )

    return (
        <div style={S.page}>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input::placeholder { color: #475569; }
        input:focus { outline: none; border-color: #7c3aed !important; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
      `}</style>

            {/* ── Header ── */}
            <header style={S.header}>
                <div style={S.headerInner}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 24 }}>⚖️</span>
                        <div>
                            <h1 style={S.logoTitle}>Bomjur · Admin</h1>
                            <p style={S.logoSub}>PROEX VENTURE LLC</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <span style={{ fontSize: 13, color: '#94a3b8' }}>👤 {adminName}</span>
                        <button style={S.logoutBtn} onClick={handleLogout}>Sair →</button>
                    </div>
                </div>
            </header>

            {/* ── Métricas ── */}
            <div style={S.metrics}>
                {[
                    { label: 'Clientes ativos', value: clients.filter(c => c.is_active).length, icon: '👥', color: '#6366f1' },
                    { label: 'Com I-485 aberto', value: clients.filter(c => c.application).length, icon: '📋', color: '#a78bfa' },
                    { label: 'Waiver assinado', value: clients.filter(c => c.application?.i485_waiver_accepted_at).length, icon: '✅', color: '#22c55e' },
                    { label: 'Documentos totais', value: clients.reduce((a, c) => a + (c.documents_count ?? 0), 0), icon: '📁', color: '#f59e0b' },
                ].map(m => (
                    <div key={m.label} style={S.metricCard}>
                        <span style={{ fontSize: 24 }}>{m.icon}</span>
                        <div>
                            <p style={{ fontSize: 26, fontWeight: 800, color: m.color }}>{m.value}</p>
                            <p style={{ fontSize: 11, color: '#64748b' }}>{m.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Barra de pesquisa ── */}
            <div style={S.searchWrap}>
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="🔍  Buscar cliente por nome ou e-mail..."
                    style={S.searchInput}
                />
            </div>

            {/* ── Tabela de clientes ── */}
            <div style={S.tableWrap}>
                <table style={S.table}>
                    <thead>
                        <tr style={S.thead}>
                            {['Cliente', 'E-mail', 'Documentos', 'Waiver I-485', 'Status do Processo', 'Progresso', ''].map(h => (
                                <th key={h} style={S.th}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 && (
                            <tr>
                                <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#475569', fontSize: 14 }}>
                                    Nenhum cliente encontrado.
                                </td>
                            </tr>
                        )}
                        {filtered.map(client => (
                            <tr key={client.id} style={S.tr}>
                                {/* Nome */}
                                <td style={S.td}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{ ...S.avatar, background: client.is_active ? '#6366f118' : '#47556918' }}>
                                            {(client.full_name ?? 'C')[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <p style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 14 }}>
                                                {client.full_name ?? '—'}
                                            </p>
                                            <p style={{ fontSize: 11, color: client.is_active ? '#22c55e' : '#475569' }}>
                                                {client.is_active ? '● Ativo' : '● Inativo'}
                                            </p>
                                        </div>
                                    </div>
                                </td>

                                {/* Email */}
                                <td style={{ ...S.td, color: '#94a3b8', fontSize: 13 }}>{client.email}</td>

                                {/* Documentos */}
                                <td style={S.tdCenter}>
                                    <span style={S.pill('#6366f1')}>{client.documents_count} docs</span>
                                </td>

                                {/* Waiver */}
                                <td style={S.tdCenter}>
                                    {client.application?.i485_waiver_accepted_at
                                        ? <span style={S.pill('#22c55e')}>✓ Assinado</span>
                                        : <span style={S.pill('#475569')}>Pendente</span>}
                                </td>

                                {/* Status */}
                                <td style={S.tdCenter}>
                                    <span style={{
                                        ...S.pill(statusColor(client.application?.status)),
                                        minWidth: 100, textAlign: 'center',
                                    }}>
                                        {statusLabel(client.application?.status)}
                                    </span>
                                </td>

                                {/* Progresso */}
                                <td style={{ ...S.td, minWidth: 120 }}>
                                    {client.application ? (
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                <span style={{ fontSize: 11, color: '#64748b' }}>I-485</span>
                                                <span style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa' }}>
                                                    {Math.round(client.application.overall_progress ?? 0)}%
                                                </span>
                                            </div>
                                            <div style={{ height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 999, overflow: 'hidden' }}>
                                                <div style={{
                                                    height: '100%', background: 'linear-gradient(90deg,#7c3aed,#a78bfa)',
                                                    borderRadius: 999, width: `${client.application.overall_progress ?? 0}%`,
                                                }} />
                                            </div>
                                        </div>
                                    ) : (
                                        <span style={{ fontSize: 12, color: '#475569' }}>—</span>
                                    )}
                                </td>

                                {/* Ação */}
                                <td style={S.tdCenter}>
                                    <button
                                        onClick={() => router.push(`/admin/clients/${client.id}`)}
                                        style={S.actionBtn}
                                    >
                                        Ver →
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

// ─── Helpers de estilo ──────────────────────────────────────────────────────
const pill = (color: string): React.CSSProperties => ({
    display: 'inline-block', padding: '3px 10px', borderRadius: 999,
    background: `${color}18`, color, border: `1px solid ${color}30`,
    fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
})

const S: any = {
    page: {
        minHeight: '100vh',
        background: 'linear-gradient(135deg,#0f0c29 0%,#302b63 50%,#24243e 100%)',
        fontFamily: "'Inter', system-ui, sans-serif",
    },
    header: { background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.07)', position: 'sticky', top: 0, zIndex: 50 },
    headerInner: { maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    logoTitle: { fontSize: 16, fontWeight: 700, background: 'linear-gradient(90deg,#a78bfa,#818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
    logoSub: { fontSize: 11, color: '#64748b' },
    logoutBtn: { padding: '7px 16px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', borderRadius: 8, cursor: 'pointer', fontSize: 13 },
    metrics: { display: 'flex', gap: 16, padding: '24px 24px 0', maxWidth: 1200, margin: '0 auto', flexWrap: 'wrap' as const },
    metricCard: {
        flex: 1, minWidth: 160,
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14, padding: '18px 20px',
        display: 'flex', gap: 14, alignItems: 'center',
    },
    searchWrap: { maxWidth: 1200, margin: '20px auto 0', padding: '0 24px' },
    searchInput: {
        width: '100%', padding: '12px 16px',
        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 10, color: '#f1f5f9', fontSize: 14, fontFamily: 'inherit',
    },
    tableWrap: { maxWidth: 1200, margin: '20px auto 40px', padding: '0 24px', overflowX: 'auto' as const },
    table: { width: '100%', borderCollapse: 'collapse' as const },
    thead: { background: 'rgba(255,255,255,0.03)' },
    th: { padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#64748b', textAlign: 'left' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5, borderBottom: '1px solid rgba(255,255,255,0.07)' },
    tr: { borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.15s' },
    td: { padding: '14px 16px', verticalAlign: 'middle' as const, color: '#e2e8f0' },
    tdCenter: { padding: '14px 16px', verticalAlign: 'middle' as const, textAlign: 'center' as const },
    avatar: { width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#a78bfa', border: '1px solid rgba(167,139,250,0.2)', flexShrink: 0 },
    pill: (color: string) => pill(color),
    actionBtn: { padding: '6px 14px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', color: '#818cf8', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 },
}

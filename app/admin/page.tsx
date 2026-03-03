'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ============================================================
// TYPES & INTERFACES
// ============================================================
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

// ============================================================
// DESIGN TOKENS (Proexpand Palette)
// ============================================================
const C = {
    primary: '#22c55e', // Verde Proexpand
    secondary: '#0f172a', // Slate 900
    accent: '#22c55e', // Verde Proexpand (unificado)
    blue: '#2563eb',   // Azul semântico (status "filed" apenas)
    border: '#e2e8f0',
    bg: '#f8fafc',
    textMain: '#1e293b',
    textMuted: '#64748b'
}

export default function AdminDashboard() {
    const [clients, setClients] = useState<Client[]>([])
    const [adminName, setAdminName] = useState('')
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const router = useRouter()

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { router.push('/login'); return }

            const res = await fetch('/api/auth/role')
            const { role } = await res.json()

            const isAdmin = (role === 'admin' || role === 'tenant_admin' || role === 'super_admin')
            if (!isAdmin) { router.push('/i485'); return }

            setAdminName(user.email ?? 'Admin')

            const { data: clientProfiles } = await supabase
                .from('user_profiles')
                .select('id, full_name, email, last_active_at, is_active')
                .eq('role', 'client')
                .order('full_name')

            if (!clientProfiles) { setLoading(false); return }

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

    const filtered = clients.filter(c =>
        c.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        c.email?.toLowerCase().includes(search.toLowerCase())
    )

    const statusColor = (status?: string) => {
        if (!status) return C.textMuted
        const map: Record<string, string> = {
            draft: '#94a3b8', in_progress: C.primary, pending_review: '#f59e0b',
            filed: C.blue, approved: '#10b981', denied: '#ef4444',
        }
        return map[status] ?? '#94a3b8'
    }

    const statusLabel = (status?: string) => {
        if (!status) return 'Sem processo'
        const map: Record<string, string> = {
            draft: 'Rascunho', in_progress: 'Em análise',
            pending_review: 'Revisão', filed: 'Protocolado',
            approved: 'Concluído', denied: 'Negado',
        }
        return map[status] ?? status
    }

    if (loading) return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}>
            <div style={{ animation: 'pulse 2s infinite', color: C.textMuted, fontWeight: 600 }}>Sincronizando plataforma...</div>
        </div>
    )

    return (
        <div style={{ minHeight: '100vh', background: C.bg, paddingTop: '120px', fontFamily: 'Inter, sans-serif' }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
                * { box-sizing: border-box; margin: 0; padding: 0; }
                input:focus { outline: none; border-color: ${C.primary} !important; box-shadow: 0 0 0 4px ${C.primary}15; }
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
            `}</style>

            {/* ── TOP NAV BAR ── */}
            <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, height: 72,
                background: '#fff', borderBottom: `1px solid ${C.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0 40px', zIndex: 100, boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <button
                        onClick={() => router.back()}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: C.textMuted, fontWeight: 600, fontSize: 13 }}
                    >
                        ← Voltar
                    </button>
                    <div style={{ width: 1, height: 24, background: C.border }} />
                    <h1 style={{ fontSize: 18, fontWeight: 800, color: C.secondary, margin: 0 }}>
                        Olá, <span style={{ color: C.primary }}>{adminName.split('@')[0]}</span> 👋
                    </h1>
                </div>

                <button
                    onClick={async () => {
                        await supabase.auth.signOut()
                        router.push('/login')
                    }}
                    style={{
                        padding: '8px 16px', borderRadius: 8, background: '#fee2e2', color: '#ef4444',
                        border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'background 0.2s'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#fecaca')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#fee2e2')}
                >
                    Sair da Conta
                </button>
            </div>

            {/* ── MÉTRICAS (TECH STYLE) ── */}
            <div style={{ display: 'flex', gap: 20, padding: '0 40px', maxWidth: 1240, margin: '0 auto' }}>
                {[
                    { label: 'Usuários na Fila', value: clients.length, icon: '👥', color: C.secondary },
                    { label: 'Processos I-485', value: clients.filter(c => c.application).length, icon: '🚀', color: C.primary },
                    { label: 'Documentos Extraídos', value: clients.reduce((a, c) => a + (c.documents_count ?? 0), 0), icon: '📑', color: C.accent },
                ].map(m => (
                    <div key={m.label} style={{
                        flex: 1, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 20, padding: '24px',
                        display: 'flex', alignItems: 'center', gap: 20, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
                    }}>
                        <div style={{ fontSize: 28 }}>{m.icon}</div>
                        <div>
                            <p style={{ fontSize: 28, fontWeight: 800, color: m.color, lineHeight: 1 }}>{m.value}</p>
                            <p style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>{m.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── BUSCA INTELIGENTE ── */}
            <div style={{ maxWidth: 1240, margin: '32px auto 0', padding: '0 40px' }}>
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Filtrar clientes por nome ou e-mail..."
                    style={{
                        width: '100%', padding: '16px 20px', background: '#fff', border: `1px solid ${C.border}`,
                        borderRadius: 16, fontSize: 14, fontWeight: 500, color: C.textMain, transition: 'all 0.2s'
                    }}
                />
            </div>

            {/* ── LISTA DE CLIENTES (CLEAN TABLE) ── */}
            <div style={{ maxWidth: 1240, margin: '24px auto 80px', padding: '0 40px' }}>
                <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 24, overflow: 'hidden', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.04)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: `2px solid ${C.border}` }}>
                                {['Beneficiário', 'Ficheiros', 'Waiver', 'Status do Caso', 'Progresso', ''].map(h => (
                                    <th key={h} style={{ padding: '20px 24px', fontSize: 12, fontWeight: 700, color: '#475569', textAlign: 'left', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(client => (
                                <tr key={client.id} style={{ borderBottom: `1px solid ${C.border}`, transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                    <td style={{ padding: '24px 24px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                            <div style={{ width: 44, height: 44, borderRadius: 14, background: `${C.primary}15`, color: C.secondary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16 }}>
                                                {(client.full_name ?? 'C')[0]}
                                            </div>
                                            <div>
                                                <p style={{ fontWeight: 700, color: C.secondary, fontSize: 15 }}>{client.full_name || 'Sem nome'}</p>
                                                <p style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>{client.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '24px 24px' }}>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: C.secondary, background: '#f1f5f9', padding: '6px 12px', borderRadius: 8 }}>{client.documents_count} itens</span>
                                    </td>
                                    <td style={{ padding: '24px 24px' }}>
                                        {client.application?.i485_waiver_accepted_at
                                            ? <span style={{ fontSize: 12, fontWeight: 700, color: '#059669', background: '#d1fae5', padding: '6px 10px', borderRadius: 8 }}>✓ Firmado</span>
                                            : <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', background: '#f1f5f9', padding: '6px 10px', borderRadius: 8 }}>Pendente</span>}
                                    </td>
                                    <td style={{ padding: '24px 24px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: statusColor(client.application?.status) }} />
                                            <span style={{ fontSize: 13, fontWeight: 700, color: C.secondary }}>{statusLabel(client.application?.status)}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '24px 24px' }}>
                                        <div style={{ width: 140 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                                <span style={{ fontSize: 12, fontWeight: 800, color: C.secondary }}>{Math.round(client.application?.overall_progress ?? 0)}%</span>
                                            </div>
                                            <div style={{ height: 6, background: '#e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                                                <div style={{ height: '100%', background: C.primary, borderRadius: 10, width: `${client.application?.overall_progress ?? 0}%` }} />
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '24px 24px', textAlign: 'right' }}>
                                        <button
                                            onClick={() => router.push(`/admin/clients/${client.id}`)}
                                            style={{ padding: '10px 20px', background: C.secondary, color: '#fff', borderRadius: 12, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                                            onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                                            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                                        >
                                            Gerenciar
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
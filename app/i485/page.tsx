'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import I485WaiverModal from '../components/I485WaiverModal'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Estados possíveis da sessão ──────────────────────────────────────────────
type PageState = 'loading' | 'no_session' | 'no_application' | 'waiver_pending' | 'ready'

interface SessionData {
    applicationId: string
    clientName: string
    waiverAcceptedAt: string | null
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function I485StartPage() {
    const [pageState, setPageState] = useState<PageState>('loading')
    const [session, setSession] = useState<SessionData | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const init = async () => {
            // 1. Verifica a sessão Supabase Auth
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) {
                setPageState('no_session')
                return
            }

            // 2. Busca nome do usuário em user_profiles
            const { data: profile } = await supabase
                .from('user_profiles')
                .select('full_name, tenant_id')
                .eq('id', user.id)
                .single()

            const clientName = profile?.full_name ?? user.email ?? 'Cliente'

            // 3. Busca a aplicação I-485 mais recente deste usuário
            const { data: application, error: appErr } = await supabase
                .from('i485_applications')
                .select('id, i485_waiver_accepted_at, status')
                .eq('client_id', user.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single()

            if (appErr || !application) {
                // Sem aplicação I-485 criada ainda
                setPageState('no_application')
                return
            }

            setSession({
                applicationId: application.id,
                clientName,
                waiverAcceptedAt: application.i485_waiver_accepted_at,
            })

            // 4. Define o estado da página baseado no aceite do waiver
            setPageState(application.i485_waiver_accepted_at ? 'ready' : 'waiver_pending')
        }

        init()
    }, [])

    // Callback quando o usuário aceitar o modal
    const handleWaiverAccepted = () => {
        setSession(prev => prev ? { ...prev, waiverAcceptedAt: new Date().toISOString() } : null)
        setPageState('ready')
    }

    // ─── Estados de carregamento / erro ──────────────────────────────────────
    if (pageState === 'loading') return <FullscreenMsg icon="⟳" text="Verificando sua sessão..." spin />

    if (pageState === 'no_session') return (
        <FullscreenMsg icon="🔒" text="Você precisa estar logado para acessar o I-485.">
            <a href="/login" style={S.linkBtn}>Fazer login →</a>
        </FullscreenMsg>
    )

    if (pageState === 'no_application') return (
        <FullscreenMsg icon="📋" text="Nenhuma aplicação I-485 encontrada para sua conta.">
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 8 }}>
                Entre em contato com a PROEX para iniciar o processo.
            </p>
        </FullscreenMsg>
    )

    // ─── Modal bloqueante (waiver pendente) ──────────────────────────────────
    const showModal = pageState === 'waiver_pending' && session

    return (
        <div style={S.page}>
            {showModal && (
                <I485WaiverModal
                    applicationId={session!.applicationId}
                    clientName={session!.clientName}
                    onAccepted={handleWaiverAccepted}
                />
            )}

            {/* ── Header ── */}
            <header style={S.header}>
                <span style={S.logoIcon}>⚖️</span>
                <div>
                    <h1 style={S.logoTitle}>Bomjur · I-485</h1>
                    <p style={S.logoSub}>Ajuste de Status — Bem-vindo, {session?.clientName}!</p>
                </div>
            </header>

            {/* ── Conteúdo da Missão 1 (liberado após aceite) ── */}
            <main style={S.main}>
                {pageState === 'ready' && (
                    <div style={S.card}>
                        <div style={S.cardIcon}>🚀</div>
                        <h2 style={S.cardTitle}>Missão 1 — Informações Pessoais</h2>
                        <p style={S.cardDesc}>
                            Sua declaração foi registrada com sucesso em{' '}
                            <strong style={{ color: '#22c55e' }}>
                                {session?.waiverAcceptedAt
                                    ? new Date(session.waiverAcceptedAt).toLocaleString('pt-BR')
                                    : '—'}.
                            </strong>{' '}
                            Vamos começar o preenchimento do I-485 com seus dados pré-extraídos.
                        </p>
                        <div style={S.badge}>✅ Aditivo de Escopo aceito e registrado</div>
                    </div>
                )}
            </main>

            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
        </div>
    )
}

// ─── Helper: tela de estado (carregando, erro, etc.) ────────────────────────
function FullscreenMsg({ icon, text, spin, children }: {
    icon: string; text: string; spin?: boolean; children?: React.ReactNode
}) {
    return (
        <div style={{
            minHeight: '100vh', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg,#0f0c29,#302b63,#24243e)',
            fontFamily: "'Inter', system-ui, sans-serif", color: '#e2e8f0', gap: 12
        }}>
            <span style={{ fontSize: 40, animation: spin ? 'spin 1s linear infinite' : 'none' }}>{icon}</span>
            <p style={{ fontSize: 16, color: '#94a3b8' }}>{text}</p>
            {children}
        </div>
    )
}

// ─── Estilos ─────────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
    page: {
        minHeight: '100vh',
        background: 'linear-gradient(135deg,#0f0c29 0%,#302b63 50%,#24243e 100%)',
        fontFamily: "'Inter', system-ui, sans-serif", color: '#e2e8f0',
    },
    header: {
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '20px 32px',
        background: 'rgba(255,255,255,0.04)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
    },
    logoIcon: { fontSize: 28 },
    logoTitle: {
        fontSize: 18, fontWeight: 700,
        background: 'linear-gradient(90deg,#a78bfa,#818cf8)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
    },
    logoSub: { fontSize: 12, color: '#94a3b8' },
    main: {
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: 'calc(100vh - 80px)', padding: 24,
    },
    card: {
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(34,197,94,0.3)', borderRadius: 20,
        padding: '48px 40px', maxWidth: 520, textAlign: 'center',
        boxShadow: '0 0 40px rgba(34,197,94,0.1)',
    },
    cardIcon: { fontSize: 48, marginBottom: 20 },
    cardTitle: { fontSize: 22, fontWeight: 700, color: '#f1f5f9', marginBottom: 12 },
    cardDesc: { fontSize: 14, color: '#94a3b8', lineHeight: 1.7, marginBottom: 24 },
    badge: {
        display: 'inline-block', padding: '8px 20px',
        background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)',
        borderRadius: 999, fontSize: 13, fontWeight: 600, color: '#22c55e',
    },
    linkBtn: {
        display: 'inline-block', marginTop: 16, padding: '10px 24px',
        background: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
        color: '#fff', fontWeight: 700, fontSize: 14,
        borderRadius: 10, textDecoration: 'none',
    },
}

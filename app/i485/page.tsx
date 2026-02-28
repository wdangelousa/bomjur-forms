'use client'

import { useState } from 'react'
import I485WaiverModal from '../components/I485WaiverModal'

// ─── Esta página é o ponto de entrada para a jornada I-485 ───────────────────
// Em produção, applicationId e clientName virão da sessão do usuário.
// Por ora, usamos um placeholder para testar o fluxo completo.

const DEMO_APPLICATION_ID = 'coloque-aqui-o-id-da-i485_application'
const DEMO_CLIENT_NAME = 'João da Silva' // substituir pelo nome real da sessão

export default function I485StartPage() {
    const [waiverAccepted, setWaiverAccepted] = useState(false)

    return (
        <div style={S.page}>
            {/* ── Modal bloqueante (só some após aceitar todos os termos) ── */}
            {!waiverAccepted && (
                <I485WaiverModal
                    applicationId={DEMO_APPLICATION_ID}
                    clientName={DEMO_CLIENT_NAME}
                    onAccepted={() => setWaiverAccepted(true)}
                />
            )}

            {/* ── Conteúdo da Missão 1 (liberado após aceite) ── */}
            <header style={S.header}>
                <span style={S.logoIcon}>⚖️</span>
                <div>
                    <h1 style={S.logoTitle}>Bomjur · I-485</h1>
                    <p style={S.logoSub}>Ajuste de Status — Missão 1</p>
                </div>
            </header>

            <main style={S.main}>
                <div style={S.card}>
                    <div style={S.cardIcon}>🚀</div>
                    <h2 style={S.cardTitle}>Missão 1 — Informações Pessoais</h2>
                    <p style={S.cardDesc}>
                        Sua declaração foi registrada com sucesso. Vamos começar o preenchimento
                        do I-485. Os dados extraídos dos seus documentos já estão pré-preenchidos.
                    </p>
                    <div style={S.badge}>✅ Aditivo de Escopo aceito e registrado</div>
                </div>
            </main>

            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>
        </div>
    )
}

const S: Record<string, React.CSSProperties> = {
    page: {
        minHeight: '100vh',
        background: 'linear-gradient(135deg,#0f0c29 0%,#302b63 50%,#24243e 100%)',
        fontFamily: "'Inter', system-ui, sans-serif",
        color: '#e2e8f0',
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
    logoSub: { fontSize: 11, color: '#94a3b8' },
    main: {
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: 'calc(100vh - 80px)', padding: 24,
    },
    card: {
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(34,197,94,0.3)',
        borderRadius: 20, padding: '48px 40px',
        maxWidth: 480, textAlign: 'center',
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
}

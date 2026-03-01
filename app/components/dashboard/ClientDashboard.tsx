'use client'

import React from 'react'
import { useRouter } from 'next/navigation'

// ============================================================
// TYPES
// ============================================================
interface I140Petition {
    id: string
    beneficiary_name: string
    category: string
    status: string
    priority_date: string | null
    updated_at?: string | null
}

interface ClientDashboardProps {
    petition: I140Petition | null
    tenantName: string
}

// ============================================================
// DESIGN TOKENS
// ============================================================
const C = {
    bgCard: 'rgba(255,255,255,0.05)',
    border: 'rgba(255,255,255,0.08)',
    text1: '#f1f5f9',
    text2: '#94a3b8',
    text3: '#64748b',
    accent: '#a78bfa',
    accentDk: '#7c3aed',
    success: '#22c55e',
}
const F = "'Inter', system-ui, sans-serif"

// ============================================================
// JOURNEY STAGES CONFIG
// ============================================================
const JOURNEY_STAGES = [
    { key: 'draft', label: '1. Rascunho', desc: 'Dados em preenchimento' },
    { key: 'pending', label: '2. Pendente', desc: 'Aguardando documentação' },
    { key: 'submitted', label: '3. Protocolado', desc: 'Petição enviada ao USCIS' },
    { key: 'processing', label: '4. Em Análise', desc: 'USCIS revisando a petição' },
    { key: 'approved', label: '5. Aprovada!', desc: 'Pronto para Fase 3 (I-485)' },
]

function getCompletedStages(status: string): number {
    switch (status) {
        case 'draft': return 1
        case 'pending': return 2
        case 'submitted': return 3
        case 'processing': return 4
        case 'approved': return 5
        case 'denied': return 0
        default: return 1
    }
}

// ============================================================
// CLIENT DASHBOARD COMPONENT
// ============================================================
export default function ClientDashboard({ petition, tenantName }: ClientDashboardProps) {
    const router = useRouter()

    // Se não tem petição vinculada à conta do client
    if (!petition) {
        return (
            <div style={{
                textAlign: 'center', padding: '72px 32px',
                background: C.bgCard, border: `1px dashed ${C.border}`,
                borderRadius: 20, animation: 'fadeIn 0.35s ease both',
            }}>
                <div style={{ fontSize: 60, marginBottom: 20, filter: 'drop-shadow(0 4px 16px rgba(167,139,250,0.25))' }}>📋</div>
                <h3 style={{ fontSize: 20, fontWeight: 800, color: C.text1, margin: '0 0 10px' }}>
                    Nenhum processo vinculado à sua conta ainda.
                </h3>
                <p style={{ fontSize: 14, color: C.text2, margin: '0 0 28px', lineHeight: 1.65, maxWidth: 460, marginLeft: 'auto', marginRight: 'auto' }}>
                    Sua conta com a {tenantName} foi criada, mas seu processo I-140 ainda não foi iniciado ou vinculado. Entre em contato com a equipe responsável para mais instruções.
                </p>
            </div>
        )
    }

    const completed = getCompletedStages(petition.status)
    const isApproved = petition.status === 'approved'
    const isDenied = petition.status === 'denied'
    const isTransitioning = petition.status === 'processing' || isApproved

    return (
        <div style={{ animation: 'fadeIn 0.4s ease both', fontFamily: F }}>

            {/* ── Welcome Header ── */}
            <div style={{ marginBottom: 32 }}>
                <h2 style={{ fontSize: 28, fontWeight: 900, color: C.text1, letterSpacing: -0.5, marginBottom: 6 }}>
                    Olá, {petition.beneficiary_name.split(' ')[0]}! Bem-vindo ao seu portal.
                </h2>
                <p style={{ fontSize: 15, color: C.text2, margin: 0 }}>
                    Acompanhe o andamento do seu processo de imigração ({petition.category}) com a {tenantName}.
                </p>
            </div>

            {/* ── Journey Tracker Card ── */}
            <div style={{
                background: C.bgCard, border: `1px solid ${C.border}`,
                borderRadius: 22, padding: '32px 36px', marginBottom: 28,
                boxShadow: '0 12px 32px rgba(0,0,0,0.15)',
            }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 24 }}>
                    Status da sua Petição (I-140)
                </div>

                {isDenied ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ fontSize: 40 }}>❌</div>
                        <div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: '#ef4444', marginBottom: 4 }}>Petição Negada</div>
                            <div style={{ fontSize: 14, color: C.text2 }}>Entre em contato com nossa equipe para avaliar as opções de recurso.</div>
                        </div>
                    </div>
                ) : (
                    <div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, overflowX: 'auto', paddingBottom: 10 }}>
                            {JOURNEY_STAGES.map((stage, idx) => {
                                const isDone = completed > idx
                                const isActive = completed === idx + 1
                                const isPending = completed < idx + 1

                                return (
                                    <React.Fragment key={stage.key}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, flex: 1, minWidth: 100 }}>
                                            <div style={{
                                                width: 52, height: 52, borderRadius: '50%',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: isDone ? 22 : 18, fontWeight: 800,
                                                background: isDone
                                                    ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                                                    : isActive
                                                        ? `linear-gradient(135deg, ${C.accent}, ${C.accentDk})`
                                                        : 'rgba(255,255,255,0.04)',
                                                border: isDone
                                                    ? '2px solid rgba(34,197,94,0.5)'
                                                    : isActive
                                                        ? '2px solid rgba(167,139,250,0.6)'
                                                        : `2px solid ${C.border}`,
                                                color: isPending ? C.text3 : '#fff',
                                                boxShadow: isActive ? '0 0 24px rgba(167,139,250,0.4)' : isDone ? '0 0 16px rgba(34,197,94,0.3)' : 'none',
                                                transition: 'all 0.4s ease',
                                            }}>
                                                {isDone ? '✓' : idx + 1}
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{
                                                    fontSize: 13, fontWeight: isDone || isActive ? 800 : 500,
                                                    color: isDone ? C.success : isActive ? C.accent : C.text3,
                                                    marginBottom: 2
                                                }}>
                                                    {stage.label}
                                                </div>
                                                <div style={{ fontSize: 11, color: C.text3, lineHeight: 1.3 }}>
                                                    {stage.desc}
                                                </div>
                                            </div>
                                        </div>

                                        {idx < JOURNEY_STAGES.length - 1 && (
                                            <div style={{
                                                height: 3, flex: '1', marginTop: 24, borderRadius: 99, minWidth: 20,
                                                background: completed > idx + 1
                                                    ? 'linear-gradient(90deg, #22c55e, rgba(34,197,94,0.4))'
                                                    : completed === idx + 1
                                                        ? `linear-gradient(90deg, ${C.accent}, rgba(167,139,250,0.2))`
                                                        : C.border,
                                            }} />
                                        )}
                                    </React.Fragment>
                                )
                            })}
                        </div>
                        {/* Progress Track */}
                        <div style={{ marginTop: 28, height: 6, borderRadius: 99, background: C.border, overflow: 'hidden' }}>
                            <div style={{
                                height: '100%', borderRadius: 99,
                                width: `${(completed / JOURNEY_STAGES.length) * 100}%`,
                                background: isApproved
                                    ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                                    : `linear-gradient(90deg, ${C.accent}, ${C.accentDk})`,
                                transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)',
                                boxShadow: `0 0 12px ${isApproved ? 'rgba(34,197,94,0.5)' : 'rgba(167,139,250,0.4)'}`,
                            }} />
                        </div>
                    </div>
                )}
            </div>

            {/* ── Bridge to Phase 3 (I-485 Banner) ── */}
            {isTransitioning && (
                <div style={{
                    background: isApproved
                        ? 'linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(16,185,129,0.06) 50%, rgba(124,58,237,0.08) 100%)'
                        : 'linear-gradient(135deg, rgba(167,139,250,0.08) 0%, rgba(124,58,237,0.06) 50%, rgba(99,102,241,0.08) 100%)',
                    border: `1.5px solid ${isApproved ? 'rgba(34,197,94,0.3)' : 'rgba(167,139,250,0.3)'}`,
                    borderRadius: 22, padding: '36px 40px', marginBottom: 28,
                    display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap',
                    position: 'relative', overflow: 'hidden',
                    boxShadow: isApproved ? '0 12px 40px rgba(34,197,94,0.15)' : 'none',
                }}>
                    <div style={{
                        position: 'absolute', top: -50, right: -50, width: 200, height: 200, borderRadius: '50%',
                        background: isApproved ? 'radial-gradient(circle, rgba(34,197,94,0.12) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(167,139,250,0.10) 0%, transparent 70%)',
                        pointerEvents: 'none'
                    }} />

                    <div style={{
                        width: 80, height: 80, borderRadius: 20, flexShrink: 0,
                        background: isApproved ? 'rgba(34,197,94,0.15)' : 'rgba(167,139,250,0.15)',
                        border: `2px solid ${isApproved ? 'rgba(34,197,94,0.4)' : 'rgba(167,139,250,0.3)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36,
                        boxShadow: isApproved ? '0 8px 24px rgba(34,197,94,0.2)' : 'none',
                        zIndex: 1
                    }}>🚀</div>

                    <div style={{ flex: 1, minWidth: 260, zIndex: 1 }}>
                        <div style={{
                            display: 'inline-block', padding: '4px 12px', borderRadius: 20, marginBottom: 12,
                            fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.2,
                            background: isApproved ? 'rgba(34,197,94,0.15)' : 'rgba(167,139,250,0.12)',
                            color: isApproved ? C.success : C.accent,
                            border: `1px solid ${isApproved ? 'rgba(34,197,94,0.3)' : 'rgba(167,139,250,0.25)'}`,
                        }}>
                            {isApproved ? 'Próximo Passo Disponível' : 'Fase 3 — Em Breve'}
                        </div>
                        <h3 style={{ fontSize: 24, fontWeight: 900, color: C.text1, margin: '0 0 10px', letterSpacing: -0.5 }}>
                            Iniciar Fase 3: Adjustment of Status (I-485)
                        </h3>
                        <p style={{ fontSize: 14, color: C.text2, margin: 0, lineHeight: 1.6 }}>
                            O I-485 é a etapa que transforma a petição aprovada no seu Green Card oficial.
                            {isApproved ? ' Você já pode iniciá-lo!' : ' Estará disponível assim que sua petição atual for aprovada pelo USCIS.'}
                        </p>
                    </div>

                    <button
                        onClick={() => router.push(`/dashboard/i485/new?i140_id=${petition.id}`)}
                        disabled={!isApproved}
                        style={{
                            padding: '16px 32px', borderRadius: 14, flexShrink: 0, zIndex: 1,
                            background: isApproved ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'rgba(255,255,255,0.06)',
                            border: 'none', color: isApproved ? '#fff' : C.text3,
                            fontFamily: F, fontSize: 15, fontWeight: 800, cursor: isApproved ? 'pointer' : 'not-allowed',
                            boxShadow: isApproved ? '0 8px 24px rgba(34,197,94,0.4)' : 'none',
                            transition: 'all 0.2s',
                        }}
                    >
                        {isApproved ? 'Iniciar I-485 Agora →' : '🔒 Aguardando Aprovação'}
                    </button>
                </div>
            )}

            {/* ── Document Area (Placeholder para os docs do cliente) ── */}
            <div style={{
                background: C.bgCard, border: `1px solid ${C.border}`,
                borderRadius: 22, padding: '32px 36px',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                    <div style={{
                        width: 42, height: 42, borderRadius: 12,
                        background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20
                    }}>📂</div>
                    <h3 style={{ fontSize: 18, fontWeight: 800, color: C.text1, margin: 0 }}>Meus Documentos Validados</h3>
                </div>

                <div style={{
                    padding: '28px', borderRadius: 14, border: `1px dashed ${C.border}`,
                    background: 'rgba(255,255,255,0.02)', textAlign: 'center'
                }}>
                    <p style={{ fontSize: 14, color: C.text2, margin: '0 0 16px' }}>
                        Nesta área, você poderá visualizar os documentos que já enviou e as informações que nossa IA extraiu deles (Passaporte, Diplomas, etc).
                    </p>
                    <button style={{
                        padding: '10px 20px', borderRadius: 10, background: 'rgba(255,255,255,0.05)',
                        border: `1px solid ${C.border}`, color: C.text1, fontWeight: 600, fontSize: 13, cursor: 'pointer'
                    }}>
                        Acessar Central de Documentos
                    </button>
                </div>
            </div>
        </div>
    )
}

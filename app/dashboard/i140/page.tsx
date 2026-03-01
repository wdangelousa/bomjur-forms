'use client'

import React, { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'

// ============================================================
// TYPES — alinhados com a tabela i140_petitions no Supabase
// ============================================================
type UserRole = 'super_admin' | 'admin' | 'tenant_admin' | 'client' | null
type ViewMode = 'table' | 'kanban'
type PetitionStatus = 'draft' | 'competing' | 'pending' | 'approved'

interface Petition {
  id: string
  clientName: string    // = beneficiary_name
  category: string
  status: PetitionStatus
  date: string    // = inserted_at (ISO)
  hasNewDocuments?: boolean
  progress?: number
  currentResponsibility?: 'client' | 'proex'
  receiptNumber?: string
}

// ============================================================
// DESIGN TOKENS
// ============================================================
const C = {
  bgPage: 'linear-gradient(135deg, #0f0c29 0%, #302b63 60%, #24243e 100%)',
  bgCard: 'rgba(255,255,255,0.05)',
  bgCardHover: 'rgba(255,255,255,0.08)',
  border: 'rgba(255,255,255,0.08)',
  borderAccent: 'rgba(167,139,250,0.4)',
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  accent: '#a78bfa',
  accentDark: '#7c3aed',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  orange: '#fb923c',
}

const F = "'Inter', system-ui, sans-serif"

// ============================================================
// HELPERS
// ============================================================
function getStatusConfig(status: PetitionStatus) {
  switch (status) {
    case 'draft': return { label: 'Rascunho', bg: 'rgba(100,116,139,0.2)', text: '#94a3b8', border: 'rgba(100,116,139,0.35)' }
    case 'competing': return { label: 'Concorrente', bg: 'rgba(100,116,139,0.2)', text: '#94a3b8', border: 'rgba(100,116,139,0.35)' }
    case 'pending': return { label: 'Protocolado', bg: 'rgba(245,158,11,0.15)', text: '#fbbf24', border: 'rgba(245,158,11,0.35)' }
    case 'approved': return { label: 'Aprovado', bg: 'rgba(34,197,94,0.15)', text: '#22c55e', border: 'rgba(34,197,94,0.35)' }
  }
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function getInitials(name: string) {
  return name.split(' ').map((n: string) => n[0]).filter(Boolean).slice(0, 2).join('')
}

// ============================================================
// TOOLTIP
// ============================================================
function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <span onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)} style={{ cursor: 'help' }}>
        {children}
      </span>
      {show && (
        <span style={{
          position: 'absolute', bottom: 'calc(100% + 10px)', left: '50%',
          transform: 'translateX(-50%)', background: '#1a2236',
          border: '1px solid rgba(255,255,255,0.14)', borderRadius: 10,
          padding: '10px 14px', fontSize: 12, color: '#e2e8f0', zIndex: 9999,
          boxShadow: '0 10px 30px rgba(0,0,0,0.6)', pointerEvents: 'none',
          lineHeight: 1.65, width: 230, display: 'block',
        }}>
          {text}
          <span style={{
            position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
            borderWidth: '6px 6px 0', borderStyle: 'solid', borderColor: '#1a2236 transparent transparent',
          }} />
        </span>
      )}
    </span>
  )
}

// ============================================================
// STATUS BADGE
// ============================================================
function StatusBadge({ status }: { status: PetitionStatus }) {
  const cfg = getStatusConfig(status)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 11px', borderRadius: 20, fontSize: 12, fontWeight: 600,
      background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}`,
      letterSpacing: 0.3, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.text, display: 'inline-block', flexShrink: 0 }} />
      {cfg.label}
    </span>
  )
}

// ============================================================
// ACTION NEEDED BADGE
// ============================================================
function ActionNeededBadge() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: 'rgba(239,68,68,0.12)', color: '#f87171',
      border: '1px solid rgba(239,68,68,0.3)', letterSpacing: 0.3,
      whiteSpace: 'nowrap', animation: 'badgePulse 2.2s ease-in-out infinite',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', display: 'inline-block', flexShrink: 0, boxShadow: '0 0 6px #ef4444' }} />
      Ação Necessária
    </span>
  )
}

// ============================================================
// PROGRESS BAR
// ============================================================
function ProgressBar({ value }: { value: number }) {
  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: C.textSecondary, fontWeight: 500 }}>Progresso da Missão</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: C.accent, letterSpacing: 0.5 }}>{value}%</span>
      </div>
      <div style={{ height: 9, borderRadius: 99, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${value}%`, borderRadius: 99,
          background: 'linear-gradient(90deg, #a78bfa, #7c3aed)',
          boxShadow: '0 0 14px rgba(167,139,250,0.55)',
          transition: 'width 1.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontSize: 10, color: C.textMuted }}>Início</span>
        <span style={{ fontSize: 10, color: C.textMuted }}>Aprovação USCIS</span>
      </div>
    </div>
  )
}

// ============================================================
// LOADING SKELETON
// ============================================================
function LoadingSkeleton() {
  return (
    <div style={{ padding: '32px 0' }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{
          display: 'grid', gridTemplateColumns: '2fr 1.1fr 1.3fr 1fr 1.4fr',
          padding: '15px 20px', gap: 8, marginBottom: 2,
        }}>
          {[1, 2, 3, 4, 5].map(j => (
            <div key={j} style={{
              height: 18, borderRadius: 6,
              background: 'rgba(255,255,255,0.06)',
              animation: 'shimmer 1.5s ease-in-out infinite',
              animationDelay: `${(i + j) * 0.05}s`,
            }} />
          ))}
        </div>
      ))}
    </div>
  )
}

// ============================================================
// KANBAN CARD
// ============================================================
function KanbanCard({ petition }: { petition: Petition }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? C.bgCardHover : 'rgba(255,255,255,0.04)',
        border: `1px solid ${petition.hasNewDocuments ? 'rgba(239,68,68,0.35)' : C.border}`,
        borderRadius: 12, padding: '14px 16px', cursor: 'pointer',
        transition: 'all 0.2s ease',
        transform: hovered ? 'translateY(-3px)' : 'none',
        boxShadow: hovered ? '0 10px 24px rgba(0,0,0,0.35)' : petition.hasNewDocuments ? '0 0 0 1px rgba(239,68,68,0.15) inset' : 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary, lineHeight: 1.4, marginRight: 8 }}>
          {petition.clientName}
        </span>
        {petition.hasNewDocuments && (
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: C.error, flexShrink: 0, marginTop: 4, boxShadow: `0 0 8px ${C.error}`, animation: 'badgePulse 2.2s ease-in-out infinite' }} />
        )}
      </div>
      <span style={{
        display: 'inline-block', fontSize: 11, fontWeight: 700, color: C.accent,
        background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.22)',
        borderRadius: 6, padding: '2px 8px', letterSpacing: 0.6, marginBottom: 10, fontFamily: 'monospace',
      }}>
        {petition.category}
      </span>
      {petition.hasNewDocuments && <div style={{ marginBottom: 10 }}><ActionNeededBadge /></div>}
      <div style={{ fontSize: 11, color: C.textMuted }}>{formatDate(petition.date)}</div>
    </div>
  )
}

// ============================================================
// KANBAN COLUMN
// ============================================================
function KanbanColumn({ status, petitions }: { status: PetitionStatus; petitions: Petition[] }) {
  const cfg = getStatusConfig(status)
  const filtered = petitions.filter(p => p.status === status)
  return (
    <div style={{ flex: '1 1 220px', minWidth: 220, maxWidth: 300, background: 'rgba(255,255,255,0.02)', border: `1px solid ${C.border}`, borderRadius: 16, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}>{cfg.label}</span>
        <span style={{ fontSize: 12, color: C.textMuted, background: 'rgba(255,255,255,0.06)', borderRadius: 20, padding: '1px 8px', fontWeight: 700 }}>{filtered.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 0', color: C.textMuted, fontSize: 13 }}>Nenhuma petição</div>
        ) : (
          filtered.map(p => <KanbanCard key={p.id} petition={p} />)
        )}
      </div>
    </div>
  )
}

// ============================================================
// TABLE ROW
// ============================================================
function TableRow({ petition, isLast }: { petition: Petition; isLast: boolean }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid', gridTemplateColumns: '2fr 1.1fr 1.3fr 1fr 1.4fr',
        padding: '15px 20px', borderBottom: isLast ? 'none' : `1px solid ${C.border}`,
        background: hovered ? 'rgba(255,255,255,0.03)' : 'transparent',
        transition: 'background 0.15s', cursor: 'pointer', alignItems: 'center', gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(167,139,250,0.25), rgba(124,58,237,0.25))',
          border: `1.5px solid ${C.borderAccent}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 800, color: C.accent, flexShrink: 0, letterSpacing: 0.4,
        }}>
          {getInitials(petition.clientName)}
        </div>
        <span style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary }}>{petition.clientName}</span>
      </div>
      <span style={{
        fontSize: 12, color: C.accent, fontWeight: 700, fontFamily: 'monospace',
        letterSpacing: 0.8, background: 'rgba(167,139,250,0.1)',
        border: '1px solid rgba(167,139,250,0.2)', borderRadius: 6, padding: '3px 8px', display: 'inline-block',
      }}>
        {petition.category}
      </span>
      <div><StatusBadge status={petition.status} /></div>
      <span style={{ fontSize: 13, color: C.textSecondary }}>{formatDate(petition.date)}</span>
      <div>{petition.hasNewDocuments && <ActionNeededBadge />}</div>
    </div>
  )
}

// ============================================================
// ADMIN VIEW
// ============================================================
function AdminView({ petitions, loading }: { petitions: Petition[]; loading: boolean }) {
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const actionCount = petitions.filter(p => p.hasNewDocuments).length

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: C.textPrimary, margin: 0, letterSpacing: -0.5 }}>
            Gestão de Petições I-140
          </h1>
          <p style={{ margin: '8px 0 0', color: C.textSecondary, fontSize: 14 }}>
            {loading ? 'Carregando...' : `${petitions.length} petições ativas`}
            {!loading && actionCount > 0 && (
              <span style={{ color: C.error, fontWeight: 700, marginLeft: 10 }}>
                · {actionCount} {actionCount === 1 ? 'precisa' : 'precisam'} de ação imediata
              </span>
            )}
          </p>
        </div>
        <a
          href="/dashboard/i140/new"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '12px 22px', borderRadius: 12,
            background: `linear-gradient(135deg, ${C.accent}, ${C.accentDark})`,
            border: 'none', color: '#fff', fontFamily: F, fontSize: 14, fontWeight: 700,
            cursor: 'pointer', boxShadow: '0 4px 20px rgba(124,58,237,0.4)',
            letterSpacing: 0.2, textDecoration: 'none',
          }}
        >
          <span style={{ fontSize: 20, lineHeight: 1, fontWeight: 300 }}>+</span>
          Nova Petição para Cliente
        </a>
      </div>

      {/* View Toggle */}
      <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 12, padding: 4, marginBottom: 24, gap: 4 }}>
        {([
          { mode: 'table', icon: '☰', label: 'Visão em Tabela' },
          { mode: 'kanban', icon: '⊞', label: 'Visão Kanban' },
        ] as { mode: ViewMode; icon: string; label: string }[]).map(({ mode, icon, label }) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            style={{
              padding: '8px 18px', borderRadius: 9,
              border: viewMode === mode ? '1px solid rgba(167,139,250,0.4)' : '1px solid transparent',
              background: viewMode === mode ? 'rgba(167,139,250,0.15)' : 'transparent',
              color: viewMode === mode ? C.accent : C.textSecondary,
              fontFamily: F, fontSize: 13, fontWeight: viewMode === mode ? 700 : 500,
              cursor: 'pointer', transition: 'all 0.2s',
              display: 'inline-flex', alignItems: 'center', gap: 7,
            }}
          >
            <span style={{ fontSize: 14 }}>{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {/* TABLE VIEW */}
      {viewMode === 'table' && (
        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.1fr 1.3fr 1fr 1.4fr', padding: '12px 20px', borderBottom: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.02)', gap: 8 }}>
            {['Cliente', 'Categoria', 'Status', 'Data', 'Alertas'].map(h => (
              <span key={h} style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>{h}</span>
            ))}
          </div>
          {loading ? (
            <LoadingSkeleton />
          ) : petitions.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: C.textMuted }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
              <p style={{ fontSize: 15, fontWeight: 600, color: C.textSecondary, marginBottom: 8 }}>Nenhuma petição ainda</p>
              <p style={{ fontSize: 13 }}>Clique em "Nova Petição para Cliente" para começar.</p>
            </div>
          ) : (
            petitions.map((p, i) => <TableRow key={p.id} petition={p} isLast={i === petitions.length - 1} />)
          )}
        </div>
      )}

      {/* KANBAN VIEW */}
      {viewMode === 'kanban' && (
        <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 16 }}>
          {(['draft', 'competing', 'pending', 'approved'] as PetitionStatus[]).map(status => (
            <KanbanColumn key={status} status={status} petitions={petitions} />
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================
// CLIENT VIEW
// ============================================================
function ClientView({ petition }: { petition: Petition | null }) {
  if (!petition) {
    return (
      <div style={{ maxWidth: 680, margin: '0 auto', textAlign: 'center', paddingTop: 60 }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>📋</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.textPrimary, marginBottom: 12 }}>
          Sem petição ativa
        </h1>
        <p style={{ color: C.textSecondary, fontSize: 15 }}>
          Sua petição I-140 ainda não foi registrada. Entre em contato com a equipe PROEX.
        </p>
      </div>
    )
  }

  const isClientTurn = petition.currentResponsibility === 'client'
  const firstName = petition.clientName.split(' ')[0]

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      {/* Welcome Header */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ fontSize: 52, marginBottom: 14, lineHeight: 1 }}>🌟</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: C.textPrimary, margin: '0 0 10px', letterSpacing: -0.5 }}>
          Bem-vindo(a) ao seu processo de imigração
        </h1>
        <p style={{ color: C.textSecondary, fontSize: 15, margin: 0, lineHeight: 1.6 }}>
          Olá, <strong style={{ color: C.textPrimary }}>{firstName}</strong>! Acompanhe sua petição I-140 em tempo real.
        </p>
      </div>

      {/* Main Petition Card */}
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 20, padding: 28, marginBottom: 16, boxShadow: '0 8px 40px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 6 }}>Petição I-140</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.textPrimary, letterSpacing: -0.5 }}>{petition.category}</div>
            <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 5 }}>Iniciado em {formatDate(petition.date)}</div>
          </div>
          <StatusBadge status={petition.status} />
        </div>

        {/* Receipt Number */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 18px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: C.textSecondary, fontWeight: 500 }}>Receipt Number</span>
            <Tooltip text="O Receipt Number é o número que o USCIS gera quando recebe sua petição. Ele vem no documento chamado I-797. Use-o para acompanhar seu caso em uscis.gov.">
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: '50%', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)', color: C.accent, fontSize: 10, fontWeight: 800, cursor: 'help' }}>?</span>
            </Tooltip>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 700, color: C.textPrimary, letterSpacing: 1.5 }}>
              {petition.receiptNumber ?? '— Aguardando protocolo —'}
            </span>
            {petition.receiptNumber && (
              <button
                onClick={() => navigator.clipboard?.writeText(petition.receiptNumber!)}
                style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 7, padding: '4px 10px', color: C.accent, fontSize: 11, fontFamily: F, fontWeight: 700, cursor: 'pointer', letterSpacing: 0.3 }}
              >
                Copiar
              </button>
            )}
          </div>
        </div>

        {/* Semáforo de Responsabilidade */}
        <div style={{
          borderRadius: 14, padding: '18px 20px', marginBottom: 24,
          background: isClientTurn ? 'rgba(251,146,60,0.07)' : 'rgba(34,197,94,0.07)',
          border: `1.5px solid ${isClientTurn ? 'rgba(251,146,60,0.35)' : 'rgba(34,197,94,0.35)'}`,
          display: 'flex', alignItems: 'flex-start', gap: 16,
        }}>
          <span style={{ fontSize: 34, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>
            {isClientTurn ? '🟠' : '🟢'}
          </span>
          <div>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800,
              textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8,
              background: isClientTurn ? 'rgba(251,146,60,0.15)' : 'rgba(34,197,94,0.15)',
              color: isClientTurn ? C.orange : C.success,
              border: `1px solid ${isClientTurn ? 'rgba(251,146,60,0.3)' : 'rgba(34,197,94,0.3)'}`,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: isClientTurn ? C.orange : C.success, display: 'inline-block' }} />
              {isClientTurn ? 'Aguardando você' : 'Com a equipe PROEX'}
            </span>
            <p style={{ fontSize: 14, color: C.textPrimary, fontWeight: 600, margin: '0 0 6px' }}>
              {isClientTurn ? 'Sua ação é necessária' : 'Em análise pela nossa equipe'}
            </p>
            <p style={{ fontSize: 13, color: C.textSecondary, margin: 0, lineHeight: 1.6 }}>
              {isClientTurn
                ? 'Por favor, envie os documentos pendentes ou responda às perguntas da equipe para avançarmos.'
                : 'Nossa equipe está trabalhando na sua petição. Você receberá uma notificação quando precisarmos de você.'}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        {petition.progress !== undefined && <ProgressBar value={petition.progress} />}
      </div>
    </div>
  )
}

// ============================================================
// PAGE COMPONENT — busca dados reais do Supabase
// ============================================================
export default function I140Page() {
  const [role, setRole] = useState<UserRole>(null)
  const [petitions, setPetitions] = useState<Petition[]>([])
  const [myPetition, setMyPetition] = useState<Petition | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function loadData() {
      try {
        // 1. Busca o usuário atual e seu role
        const { data: { user }, error: userErr } = await supabase.auth.getUser()
        if (userErr || !user) { setError('Sessão expirada. Faça login novamente.'); setLoading(false); return }

        const { data: profile, error: profileErr } = await supabase
          .from('user_profiles')
          .select('role, tenant_id')
          .eq('id', user.id)
          .single()

        if (profileErr || !profile) { setError('Perfil não encontrado.'); setLoading(false); return }

        const userRole = profile.role as UserRole
        setRole(userRole)

        const isAdmin = (userRole === 'admin' || userRole === 'tenant_admin' || userRole === 'super_admin')

        if (isAdmin) {
          // 2A. admin / tenant_admin / super_admin: busca todas as petições do tenant
          const { data: rows, error: fetchErr } = await supabase
            .from('i140_petitions')
            .select('id, beneficiary_name, category, status, inserted_at, notes, receipt_number')
            .eq('tenant_id', profile.tenant_id)
            .order('inserted_at', { ascending: false })

          if (fetchErr) throw new Error(fetchErr.message)

          const mapped: Petition[] = (rows || []).map(r => ({
            id: r.id,
            clientName: r.beneficiary_name || '—',
            category: r.category || '—',
            status: (r.status as PetitionStatus) || 'draft',
            date: r.inserted_at,
            receiptNumber: r.receipt_number ?? undefined,
          }))
          setPetitions(mapped)

        } else {
          // 2B. client: busca apenas a petição do próprio usuário
          const { data: rows, error: fetchErr } = await supabase
            .from('i140_petitions')
            .select('id, beneficiary_name, category, status, inserted_at, receipt_number, progress, current_responsibility')
            .eq('created_by', user.id)
            .order('inserted_at', { ascending: false })
            .limit(1)

          if (fetchErr) throw new Error(fetchErr.message)

          const r = rows?.[0]
          if (r) {
            setMyPetition({
              id: r.id,
              clientName: r.beneficiary_name || '—',
              category: r.category || '—',
              status: (r.status as PetitionStatus) || 'draft',
              date: r.inserted_at,
              receiptNumber: r.receipt_number ?? undefined,
              progress: r.progress ?? undefined,
              currentResponsibility: r.current_responsibility ?? undefined,
            })
          }
        }
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    }

    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: C.bgPage, fontFamily: F, padding: '32px 24px' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        @keyframes badgePulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.55; }
        }
        @keyframes shimmer {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 0.9; }
        }
      `}</style>

      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Erro global */}
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 12, padding: '14px 20px', marginBottom: 24,
            color: '#f87171', fontSize: 14, fontWeight: 600,
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Conteúdo por role */}
        {!error && (
          <>
            {(role === 'admin' || role === 'tenant_admin' || role === 'super_admin' || role === null) && (
              <AdminView petitions={petitions} loading={loading} />
            )}
            {role === 'client' && !loading && (
              <ClientView petition={myPetition} />
            )}
            {role === 'client' && loading && (
              <div style={{ textAlign: 'center', padding: '80px 0', color: C.textMuted }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>⚡</div>
                <p>Carregando sua petição...</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

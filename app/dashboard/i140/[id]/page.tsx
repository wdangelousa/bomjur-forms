'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import MissionCelebration from '@/app/components/MissionCelebration'

// ============================================================
// TYPES
// ============================================================
interface I140Petition {
  id: string
  category: string
  status: string
  priority_date: string | null
  notes: string | null
  beneficiary_name: string
  beneficiary_email: string | null
  beneficiary_phone: string | null
  birth_country: string | null
  birth_date: string | null
  created_by: string | null
  tenant_id: string | null
  created_at: string
  updated_at?: string | null
}

// ============================================================
// DESIGN TOKENS
// ============================================================
const C = {
  bgPage:        'linear-gradient(135deg, #0f0c29 0%, #302b63 60%, #24243e 100%)',
  bgCard:        'rgba(255,255,255,0.05)',
  bgCardStrong:  'rgba(255,255,255,0.07)',
  border:        'rgba(255,255,255,0.08)',
  borderAccent:  'rgba(167,139,250,0.35)',
  textPrimary:   '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted:     '#64748b',
  accent:        '#a78bfa',
  accentDark:    '#7c3aed',
  success:       '#22c55e',
  gold:          '#f59e0b',
  error:         '#ef4444',
}
const F = "'Inter', system-ui, sans-serif"

// ============================================================
// STATUS CONFIG
// ============================================================
const STATUS_CONFIG: Record<string, {
  label: string; color: string; bg: string; border: string; icon: string
}> = {
  draft:      { label: 'Rascunho',     color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.28)', icon: '📝' },
  pending:    { label: 'Pendente',     color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.28)',  icon: '⏳' },
  submitted:  { label: 'Protocolado', color: '#818cf8', bg: 'rgba(129,140,248,0.12)', border: 'rgba(129,140,248,0.28)', icon: '📬' },
  processing: { label: 'Em Análise',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.28)',  icon: '⚖️' },
  approved:   { label: 'Aprovado',    color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.28)',   icon: '✅' },
  denied:     { label: 'Negado',      color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.28)',   icon: '❌' },
}

// ============================================================
// CATEGORY CONFIG
// ============================================================
const CATEGORY_MAP: Record<string, { icon: string; color: string; subtitle: string; bg: string }> = {
  'EB-1A':      { icon: '🏆', color: '#fbbf24', bg: 'rgba(251,191,36,0.10)',  subtitle: 'Alien of Extraordinary Ability' },
  'EB-1B':      { icon: '🔬', color: '#60a5fa', bg: 'rgba(96,165,250,0.10)', subtitle: 'Outstanding Researcher or Professor' },
  'EB-2 NIW':   { icon: '🌎', color: '#a78bfa', bg: 'rgba(167,139,250,0.10)', subtitle: 'National Interest Waiver' },
  'EB-2':       { icon: '🎓', color: '#34d399', bg: 'rgba(52,211,153,0.10)', subtitle: 'Advanced Degree Professionals' },
  'EB-3':       { icon: '⚙️', color: '#f472b6', bg: 'rgba(244,114,182,0.10)', subtitle: 'Skilled Workers & Professionals' },
  'EB-3 Other': { icon: '🛠️', color: '#fb923c', bg: 'rgba(251,146,60,0.10)', subtitle: 'Other Workers' },
}

// ============================================================
// JOURNEY STAGES
// ============================================================
const JOURNEY_STAGES = [
  { key: 'created',    label: 'Iniciada',    icon: '📋', desc: 'Dados registrados com sucesso'     },
  { key: 'documents',  label: 'Documentos',  icon: '📎', desc: 'Upload de documentos necessário'   },
  { key: 'filed',      label: 'Protocolo',   icon: '📬', desc: 'Petição enviada ao USCIS'          },
  { key: 'processing', label: 'Em Análise',  icon: '⚖️',  desc: 'USCIS revisando a petição'        },
  { key: 'approved',   label: 'Aprovada!',   icon: '🏆', desc: 'Aprovado — Pronto para I-485'     },
]

function getCompletedStages(status: string): number {
  switch (status) {
    case 'draft':       return 1
    case 'pending':     return 2
    case 'submitted':   return 3
    case 'processing':  return 4
    case 'approved':    return 5
    default:            return 1
  }
}

// ============================================================
// HELPERS
// ============================================================
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.substring(0, 2).toUpperCase()
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  try {
    return new Date(d.includes('T') ? d : d + 'T00:00:00').toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'long', year: 'numeric',
    })
  } catch { return d }
}

function formatDateShort(d: string | null): string {
  if (!d) return '—'
  try {
    return new Date(d.includes('T') ? d : d + 'T00:00:00').toLocaleDateString('pt-BR')
  } catch { return d }
}

// ============================================================
// LOADING SKELETON
// ============================================================
function Bone({ width, height, radius = 10 }: { width: string | number; height: number; radius?: number }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: 'rgba(255,255,255,0.07)',
      animation: 'skeletonPulse 1.6s ease-in-out infinite',
    }} />
  )
}

function LoadingView() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 32px 80px' }}>
      {/* Hero skeleton */}
      <div style={{
        background: C.bgCard, border: `1px solid ${C.border}`,
        borderRadius: 22, padding: '32px 36px', marginBottom: 24,
        display: 'flex', alignItems: 'center', gap: 24,
      }}>
        <Bone width={80} height={80} radius={50} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Bone width="55%" height={28} />
          <div style={{ display: 'flex', gap: 10 }}>
            <Bone width={90} height={22} radius={20} />
            <Bone width={110} height={22} radius={20} />
          </div>
          <Bone width="35%" height={16} />
        </div>
      </div>
      {/* Journey skeleton */}
      <div style={{
        background: C.bgCard, border: `1px solid ${C.border}`,
        borderRadius: 18, padding: '28px 32px', marginBottom: 24,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
      }}>
        {[1,2,3,4,5].map(i => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: 1 }}>
            <Bone width={44} height={44} radius={50} />
            <Bone width="60%" height={12} />
          </div>
        ))}
      </div>
      {/* Cards skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {[1,2].map(i => (
          <div key={i} style={{
            background: C.bgCard, border: `1px solid ${C.border}`,
            borderRadius: 18, padding: '24px 28px',
            display: 'flex', flexDirection: 'column', gap: 16,
          }}>
            <Bone width="50%" height={18} />
            {[1,2,3,4].map(j => (
              <div key={j} style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                <Bone width="35%" height={14} />
                <Bone width="45%" height={14} />
              </div>
            ))}
          </div>
        ))}
      </div>
      {/* Status message */}
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: C.textMuted, fontSize: 14, fontFamily: F }}>
          <span style={{
            width: 16, height: 16, borderRadius: '50%', display: 'inline-block',
            border: '2px solid rgba(167,139,250,0.3)', borderTop: '2px solid #a78bfa',
            animation: 'spin 0.9s linear infinite',
          }} />
          Buscando dados do processo...
        </div>
      </div>
    </div>
  )
}

// ============================================================
// ERROR / NOT FOUND STATE
// ============================================================
function ErrorView({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div style={{
      maxWidth: 480, margin: '80px auto', padding: '0 32px',
      textAlign: 'center', fontFamily: F,
    }}>
      <div style={{ fontSize: 64, marginBottom: 20 }}>🔍</div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: C.textPrimary, margin: '0 0 10px' }}>
        Petição não encontrada
      </h2>
      <p style={{ fontSize: 14, color: C.textSecondary, margin: '0 0 32px', lineHeight: 1.6 }}>
        {message}
      </p>
      <button
        onClick={onBack}
        style={{
          padding: '12px 28px', borderRadius: 12,
          background: `linear-gradient(135deg, ${C.accent}, ${C.accentDark})`,
          border: 'none', color: '#fff', fontFamily: F,
          fontSize: 14, fontWeight: 700, cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(124,58,237,0.4)',
        }}
      >
        ← Voltar ao Dashboard
      </button>
    </div>
  )
}

// ============================================================
// STATUS BADGE
// ============================================================
function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 12px', borderRadius: 20,
      fontSize: 12, fontWeight: 700, letterSpacing: 0.3,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
    }}>
      {cfg.icon} {cfg.label}
    </span>
  )
}

// ============================================================
// JOURNEY TRACKER
// ============================================================
function JourneyTracker({ status }: { status: string }) {
  const completed = getCompletedStages(status)
  const isDenied  = status === 'denied'

  if (isDenied) {
    return (
      <div style={{
        background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
        borderRadius: 18, padding: '24px 32px', marginBottom: 24,
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: 'rgba(239,68,68,0.15)', border: '2px solid rgba(239,68,68,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0,
        }}>❌</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.error, marginBottom: 4 }}>
            Petição Negada pelo USCIS
          </div>
          <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.5 }}>
            Entre em contato com a equipe BomJur para avaliar as opções de recurso (Motion to Reopen / NOID).
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      background: C.bgCard, border: `1px solid ${C.border}`,
      borderRadius: 18, padding: '28px 32px', marginBottom: 24,
    }}>
      <div style={{
        fontSize: 12, fontWeight: 700, color: C.textMuted,
        textTransform: 'uppercase', letterSpacing: 1, marginBottom: 24,
      }}>
        Jornada da Petição
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
        {JOURNEY_STAGES.map((stage, idx) => {
          const isDone    = completed > idx
          const isActive  = completed === idx + 1
          const isPending = completed < idx + 1

          return (
            <React.Fragment key={stage.key}>
              {/* Node */}
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, flex: 1,
                minWidth: 0,
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: isDone ? 20 : 18,
                  transition: 'all 0.35s ease',
                  background: isDone
                    ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                    : isActive
                      ? `linear-gradient(135deg, ${C.accent}, ${C.accentDark})`
                      : 'rgba(255,255,255,0.04)',
                  border: isDone
                    ? '2px solid rgba(34,197,94,0.5)'
                    : isActive
                      ? '2px solid rgba(167,139,250,0.6)'
                      : `2px solid ${C.border}`,
                  color: isPending ? C.textMuted : '#fff',
                  boxShadow: isActive
                    ? '0 0 22px rgba(167,139,250,0.45)'
                    : isDone ? '0 0 14px rgba(34,197,94,0.3)' : 'none',
                  flexShrink: 0,
                }}>
                  {isDone ? '✓' : stage.icon}
                </div>
                <div style={{ textAlign: 'center', padding: '0 4px' }}>
                  <div style={{
                    fontSize: 11, fontWeight: isDone || isActive ? 700 : 500,
                    color: isDone ? C.success : isActive ? C.accent : C.textMuted,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {stage.label}
                  </div>
                  <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2, lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {stage.desc}
                  </div>
                </div>
              </div>

              {/* Connector */}
              {idx < JOURNEY_STAGES.length - 1 && (
                <div style={{
                  height: 2, flex: '0 0 24px', marginTop: 23,
                  borderRadius: 99,
                  background: completed > idx + 1
                    ? 'linear-gradient(90deg, #22c55e, rgba(34,197,94,0.4))'
                    : completed === idx + 1
                      ? `linear-gradient(90deg, ${C.accent}, rgba(167,139,250,0.2))`
                      : C.border,
                  transition: 'background 0.4s ease',
                }} />
              )}
            </React.Fragment>
          )
        })}
      </div>

      {/* Progress bar */}
      <div style={{ marginTop: 24, height: 4, borderRadius: 99, background: C.border, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 99,
          width: `${(completed / JOURNEY_STAGES.length) * 100}%`,
          background: status === 'approved'
            ? 'linear-gradient(90deg, #22c55e, #16a34a)'
            : `linear-gradient(90deg, ${C.accent}, ${C.accentDark})`,
          transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: `0 0 12px ${status === 'approved' ? 'rgba(34,197,94,0.5)' : 'rgba(167,139,250,0.4)'}`,
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        <span style={{ fontSize: 11, color: C.textMuted }}>Etapa {completed} de {JOURNEY_STAGES.length}</span>
        <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 600 }}>
          {Math.round((completed / JOURNEY_STAGES.length) * 100)}% concluído
        </span>
      </div>
    </div>
  )
}

// ============================================================
// DATA ROW  (used in info cards)
// ============================================================
function DataRow({ icon, label, value, accent }: {
  icon: string; label: string; value: string | null; accent?: string
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      padding: '10px 0', borderBottom: `1px solid rgba(255,255,255,0.04)`, gap: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ fontSize: 13, color: C.textMuted, fontWeight: 500 }}>{label}</span>
      </div>
      <span style={{
        fontSize: 13,
        color: value ? (accent ?? C.textPrimary) : C.textMuted,
        fontWeight: value ? 600 : 400,
        textAlign: 'right',
        fontStyle: value ? 'normal' : 'italic',
        lineHeight: 1.5,
        wordBreak: 'break-word',
      }}>
        {value || '— não informado —'}
      </span>
    </div>
  )
}

// ============================================================
// SECTION CARD wrapper
// ============================================================
function SectionCard({
  title, icon, children, accentColor, style: extraStyle,
}: {
  title: string; icon: string; children: React.ReactNode;
  accentColor?: string; style?: React.CSSProperties
}) {
  return (
    <div style={{
      background: C.bgCard, border: `1px solid ${C.border}`,
      borderRadius: 18, overflow: 'hidden', ...extraStyle,
    }}>
      <div style={{
        padding: '18px 24px', borderBottom: `1px solid ${C.border}`,
        background: 'rgba(255,255,255,0.02)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: accentColor
            ? `${accentColor}18`
            : 'rgba(167,139,250,0.12)',
          border: `1.5px solid ${accentColor ? `${accentColor}30` : 'rgba(167,139,250,0.25)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
        }}>
          {icon}
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>{title}</span>
      </div>
      <div style={{ padding: '18px 24px' }}>{children}</div>
    </div>
  )
}

// ============================================================
// DOCUMENTS SECTION
// ============================================================
function DocumentsSection({ petitionId }: { petitionId: string }) {
  const router = useRouter()
  return (
    <SectionCard title="Documentos Vinculados" icon="📎" accentColor="#f59e0b" style={{ marginBottom: 24 }}>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '32px 24px', textAlign: 'center',
      }}>
        {/* Folder illustration */}
        <div style={{ fontSize: 56, marginBottom: 16, filter: 'drop-shadow(0 4px 12px rgba(245,158,11,0.3))' }}>
          📂
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary, marginBottom: 8 }}>
          Nenhum documento vinculado ainda
        </div>
        <p style={{ fontSize: 13, color: C.textSecondary, margin: '0 0 24px', lineHeight: 1.65, maxWidth: 380 }}>
          Faça o upload do seu passaporte, I-797, diplomas ou outros documentos necessários para instruir a petição.
          Nossa IA extrairá os dados automaticamente.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          {/* Placeholder document types */}
          {['I-797', 'Passaporte', 'Diploma', 'Currículo'].map((doc, i) => (
            <div key={i} style={{
              padding: '8px 14px', borderRadius: 10,
              background: 'rgba(255,255,255,0.03)',
              border: `1px dashed ${C.border}`,
              display: 'flex', alignItems: 'center', gap: 6,
              opacity: 0.6,
            }}>
              <span style={{ fontSize: 14 }}>📄</span>
              <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 500 }}>{doc}</span>
              <span style={{ fontSize: 10, color: C.textMuted }}>— pendente</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => router.push('/')}
          style={{
            marginTop: 24, padding: '12px 28px', borderRadius: 12,
            background: 'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(251,146,60,0.12))',
            border: '1.5px solid rgba(245,158,11,0.4)', color: C.gold,
            fontFamily: F, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 8, letterSpacing: 0.2,
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg, rgba(245,158,11,0.25), rgba(251,146,60,0.18))'
            ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 20px rgba(245,158,11,0.2)'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(251,146,60,0.12))'
            ;(e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'
          }}
        >
          <span style={{ fontSize: 16 }}>📎</span>
          Fazer Upload de Documento
        </button>
      </div>
    </SectionCard>
  )
}

// ============================================================
// NOTES SECTION (shown only if petition has notes)
// ============================================================
function NotesSection({ notes }: { notes: string }) {
  return (
    <SectionCard title="Observações Internas da Equipe" icon="📝" accentColor="#818cf8" style={{ marginBottom: 24 }}>
      <div style={{
        background: 'rgba(129,140,248,0.05)', borderRadius: 10,
        padding: '14px 18px', border: '1px solid rgba(129,140,248,0.15)',
      }}>
        <p style={{ fontSize: 13, color: C.textSecondary, margin: 0, lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
          {notes}
        </p>
      </div>
    </SectionCard>
  )
}

// ============================================================
// I-485 CALL TO ACTION BANNER
// ============================================================
function I485Banner({ isApproved }: { isApproved: boolean }) {
  const router = useRouter()

  return (
    <div style={{
      background: isApproved
        ? 'linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(16,185,129,0.06) 50%, rgba(124,58,237,0.08) 100%)'
        : 'linear-gradient(135deg, rgba(167,139,250,0.08) 0%, rgba(124,58,237,0.06) 50%, rgba(99,102,241,0.08) 100%)',
      border: `1.5px solid ${isApproved ? 'rgba(34,197,94,0.25)' : 'rgba(167,139,250,0.25)'}`,
      borderRadius: 20, padding: '36px 40px', marginBottom: 24,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Background decoration */}
      <div style={{
        position: 'absolute', top: -60, right: -60, width: 220, height: 220,
        borderRadius: '50%',
        background: isApproved
          ? 'radial-gradient(circle, rgba(34,197,94,0.08) 0%, transparent 70%)'
          : 'radial-gradient(circle, rgba(167,139,250,0.10) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: -40, left: -40, width: 160, height: 160,
        borderRadius: '50%',
        background: isApproved
          ? 'radial-gradient(circle, rgba(16,185,129,0.06) 0%, transparent 70%)'
          : 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
        {/* Icon */}
        <div style={{
          width: 72, height: 72, borderRadius: 18, flexShrink: 0,
          background: isApproved ? 'rgba(34,197,94,0.15)' : 'rgba(167,139,250,0.12)',
          border: `2px solid ${isApproved ? 'rgba(34,197,94,0.35)' : 'rgba(167,139,250,0.3)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 36,
          boxShadow: isApproved ? '0 8px 28px rgba(34,197,94,0.2)' : '0 8px 28px rgba(167,139,250,0.15)',
        }}>
          🚀
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '3px 10px', borderRadius: 20, marginBottom: 10,
            fontSize: 10, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase' as const,
            background: isApproved ? 'rgba(34,197,94,0.12)' : 'rgba(167,139,250,0.10)',
            color: isApproved ? C.success : C.accent,
            border: `1px solid ${isApproved ? 'rgba(34,197,94,0.25)' : 'rgba(167,139,250,0.2)'}`,
          }}>
            <span style={{
              width: 5, height: 5, borderRadius: '50%', display: 'inline-block',
              background: isApproved ? C.success : C.accent,
              boxShadow: `0 0 6px ${isApproved ? 'rgba(34,197,94,0.8)' : 'rgba(167,139,250,0.8)'}`,
              animation: 'dotPulse 2s ease-in-out infinite',
            }} />
            {isApproved ? 'I-140 Aprovado — Próximo Passo Disponível' : 'Fase 3 — Disponível após aprovação do I-140'}
          </div>

          <h3 style={{
            fontSize: 22, fontWeight: 900, margin: '0 0 8px', letterSpacing: -0.5,
            backgroundImage: isApproved
              ? 'linear-gradient(135deg, #34d399, #22c55e, #16a34a)'
              : `linear-gradient(135deg, ${C.textPrimary}, ${C.accent})`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            Iniciar Fase 3: Formulário I-485
          </h3>
          <p style={{ fontSize: 13, color: C.textSecondary, margin: '0 0 4px', lineHeight: 1.65 }}>
            O <strong style={{ color: C.textPrimary }}>I-485 (Adjustment of Status)</strong> é o formulário que transforma
            o visto de imigrante aprovado em Residência Permanente (Green Card) nos Estados Unidos.
            {!isApproved && (
              <span style={{ color: C.textMuted }}> Este passo estará disponível após a aprovação do I-140.</span>
            )}
          </p>
        </div>

        {/* CTA Button */}
        <button
          onClick={() => router.push('/dashboard/i485/new')}
          disabled={!isApproved}
          style={{
            padding: '14px 28px', borderRadius: 14, flexShrink: 0,
            background: isApproved
              ? 'linear-gradient(135deg, #22c55e, #16a34a)'
              : 'rgba(255,255,255,0.05)',
            border: isApproved ? 'none' : `1.5px solid ${C.border}`,
            color: isApproved ? '#fff' : C.textMuted,
            fontFamily: F, fontSize: 14, fontWeight: 800,
            cursor: isApproved ? 'pointer' : 'not-allowed',
            letterSpacing: 0.2,
            boxShadow: isApproved ? '0 6px 24px rgba(34,197,94,0.45)' : 'none',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap' as const,
            animation: isApproved ? 'ctaBtnGlow 2.5s ease-in-out infinite' : 'none',
          }}
          onMouseEnter={e => {
            if (!isApproved) return
            ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'
            ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 10px 32px rgba(34,197,94,0.55)'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'
            ;(e.currentTarget as HTMLButtonElement).style.boxShadow = isApproved ? '0 6px 24px rgba(34,197,94,0.45)' : 'none'
          }}
        >
          {isApproved ? '🚀 Iniciar I-485 →' : '🔒 Aguardando aprovação'}
        </button>
      </div>
    </div>
  )
}

// ============================================================
// MAIN PAGE
// ============================================================
export default function I140DetailPage() {
  const router    = useRouter()
  const params    = useParams()
  const id        = params?.id as string

  const [petition,  setPetition]  = useState<I140Petition | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [notFound,  setNotFound]  = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [showCelebration, setShowCelebration] = useState(false)

  // Fetch petition data
  useEffect(() => {
    if (!id) return
    async function load() {
      setLoading(true)
      try {
        const res  = await fetch(`/api/petitions/${id}`)
        const json = await res.json()
        if (res.status === 404) { setNotFound(true); return }
        if (!res.ok) throw new Error(json.error ?? 'Erro ao buscar petição.')
        setPetition(json.petition)
        // Show celebration modal if approved (brief delay for page to render)
        if (json.petition?.status === 'approved') {
          setTimeout(() => setShowCelebration(true), 600)
        }
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const catInfo    = petition ? (CATEGORY_MAP[petition.category] ?? null) : null
  const statusCfg  = petition ? (STATUS_CONFIG[petition.status] ?? STATUS_CONFIG.draft) : null
  const isApproved = petition?.status === 'approved'
  const initials   = petition ? getInitials(petition.beneficiary_name) : '??'

  // ── Loading ────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bgPage, fontFamily: F, color: C.textPrimary }}>
        <style>{`
          @keyframes skeletonPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
          @keyframes spin { to { transform: rotate(360deg); } }
          * { box-sizing: border-box; }
        `}</style>
        <nav style={{ height: 60, borderBottom: `1px solid ${C.border}`, background: 'rgba(0,0,0,0.28)', backdropFilter: 'blur(18px)', display: 'flex', alignItems: 'center', padding: '0 32px', gap: 12 }}>
          <div style={{ width: 100, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.07)', animation: 'skeletonPulse 1.6s ease-in-out infinite' }} />
        </nav>
        <LoadingView />
      </div>
    )
  }

  // ── Not found / Error ──────────────────────────────────────
  if (notFound || error || !petition) {
    return (
      <div style={{ minHeight: '100vh', background: C.bgPage, fontFamily: F, color: C.textPrimary }}>
        <style>{`* { box-sizing: border-box; }`}</style>
        <ErrorView
          message={error ?? 'Verifique o link ou volte ao dashboard e tente novamente.'}
          onBack={() => router.push('/dashboard/i140')}
        />
      </div>
    )
  }

  // ── Full detail view ───────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: C.bgPage, fontFamily: F, color: C.textPrimary }}>
      <style>{`
        @keyframes skeletonPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
        @keyframes spin           { to { transform: rotate(360deg); } }
        @keyframes dotPulse       { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes heroIn         { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes ctaBtnGlow     {
          0%, 100% { box-shadow: 0 6px 24px rgba(34,197,94,0.45); }
          50%       { box-shadow: 0 8px 36px rgba(34,197,94,0.7), 0 0 0 4px rgba(34,197,94,0.1); }
        }
        * { box-sizing: border-box; }
        ::placeholder { color: #64748b; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
      `}</style>

      {/* ── Sticky Navbar ── */}
      <nav style={{
        height: 60, borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', padding: '0 32px', gap: 16,
        background: 'rgba(0,0,0,0.28)', backdropFilter: 'blur(18px)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <button
          onClick={() => router.push('/dashboard/i140')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 9,
            background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
            color: C.textSecondary, fontFamily: F, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLButtonElement).style.color = C.textPrimary
            ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.16)'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLButtonElement).style.color = C.textSecondary
            ;(e.currentTarget as HTMLButtonElement).style.borderColor = C.border
          }}
        >
          ← Dashboard
        </button>

        <span style={{ width: 1, height: 20, background: C.border, display: 'block' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <span style={{ fontSize: 16 }}>📋</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary, letterSpacing: -0.2 }}>
            Detalhes I-140
          </span>
          {catInfo && (
            <span style={{
              fontSize: 11, padding: '2px 9px', borderRadius: 20,
              background: `${catInfo.color}18`, border: `1px solid ${catInfo.color}35`,
              color: catInfo.color, fontWeight: 700, letterSpacing: 0.3,
            }}>
              {catInfo.icon} {petition.category}
            </span>
          )}
          <StatusBadge status={petition.status} />
        </div>
      </nav>

      {/* ── Main Content ── */}
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '40px 32px 80px', animation: 'heroIn 0.4s ease both' }}>

        {/* ── HERO SECTION ── */}
        <div style={{
          background: C.bgCard, border: `1px solid ${C.border}`,
          borderRadius: 22, padding: '32px 36px', marginBottom: 24,
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Accent glow behind avatar */}
          {catInfo && (
            <div style={{
              position: 'absolute', top: -40, left: -40, width: 200, height: 200,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${catInfo.color}14 0%, transparent 70%)`,
              pointerEvents: 'none',
            }} />
          )}

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, position: 'relative' }}>
            {/* Avatar */}
            <div style={{
              width: 80, height: 80, borderRadius: '50%', flexShrink: 0,
              background: catInfo
                ? `linear-gradient(135deg, ${catInfo.color}30, ${catInfo.color}18)`
                : 'linear-gradient(135deg, rgba(167,139,250,0.25), rgba(124,58,237,0.15))',
              border: `2.5px solid ${catInfo ? `${catInfo.color}45` : C.borderAccent}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, fontWeight: 900, letterSpacing: -1,
              color: catInfo ? catInfo.color : C.accent,
              boxShadow: catInfo ? `0 0 28px ${catInfo.color}25` : '0 0 24px rgba(167,139,250,0.2)',
              userSelect: 'none',
            }}>
              {initials}
            </div>

            {/* Name + meta */}
            <div style={{ flex: 1 }}>
              <h1 style={{
                fontSize: 26, fontWeight: 900, margin: '0 0 10px', letterSpacing: -0.6,
                backgroundImage: `linear-gradient(135deg, ${C.textPrimary}, ${catInfo?.color ?? C.accent})`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>
                {petition.beneficiary_name}
              </h1>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                <StatusBadge status={petition.status} />
                {catInfo && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                    background: catInfo.bg, color: catInfo.color,
                    border: `1px solid ${catInfo.color}30`,
                  }}>
                    {catInfo.icon} {petition.category} — {catInfo.subtitle}
                  </span>
                )}
              </div>

              {/* Meta info strip */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
                {petition.priority_date && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13 }}>📅</span>
                    <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 500 }}>
                      Data de prioridade:{' '}
                      <strong style={{ color: C.textSecondary }}>{formatDateShort(petition.priority_date)}</strong>
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13 }}>🕐</span>
                  <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 500 }}>
                    Criado em:{' '}
                    <strong style={{ color: C.textSecondary }}>{formatDateShort(petition.created_at)}</strong>
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13 }}>🆔</span>
                  <span style={{ fontSize: 12, color: C.textMuted, fontFamily: 'monospace', letterSpacing: 0.5 }}>
                    {petition.id.substring(0, 8).toUpperCase()}…
                  </span>
                </div>
              </div>
            </div>

            {/* Quick actions */}
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button
                onClick={() => router.push(`/dashboard/i140/new`)}
                style={{
                  padding: '8px 16px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
                  color: C.textSecondary, fontFamily: F, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.2s',
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                }}
                onMouseEnter={e => {
                  ;(e.currentTarget as HTMLButtonElement).style.color = C.textPrimary
                  ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.16)'
                }}
                onMouseLeave={e => {
                  ;(e.currentTarget as HTMLButtonElement).style.color = C.textSecondary
                  ;(e.currentTarget as HTMLButtonElement).style.borderColor = C.border
                }}
              >
                ✏️ Editar
              </button>
            </div>
          </div>
        </div>

        {/* ── JOURNEY TRACKER ── */}
        <JourneyTracker status={petition.status} />

        {/* ── DATA CARDS GRID ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>

          {/* Biographical data */}
          <SectionCard title="Dados Biográficos" icon="👤" accentColor="#a78bfa">
            <DataRow icon="👤" label="Nome completo"    value={petition.beneficiary_name} />
            <DataRow icon="📧" label="E-mail"           value={petition.beneficiary_email} />
            <DataRow icon="📱" label="Telefone"         value={petition.beneficiary_phone} />
            <DataRow icon="🌍" label="País de nascimento" value={petition.birth_country} />
            <DataRow icon="🎂" label="Data de nascimento" value={formatDate(petition.birth_date)} />
          </SectionCard>

          {/* Petition details */}
          <SectionCard title="Detalhes da Petição" icon="📋" accentColor={catInfo?.color}>
            <DataRow
              icon={catInfo?.icon ?? '📋'}
              label="Categoria"
              value={petition.category ? `${petition.category} — ${catInfo?.subtitle ?? ''}` : null}
              accent={catInfo?.color}
            />
            <DataRow icon="📅" label="Data de prioridade" value={formatDate(petition.priority_date)} />
            <DataRow icon="🕐" label="Data de criação"     value={formatDate(petition.created_at)}    />
            <DataRow
              icon={statusCfg?.icon ?? '📌'}
              label="Status atual"
              value={statusCfg?.label ?? petition.status}
              accent={statusCfg?.color}
            />
            <DataRow
              icon="📝"
              label="Observações"
              value={petition.notes ? (petition.notes.length > 60 ? petition.notes.substring(0, 60) + '…' : petition.notes) : null}
            />
          </SectionCard>
        </div>

        {/* ── DOCUMENTS ── */}
        <DocumentsSection petitionId={petition.id} />

        {/* ── NOTES (full, if exists) ── */}
        {petition.notes && petition.notes.trim() && (
          <NotesSection notes={petition.notes} />
        )}

        {/* ── I-485 CTA ── */}
        <I485Banner isApproved={isApproved} />

        {/* ── MILESTONE CELEBRATION (approved only) ── */}
        <MissionCelebration
          type="milestone_reached"
          visible={showCelebration}
          title={`I-140 Aprovado! Você está a um passo do Green Card! 🏆`}
          description={`Parabéns! O I-140 de ${petition.beneficiary_name} foi aprovado. Agora é hora de iniciar o Formulário I-485 e dar o próximo passo rumo à Residência Permanente.`}
          ctaLabel="Iniciar Formulário I-485 →"
          onContinue={() => {
            setShowCelebration(false)
            router.push('/dashboard/i485/new')
          }}
        />
      </main>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// ============================================================
// TYPES
// ============================================================
type UserRole = 'super_admin' | 'admin' | 'tenant_admin' | 'client' | null

interface I140Petition {
  id: string
  beneficiary_name: string
  category: string
  status: string
  priority_date: string | null
  birth_country: string | null
  created_at: string
  updated_at?: string | null
  notes?: string | null
  tenant_id?: string | null
}

import ClientDashboard from '@/app/components/dashboard/ClientDashboard'

// ============================================================
// DESIGN TOKENS
// ============================================================
const C = {
  bgPage: '#f8fafc',
  bgCard: '#ffffff',
  bgCardStrong: '#f1f5f9',
  bgHover: '#f1f5f9',
  border: '#e2e8f0',
  borderAccent: 'rgba(37,99,235,0.3)',
  text1: '#1e293b',
  text2: '#475569',
  text3: '#64748b',
  accent: '#3b82f6',
  accentDk: '#2563eb',
  success: '#16a34a',
  warning: '#d97706',
  error: '#dc2626',
  info: '#2563eb',
}
const F = "'Inter', system-ui, sans-serif"

// ============================================================
// STATUS CONFIG
// ============================================================
const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  draft: { label: 'Rascunho', color: '#94a3b8', bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.22)', dot: '#94a3b8' },
  pending: { label: 'Pendente', color: '#60a5fa', bg: 'rgba(96,165,250,0.10)', border: 'rgba(96,165,250,0.22)', dot: '#60a5fa' },
  submitted: { label: 'Protocolado', color: '#818cf8', bg: 'rgba(129,140,248,0.10)', border: 'rgba(129,140,248,0.22)', dot: '#818cf8' },
  processing: { label: 'Em Análise', color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.22)', dot: '#f59e0b' },
  approved: { label: 'Aprovado', color: '#22c55e', bg: 'rgba(34,197,94,0.10)', border: 'rgba(34,197,94,0.22)', dot: '#22c55e' },
  denied: { label: 'Negado', color: '#ef4444', bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.22)', dot: '#ef4444' },
}

// ============================================================
// CATEGORY CONFIG
// ============================================================
const CAT_CFG: Record<string, { icon: string; color: string }> = {
  'EB-1A': { icon: '🏆', color: '#fbbf24' },
  'EB-1B': { icon: '🔬', color: '#60a5fa' },
  'EB-2 NIW': { icon: '🌎', color: '#a78bfa' },
  'EB-2': { icon: '🎓', color: '#34d399' },
  'EB-3': { icon: '⚙️', color: '#f472b6' },
  'EB-3 Other': { icon: '🛠️', color: '#fb923c' },
}

// ============================================================
// HELPERS
// ============================================================
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso.includes('T') ? iso : iso + 'T00:00:00').toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch { return iso }
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.substring(0, 2).toUpperCase()
}

// ============================================================
// STATUS BADGE
// ============================================================
function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.draft
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20,
      fontSize: 11, fontWeight: 700, letterSpacing: 0.2,
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  )
}

// ============================================================
// METRIC TILE
// ============================================================
function MetricTile({ icon, label, value, color }: {
  icon: string; label: string; value: number; color: string
}) {
  return (
    <div style={{
      flex: '1 1 160px', minWidth: 140,
      background: C.bgCard, border: `1px solid ${C.border}`,
      borderRadius: 16, padding: '18px 22px',
      display: 'flex', alignItems: 'center', gap: 16,
      transition: 'all 0.2s',
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
        background: `${color}18`, border: `1px solid ${color}35`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1, letterSpacing: -1 }}>{value}</div>
        <div style={{ fontSize: 11, color: C.text3, marginTop: 4, fontWeight: 500 }}>{label}</div>
      </div>
    </div>
  )
}

// ============================================================
// PETITION ROW
// ============================================================
function PetitionRow({ petition, onClick }: { petition: I140Petition; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  const cat = CAT_CFG[petition.category] ?? { icon: '📋', color: C.accent }
  const initials = getInitials(petition.beneficiary_name)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: '16px 22px',
        background: hovered ? C.bgHover : C.bgCard,
        border: `1px solid ${hovered ? 'rgba(167,139,250,0.28)' : C.border}`,
        borderRadius: 14, cursor: 'pointer',
        transition: 'all 0.18s ease',
        boxShadow: hovered ? '0 4px 24px rgba(124,58,237,0.12)' : 'none',
      }}
    >
      {/* Avatar */}
      <div style={{
        width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
        background: `${cat.color}22`, border: `2px solid ${cat.color}40`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 800, color: cat.color,
        letterSpacing: -0.5, userSelect: 'none',
      }}>
        {initials}
      </div>

      {/* Name + country */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 700, color: C.text1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {petition.beneficiary_name}
        </div>
        <div style={{ fontSize: 12, color: C.text3, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{cat.icon}</span>
          <span style={{ color: cat.color, fontWeight: 600 }}>{petition.category}</span>
          {petition.birth_country && (
            <>
              <span>·</span>
              <span>{petition.birth_country}</span>
            </>
          )}
        </div>
      </div>

      {/* Priority date */}
      <div style={{ textAlign: 'center', minWidth: 100, flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: C.text3, fontWeight: 500, marginBottom: 2 }}>Data de Prioridade</div>
        <div style={{ fontSize: 13, color: petition.priority_date ? C.text2 : C.text3, fontWeight: 600 }}>
          {fmtDate(petition.priority_date)}
        </div>
      </div>

      {/* Created at */}
      <div style={{ textAlign: 'center', minWidth: 100, flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: C.text3, fontWeight: 500, marginBottom: 2 }}>Criado em</div>
        <div style={{ fontSize: 13, color: C.text3, fontWeight: 500 }}>{fmtDate(petition.created_at)}</div>
      </div>

      {/* Status */}
      <div style={{ flexShrink: 0 }}>
        <StatusBadge status={petition.status} />
      </div>

      {/* Chevron */}
      <div style={{ color: hovered ? C.accent : C.text3, fontSize: 16, flexShrink: 0, transition: 'color 0.18s' }}>›</div>
    </div>
  )
}

// ============================================================
// EMPTY STATE
// ============================================================
function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div style={{
      textAlign: 'center', padding: '72px 32px',
      background: C.bgCard, border: `1px dashed ${C.border}`,
      borderRadius: 20,
    }}>
      <div style={{ fontSize: 60, marginBottom: 20, filter: 'drop-shadow(0 4px 16px rgba(167,139,250,0.25))' }}>📋</div>
      <h3 style={{ fontSize: 18, fontWeight: 800, color: C.text1, margin: '0 0 10px' }}>
        Nenhuma petição registrada ainda
      </h3>
      <p style={{ fontSize: 13, color: C.text2, margin: '0 0 28px', lineHeight: 1.65, maxWidth: 380, marginLeft: 'auto', marginRight: 'auto' }}>
        Crie a primeira petição I-140 para acompanhar o progresso do processo de Green Card de um beneficiário.
      </p>
      <button
        onClick={onNew}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '12px 26px', borderRadius: 12,
          background: `linear-gradient(135deg, ${C.accent}, ${C.accentDk})`,
          border: 'none', color: '#fff', fontFamily: F,
          fontSize: 14, fontWeight: 700, cursor: 'pointer',
          boxShadow: '0 6px 24px rgba(124,58,237,0.4)',
          transition: 'all 0.2s',
        }}
      >
        <span>+</span> Nova Petição I-140
      </button>
    </div>
  )
}

// ============================================================
// LOADING SKELETON
// ============================================================
function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{
          height: 76, borderRadius: 14,
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${C.border}`,
          animation: 'pulse 1.6s ease-in-out infinite',
        }} />
      ))}
    </div>
  )
}

// ============================================================
// MAIN PAGE
// ============================================================
export default function I140DashboardPage() {
  const router = useRouter()

  const [petitions, setPetitions] = useState<I140Petition[]>([])
  const [tenantName, setTenantName] = useState('Minha Organização')
  const [role, setRole] = useState<UserRole>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/dashboard/petitions')
        if (res.status === 401) {
          router.push('/login')
          return
        }
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Erro ao carregar petições.')
        setPetitions(json.petitions ?? [])
        setTenantName(json.tenantName ?? 'Minha Organização')
        setRole(json.role ?? null)
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  // ── Filtered list ────────────────────────────────────────────────────────
  const displayed = petitions.filter(p => {
    const matchStatus = filter === 'all' || p.status === filter
    const matchSearch = search === '' ||
      p.beneficiary_name.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase()) ||
      (p.birth_country ?? '').toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  // ── Metrics ──────────────────────────────────────────────────────────────
  const total = petitions.length
  const approved = petitions.filter(p => p.status === 'approved').length
  const processing = petitions.filter(p => ['processing', 'submitted'].includes(p.status)).length
  const pending = petitions.filter(p => ['pending', 'draft'].includes(p.status)).length

  const isAdmin = role && ['super_admin', 'admin', 'tenant_admin'].includes(role)

  return (
    <div style={{ minHeight: '100vh', background: C.bgPage, fontFamily: F, color: C.text1 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        ::placeholder { color: #475569; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
      `}</style>

      {/* ── Header ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: '#ffffff', backdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto', padding: '0 28px',
          height: 64, display: 'flex', alignItems: 'center', gap: 16,
        }}>
          {/* Logo / org mark */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: `linear-gradient(135deg, ${C.accent}, ${C.accentDk})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, boxShadow: '0 4px 14px rgba(124,58,237,0.45)', flexShrink: 0,
            }}>
              ⚖️
            </div>
            <div>
              <div style={{
                fontSize: 15, fontWeight: 900, letterSpacing: -0.5,
                backgroundImage: `linear-gradient(90deg, ${C.text1}, ${C.accent})`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>
                BomJur
              </div>
              <div style={{ fontSize: 10, color: C.text3, fontWeight: 600, letterSpacing: 0.3 }}>
                Immigration Platform
              </div>
            </div>

            <div style={{ width: 1, height: 22, background: C.border, margin: '0 4px' }} />

            {/* Tenant name badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 12px', borderRadius: 20,
              background: 'rgba(167,139,250,0.10)', border: `1px solid ${C.borderAccent}`,
            }}>
              <span style={{ fontSize: 13 }}>🏢</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.accent }}>
                {loading ? '...' : tenantName}
              </span>
            </div>
          </div>

          {/* Right nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isAdmin && (
              <a
                href="/admin"
                style={{
                  fontSize: 12, color: C.text3, padding: '5px 12px',
                  border: `1px solid ${C.border}`, borderRadius: 8,
                  textDecoration: 'none', fontWeight: 600,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = C.text1 }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = C.text3 }}
              >
                Admin ↗
              </a>
            )}
            {isAdmin && (
              <button
                onClick={() => router.push('/dashboard/i140/new')}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 18px', borderRadius: 10,
                  background: `linear-gradient(135deg, ${C.accent}, ${C.accentDk})`,
                  border: 'none', color: '#fff', fontFamily: F,
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(124,58,237,0.35)',
                  transition: 'all 0.18s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 22px rgba(124,58,237,0.5)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(124,58,237,0.35)' }}
              >
                + Nova Petição
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Page content ── */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '36px 28px 80px', animation: 'fadeIn 0.35s ease both' }}>

        {/* ── Page title ── */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.7, margin: '0 0 6px' }}>
            {isAdmin ? 'Dashboard I-140' : 'Meu Processo I-140'}
          </h1>
          <p style={{ fontSize: 13, color: C.text2 }}>
            {loading
              ? isAdmin ? 'Carregando petições...' : 'Carregando processo...'
              : isAdmin
                ? `${total} petição${total !== 1 ? 'ões' : ''} registrada${total !== 1 ? 's' : ''} · ${tenantName}`
                : `Acompanhamento do seu processo · ${tenantName}`}
          </p>
        </div>

        {/* ── Metric tiles ── */}
        {!loading && !error && isAdmin && (
          <div style={{ display: 'flex', gap: 14, marginBottom: 32, flexWrap: 'wrap' }}>
            <MetricTile icon="📋" label="Total de Petições" value={total} color="#6366f1" />
            <MetricTile icon="✅" label="Aprovadas" value={approved} color="#22c55e" />
            <MetricTile icon="⚖️" label="Em Análise/Prot." value={processing} color="#f59e0b" />
            <MetricTile icon="⏳" label="Pendentes" value={pending} color="#94a3b8" />
          </div>
        )}

        {/* ── Toolbar (search + status filter) ── */}
        {!loading && !error && total > 0 && isAdmin && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
              <span style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                fontSize: 14, color: C.text3, pointerEvents: 'none',
              }}>🔍</span>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nome, categoria, país..."
                style={{
                  width: '100%', padding: '9px 12px 9px 36px',
                  background: C.bgCard, border: `1px solid ${C.border}`,
                  borderRadius: 10, color: C.text1, fontFamily: F, fontSize: 13,
                  outline: 'none', transition: 'border-color 0.15s',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = C.borderAccent }}
                onBlur={e => { e.currentTarget.style.borderColor = C.border }}
              />
            </div>

            {/* Status filter chips */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['all', 'draft', 'pending', 'submitted', 'processing', 'approved', 'denied'] as const).map(s => {
                const active = filter === s
                const cfg = s === 'all' ? null : STATUS_CFG[s]
                return (
                  <button
                    key={s}
                    onClick={() => setFilter(s)}
                    style={{
                      padding: '6px 14px', borderRadius: 20,
                      background: active
                        ? (s === 'all' ? C.accentDk : cfg!.bg)
                        : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${active ? (s === 'all' ? C.accent : cfg!.border) : C.border}`,
                      color: active ? (s === 'all' ? '#fff' : cfg!.color) : C.text3,
                      fontFamily: F, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {s === 'all' ? 'Todos' : cfg!.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.28)',
            borderRadius: 12, padding: '14px 20px', color: '#f87171', fontSize: 14, marginBottom: 24,
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div style={{ marginTop: 16 }}>
            {/* Metric placeholders */}
            <div style={{ display: 'flex', gap: 14, marginBottom: 32, flexWrap: 'wrap' }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} style={{
                  flex: '1 1 160px', height: 82, borderRadius: 16,
                  background: C.bgCard, border: `1px solid ${C.border}`,
                  animation: 'pulse 1.6s ease-in-out infinite',
                }} />
              ))}
            </div>
            <LoadingSkeleton />
          </div>
        )}

        {/* ── Client View (Bifurcação) ── */}
        {!loading && !error && !isAdmin && (
          <ClientDashboard
            petition={petitions.length > 0 ? petitions[0] : null}
            tenantName={tenantName}
          />
        )}

        {/* ── Empty state (Admin) ── */}
        {!loading && !error && total === 0 && isAdmin && (
          isAdmin ? (
            <EmptyState onNew={() => router.push('/dashboard/i140/new')} />
          ) : (
            <div style={{
              textAlign: 'center', padding: '60px 32px',
              background: C.bgCard, border: `1px dashed ${C.border}`,
              borderRadius: 20, color: C.text3, fontSize: 14,
            }}>
              Nenhuma petição foi vinculada à sua conta ainda.
            </div>
          )
        )}

        {/* ── Petition list (Admin) ── */}
        {!loading && !error && total > 0 && isAdmin && (
          <>
            {/* Results count */}
            {isAdmin && (
              <div style={{ fontSize: 12, color: C.text3, marginBottom: 12, fontWeight: 500 }}>
                {displayed.length === total
                  ? `${total} resultado${total !== 1 ? 's' : ''}`
                  : `${displayed.length} de ${total} resultado${total !== 1 ? 's' : ''}`}
              </div>
            )}

            {/* List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {displayed.length === 0 ? (
                <div style={{
                  textAlign: 'center', padding: '48px 32px',
                  background: C.bgCard, border: `1px solid ${C.border}`,
                  borderRadius: 14, color: C.text3, fontSize: 14,
                }}>
                  Nenhuma petição encontrada para os filtros selecionados.
                </div>
              ) : (
                displayed.map(petition => (
                  <PetitionRow
                    key={petition.id}
                    petition={petition}
                    onClick={() => router.push(`/dashboard/i140/${petition.id}`)}
                  />
                ))
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

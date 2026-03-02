'use client'

import React, { useState, useEffect } from 'react'
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
  bgPage: '#f8fafc',
  bgCard: '#ffffff',
  border: '#e2e8f0',
  borderAccent: 'rgba(37,99,235,0.3)',
  textPrimary: '#1e293b',
  textSecondary: '#475569',
  textMuted: '#64748b',
  accent: '#3b82f6',
  accentDark: '#2563eb',
  success: '#16a34a',
  gold: '#d97706',
  error: '#dc2626',
}
const F = "'Inter', system-ui, sans-serif"

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: string }> = {
  draft: { label: 'Rascunho', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.28)', icon: '📝' },
  pending: { label: 'Pendente', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.28)', icon: '⏳' },
  submitted: { label: 'Protocolado', color: '#818cf8', bg: 'rgba(129,140,248,0.12)', border: 'rgba(129,140,248,0.28)', icon: '📬' },
  processing: { label: 'Em Análise', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.28)', icon: '⚖️' },
  approved: { label: 'Aprovado', color: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.28)', icon: '✅' },
  denied: { label: 'Negado', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.28)', icon: '❌' },
}

const CATEGORY_MAP: Record<string, { icon: string; color: string; subtitle: string; bg: string }> = {
  'EB-1A': { icon: '🏆', color: '#fbbf24', bg: 'rgba(251,191,36,0.10)', subtitle: 'Alien of Extraordinary Ability' },
  'EB-1B': { icon: '🔬', color: '#60a5fa', bg: 'rgba(96,165,250,0.10)', subtitle: 'Outstanding Researcher or Professor' },
  'EB-2 NIW': { icon: '🌎', color: '#a78bfa', bg: 'rgba(167,139,250,0.10)', subtitle: 'National Interest Waiver' },
  'EB-2': { icon: '🎓', color: '#34d399', bg: 'rgba(52,211,153,0.10)', subtitle: 'Advanced Degree Professionals' },
  'EB-3': { icon: '⚙️', color: '#f472b6', bg: 'rgba(244,114,182,0.10)', subtitle: 'Skilled Workers & Professionals' },
  'EB-3 Other': { icon: '🛠️', color: '#fb923c', bg: 'rgba(251,146,60,0.10)', subtitle: 'Other Workers' },
}

const JOURNEY_STAGES = [
  { key: 'created', label: 'Iniciada', icon: '📋', desc: 'Dados registrados' },
  { key: 'documents', label: 'Documentos', icon: '📎', desc: 'Upload necessário' },
  { key: 'filed', label: 'Protocolo', icon: '📬', desc: 'Enviada ao USCIS' },
  { key: 'processing', label: 'Em Análise', icon: '⚖️', desc: 'Revisão USCIS' },
  { key: 'approved', label: 'Aprovada!', icon: '🏆', desc: 'Pronto para I-485' },
]

function getCompletedStages(status: string): number {
  switch (status) {
    case 'draft': return 1; case 'pending': return 2; case 'submitted': return 3; case 'processing': return 4; case 'approved': return 5; default: return 1
  }
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.substring(0, 2).toUpperCase()
}

function formatDateShort(d: string | null): string {
  if (!d) return '—'
  return new Date(d.includes('T') ? d : d + 'T00:00:00').toLocaleDateString('pt-BR')
}

// ============================================================
// COMPONENTS
// ============================================================
function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
      {cfg.icon} {cfg.label}
    </span>
  )
}

export default function I140DetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string

  const [petition, setPetition] = useState<I140Petition | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCelebration, setShowCelebration] = useState(false)

  useEffect(() => {
    if (!id) return
    async function load() {
      try {
        const res = await fetch(`/api/petitions/${id}`)
        const json = await res.json()
        if (res.ok) {
          setPetition(json.petition)
          if (json.petition?.status === 'approved') setTimeout(() => setShowCelebration(true), 600)
        }
      } catch (e) { console.error(e) } finally { setLoading(false) }
    }
    load()
  }, [id])

  if (loading) return <div style={{ padding: 40, textAlign: 'center', fontFamily: F }}>Carregando...</div>
  if (!petition) return <div style={{ padding: 40, textAlign: 'center', fontFamily: F }}>Petição não encontrada.</div>

  const catInfo = CATEGORY_MAP[petition.category] || null

  return (
    <div style={{ minHeight: '100vh', background: C.bgPage, fontFamily: F, color: C.textPrimary }}>
      <nav style={{ height: 60, borderBottom: `1px solid ${C.border}`, background: '#fff', display: 'flex', alignItems: 'center', padding: '0 32px', gap: 16 }}>
        <button onClick={() => router.push('/dashboard/i140')} style={{ cursor: 'pointer', background: 'none', border: `1px solid ${C.border}`, padding: '6px 12px', borderRadius: 8 }}>← Voltar</button>
        <div style={{ fontWeight: 700 }}>Detalhes I-140</div>
        <StatusBadge status={petition.status} />
      </nav>

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '40px 32px' }}>
        <div style={{ background: '#fff', borderRadius: 22, padding: 36, border: `1px solid ${C.border}`, display: 'flex', gap: 24, alignItems: 'center' }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: C.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800 }}>
            {getInitials(petition.beneficiary_name)}
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 24 }}>{petition.beneficiary_name}</h1>
            <p style={{ color: C.textMuted, margin: '4px 0' }}>{petition.category} — {catInfo?.subtitle}</p>
          </div>
        </div>
      </main>

      <MissionCelebration
        type="milestone_reached"
        visible={showCelebration}
        title="I-140 Aprovado! 🏆"
        description={`Parabéns! O processo de ${petition.beneficiary_name} foi aprovado.`}
        ctaLabel="Iniciar I-485"
        onContinue={() => {
          setShowCelebration(false)
          router.push('/dashboard/i485/new')
        }}
      />
    </div>
  )
}
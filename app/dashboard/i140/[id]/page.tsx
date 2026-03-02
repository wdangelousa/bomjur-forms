'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import MissionCelebration from '@/app/components/MissionCelebration'
import { ChevronLeft, Calendar, Clock, User, Globe, Mail, Phone, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

// ============================================================
// TYPES & INTERFACES
// ============================================================
export interface I140Petition {
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
// DESIGN TOKENS (Premium Silicon Valley Identity)
// ============================================================
const C = {
  bgPage: '#f8fafc',
  bgCard: '#ffffff',
  border: '#e2e8f0',
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  primary: '#22c55e', // Proexpand Green
  primaryDark: '#16a34a',
  blue: '#2563eb',
  gold: '#f59e0b',
  error: '#ef4444',
}

const CATEGORY_MAP: Record<string, { subtitle: string; color: string; bg: string }> = {
  'EB-1A': { subtitle: 'Alien of Extraordinary Ability', color: C.gold, bg: '#fef3c7' },
  'EB-1B': { subtitle: 'Outstanding Researcher', color: '#8b5cf6', bg: '#ede9fe' },
  'EB-2 NIW': { subtitle: 'National Interest Waiver', color: '#0ea5e9', bg: '#e0f2fe' },
  'EB-2': { subtitle: 'Advanced Degree', color: C.primary, bg: '#dcfce7' },
  'EB-3': { subtitle: 'Skilled Workers', color: '#ec4899', bg: '#fce7f3' },
  'EB-3 Other': { subtitle: 'Other Workers', color: '#f97316', bg: '#ffedd5' },
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; border: string }> = {
  draft: { label: 'Rascunho', color: C.textSecondary, bg: '#f1f5f9', border: '#cbd5e1' },
  pending: { label: 'Pendente', color: '#0284c7', bg: '#e0f2fe', border: '#bae6fd' },
  submitted: { label: 'Protocolado', color: '#4f46e5', bg: '#e0e7ff', border: '#c7d2fe' },
  processing: { label: 'Em Análise', color: '#b45309', bg: '#fef3c7', border: '#fde68a' },
  approved: { label: 'Aprovado', color: '#15803d', bg: '#dcfce7', border: '#bbf7d0' },
  denied: { label: 'Negado', color: '#b91c1c', bg: '#fee2e2', border: '#fecaca' },
}

const JOURNEY_STAGES = [
  { id: 'created', label: 'Iniciada', desc: 'Dados registrados' },
  { id: 'documents', label: 'Documentos', desc: 'Envio de evidências' },
  { id: 'filed', label: 'Protocolo', desc: 'Enviada ao USCIS' },
  { id: 'processing', label: 'Em Análise', desc: 'Revisão USCIS' },
  { id: 'approved', label: 'Aprovada!', desc: 'Pronto para I-485' },
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

function formatDateFull(d: string | null): string {
  if (!d) return '—'
  return new Date(d.includes('T') ? d : d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

// ============================================================
// COMPONENTS
// ============================================================
function LoadingSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-10 animate-pulse">
      <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm flex gap-6 items-center mb-6">
        <div className="w-20 h-20 bg-slate-200 rounded-full shrink-0" />
        <div className="space-y-3 w-full">
          <div className="h-6 bg-slate-200 rounded-md w-1/3" />
          <div className="h-4 bg-slate-100 rounded-md w-1/4" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl h-64 border border-slate-100" />
        <div className="bg-white rounded-3xl h-64 border border-slate-100" />
      </div>
    </div>
  )
}

function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="max-w-md mx-auto mt-20 p-8 bg-white rounded-3xl border border-red-100 shadow-sm text-center">
      <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
      <h2 className="text-xl font-bold text-slate-800 mb-2">Ops! Algo deu errado.</h2>
      <p className="text-sm text-slate-500 mb-6">{message}</p>
      <button onClick={onRetry} className="px-6 py-3 bg-slate-900 text-white font-semibold rounded-xl hover:bg-black transition-all">
        Tentar Novamente
      </button>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_MAP[status] ?? STATUS_MAP.draft
  return (
    <span style={{ backgroundColor: cfg.bg, color: cfg.color, borderColor: cfg.border }} className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border">
      {cfg.label}
    </span>
  )
}

export default function I140DetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string

  const [petition, setPetition] = useState<I140Petition | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCelebration, setShowCelebration] = useState(false)

  const fetchPetition = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/petitions/${id}`)
      if (!res.ok) throw new Error('Não foi possível carregar os detalhes do processo.')
      const json = await res.json()
      setPetition(json.petition)
      if (json.petition?.status === 'approved') {
        setTimeout(() => setShowCelebration(true), 800)
      }
    } catch (e: any) {
      setError(e.message || 'Erro inesperado.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (id) fetchPetition()
  }, [id])

  if (loading) return <div className="min-h-screen bg-slate-50"><LoadingSkeleton /></div>
  if (error || !petition) return <div className="min-h-screen bg-slate-50"><ErrorView message={error ?? 'Petição não encontrada.'} onRetry={fetchPetition} /></div>

  const catInfo = CATEGORY_MAP[petition.category] || { subtitle: 'Categoria Customizada', color: C.blue, bg: '#eff6ff' }
  const completedStages = getCompletedStages(petition.status)

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">

      {/* Navbar Premium */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200 px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard/i140')} className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all">
            <ChevronLeft size={20} />
          </button>
          <div className="h-5 w-[1px] bg-slate-200" />
          <h1 className="font-bold text-sm tracking-tight">Processo <span className="text-slate-400 font-normal">#{id.split('-')[0].toUpperCase()}</span></h1>
        </div>
        <StatusBadge status={petition.status} />
      </nav>

      <main className="max-w-5xl mx-auto px-6 mt-10 space-y-8">

        {/* Header Hero Card */}
        <div className="bg-white rounded-[2rem] p-8 md:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col md:flex-row gap-8 items-start md:items-center relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl -z-10 opacity-50 translate-x-1/2 -translate-y-1/2" />

          <div className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-black text-emerald-600 bg-emerald-50 shrink-0 border-4 border-white shadow-sm">
            {getInitials(petition.beneficiary_name)}
          </div>

          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <span style={{ color: catInfo.color, backgroundColor: catInfo.bg }} className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
                {petition.category}
              </span>
              <span className="text-slate-400 text-sm font-medium">{catInfo.subtitle}</span>
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight mb-4">{petition.beneficiary_name}</h2>

            <div className="flex flex-wrap gap-6 text-sm text-slate-500 font-medium">
              <div className="flex items-center gap-2"><Calendar size={16} className="text-slate-400" /> Criado em {formatDateFull(petition.created_at)}</div>
              <div className="flex items-center gap-2"><Clock size={16} className="text-slate-400" /> Priority Date: {formatDateFull(petition.priority_date)}</div>
            </div>
          </div>
        </div>

        {/* Journey Tracker */}
        <div className="bg-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-8">Jornada do Cliente</h3>
          <div className="relative flex justify-between items-start">
            {/* Progress Line */}
            <div className="absolute top-5 left-0 right-0 h-1 bg-slate-100 rounded-full -z-10" />
            <div className="absolute top-5 left-0 h-1 bg-emerald-500 rounded-full -z-10 transition-all duration-1000" style={{ width: `${((completedStages - 1) / (JOURNEY_STAGES.length - 1)) * 100}%` }} />

            {JOURNEY_STAGES.map((stage, idx) => {
              const isDone = completedStages > idx
              const isActive = completedStages === idx + 1
              return (
                <div key={stage.id} className="flex flex-col items-center gap-3 w-1/5">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-4 border-white shadow-sm transition-all duration-300 ${isDone ? 'bg-emerald-500 text-white' : isActive ? 'bg-blue-600 text-white ring-4 ring-blue-50' : 'bg-slate-100 text-slate-300'}`}>
                    {isDone ? <CheckCircle2 size={18} /> : <div className="w-2.5 h-2.5 rounded-full bg-current" />}
                  </div>
                  <div className="text-center">
                    <div className={`text-xs font-bold ${isDone || isActive ? 'text-slate-800' : 'text-slate-400'}`}>{stage.label}</div>
                    <div className="text-[10px] text-slate-400 mt-1 hidden md:block">{stage.desc}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Data Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* Biographical Data */}
          <div className="bg-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl"><User size={18} /></div>
              <h3 className="font-bold text-slate-800">Dados Biográficos</h3>
            </div>
            <div className="space-y-6">
              <DataRow icon={<Mail size={16} />} label="E-mail" value={petition.beneficiary_email} />
              <DataRow icon={<Phone size={16} />} label="Telefone" value={petition.beneficiary_phone} />
              <DataRow icon={<Globe size={16} />} label="País Nativo" value={petition.birth_country} />
              <DataRow icon={<Calendar size={16} />} label="Nascimento" value={formatDateFull(petition.birth_date)} />
            </div>
          </div>

          {/* Internal Notes */}
          <div className="bg-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl"><FileText size={18} /></div>
              <h3 className="font-bold text-slate-800">Notas de Estratégia</h3>
            </div>
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 min-h-[160px]">
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                {petition.notes || <span className="italic text-slate-400">Nenhuma observação interna adicionada a este processo.</span>}
              </p>
            </div>
          </div>

        </div>
      </main>

      <MissionCelebration
        type="milestone_reached"
        visible={showCelebration}
        title="I-140 Aprovado! 🏆"
        description={`Parabéns! O processo de ${petition.beneficiary_name} foi deferido pela USCIS.`}
        ctaLabel="Avançar para I-485 →"
        onContinue={() => {
          setShowCelebration(false)
          router.push('/dashboard/i485/new')
        }}
      />
    </div>
  )
}

function DataRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null }) {
  return (
    <div className="flex justify-between items-start pb-4 border-b border-slate-50 last:border-0 last:pb-0">
      <div className="flex items-center gap-3 text-slate-500">
        <div className="opacity-70">{icon}</div>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <span className="text-sm font-bold text-slate-800 text-right">
        {value || '—'}
      </span>
    </div>
  )
}
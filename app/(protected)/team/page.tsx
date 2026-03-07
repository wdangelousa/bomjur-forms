'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calculateCategoryProgress, getCaseStatusLabel } from '@/lib/cases/case-helpers'
import CreateCaseModal from '@/components/team/CreateCaseModal'
import type { Case, Profile, CaseDocument, CaseStatus, CaseType } from '@/types'
import {
  Plus,
  Search,
  FolderOpen,
  Clock,
  Copy,
  Mail,
  CheckCircle2,
  Printer,
  Eye,
  ShieldCheck,
  ChevronRight,
  AlertCircle
} from 'lucide-react'
import { motion } from 'framer-motion'

/**
 * Substitua todo o código por...
 * 
 * PROEXPAND - Team Pipeline Dashboard
 * Design System: Light Mode Premium (Mirror of Client Dashboard)
 */

interface CaseWithRelations extends Case {
  profiles: Profile
  case_documents: Pick<CaseDocument, 'status' | 'is_required'>[]
}

export default function TeamPage() {
  const [cases, setCases] = useState<CaseWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<CaseStatus | 'all'>('all')
  const [filterType, setFilterType] = useState<CaseType | 'all'>('all')
  const [tenantId, setTenantId] = useState<string | null>(null)
  const supabase = createClient()
  const [copiedLink, setCopiedLink] = useState<string | null>(null)

  const fetchTenantIdAndCases = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    if (!userProfile?.tenant_id) { setLoading(false); return }

    setTenantId(userProfile.tenant_id)
    await fetchCases(userProfile.tenant_id)
  }

  const fetchCases = async (currentTenantId: string) => {
    const { data, error } = await supabase
      .from('cases')
      .select(`
        *,
        profiles!client_id (id, full_name, email, phone, preferred_language),
        case_documents (status, is_required)
      `)
      .eq('tenant_id', currentTenantId)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setCases(data as unknown as CaseWithRelations[])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchTenantIdAndCases()
  }, [])

  useEffect(() => {
    if (!tenantId) return
    const channel = supabase.channel('team-dashboard-cases')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cases', filter: `tenant_id=eq.${tenantId}` },
        () => fetchCases(tenantId))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [tenantId])

  const copyToClipboard = async (caseId: string, email: string) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://app.bomjur.com'
    const loginUrl = new URL('/login', baseUrl).toString()
    const msg = `Seu processo na Proexpand foi iniciado.\nAcesse: ${loginUrl}\nLogin: ${email}`
    await navigator.clipboard.writeText(msg)
    setCopiedLink(caseId)
    setTimeout(() => setCopiedLink(null), 2000)
  }

  const resendEmail = async (email: string) => {
    alert(`Lembrete de pendências enviado para ${email} (Simulação).`)
  }

  const filtered = cases.filter(c => {
    if (filterStatus !== 'all' && c.status !== filterStatus) return false
    if (filterType !== 'all' && c.case_type !== filterType) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      const name = (c.profiles as any)?.full_name?.toLowerCase() || ''
      const email = (c.profiles as any)?.email?.toLowerCase() || ''
      if (!name.includes(q) && !email.includes(q)) return false
    }
    return true
  })

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const days = Math.floor(diff / 86400000)
    if (days === 0) return 'Hoje'
    if (days === 1) return 'Ontem'
    return `${days} dias atrás`
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans text-slate-900">

      {/* ── Top Bar Branding ── */}
      <header className="sticky top-0 bg-white/80 backdrop-blur-xl border-b border-slate-200 z-50 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="/proexpand-logo.png" alt="Proexpand" className="h-10 w-auto" />
            <div className="hidden md:block w-px h-6 bg-slate-200 mx-2" />
            <div className="hidden md:flex flex-col">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Internal Platform</span>
              <span className="text-sm font-bold text-slate-700 tracking-tight">Team Operations</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
              <ShieldCheck className="w-4 h-4" />
              SISTEMA OPERACIONAL
            </div>
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-sky-500 text-white font-black uppercase tracking-widest rounded-xl text-[10px] hover:bg-sky-600 transition-all shadow-lg shadow-sky-500/20 active:scale-95"
            >
              <Plus size={16} />
              Novo Cliente
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pt-10">

        {/* ── Title & Stats ── */}
        <div className="mb-10">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Pipeline de <span className="text-sky-500">Gestão</span>
          </h1>
          <p className="text-slate-500 font-medium mt-1">Acompanhe o progresso de documentos e assembly de casos.</p>
        </div>

        {/* ── Search + Filters ── */}
        <div className="flex flex-col md:flex-row gap-4 mb-10">
          <div className="relative flex-1 group">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-sky-500 transition-colors" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nome ou email..."
              className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all font-medium shadow-sm"
            />
          </div>
          <div className="flex gap-2 shrink-0">
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as CaseStatus | 'all')}
              className="px-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-600 font-bold text-xs focus:ring-2 focus:ring-sky-500/20 outline-none transition-all cursor-pointer shadow-sm min-w-[160px]"
            >
              <option value="all">Todos os Status</option>
              <option value="pending_onboarding">1. Onboarding</option>
              <option value="documents_pending">2. Docs Pendentes</option>
              <option value="in_progress">3. Em Andamento</option>
              <option value="in_review">4. Em Revisão</option>
              <option value="complete">5. Completo</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white border border-dashed border-slate-300 rounded-[2.5rem]">
            <FolderOpen size={48} className="mx-auto text-slate-300 mb-4 opacity-50" />
            <p className="text-slate-500 font-bold">Nenhum caso encontrado para estes filtros.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filtered.map((c, idx) => {
              const client = c.profiles as any as Profile
              const progress = calculateCategoryProgress(c.case_documents || [])

              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm hover:shadow-xl hover:border-sky-200 transition-all group relative overflow-hidden"
                >
                  {/* Mirroring Client Progress Bar Style */}
                  <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                    <FolderOpen size={80} className="text-slate-900" />
                  </div>

                  <div className="flex items-start justify-between mb-6">
                    <div className="flex-1 min-w-0 pr-10">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-black text-slate-900 truncate tracking-tight">{client?.full_name || 'Sem nome'}</h3>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-black uppercase tracking-wider">{c.case_type}</span>
                      </div>
                      <p className="text-xs font-semibold text-slate-400 truncate">{client?.email}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {progress.percentage === 100 ? (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
                          <CheckCircle2 size={12} />
                          <span className="text-[10px] font-black uppercase tracking-wider">Pronto</span>
                        </div>
                      ) : progress.inReview > 0 ? (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 rounded-full border border-amber-100">
                          <Clock size={12} />
                          <span className="text-[10px] font-black uppercase tracking-wider">Pendente Finalização</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-500 rounded-full border border-slate-200">
                          <AlertCircle size={12} />
                          <span className="text-[10px] font-black uppercase tracking-wider">Em Aberto</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Progress Indicator (Mirrored from Client) */}
                  <div className="mb-8">
                    <div className="flex justify-between text-[10px] font-black mb-2 uppercase tracking-widest">
                      <span className="text-slate-400">{progress.approved}/{progress.total} CATEGORIAS CONCLUÍDAS</span>
                      <span className="text-sky-500">{progress.percentage}%</span>
                    </div>
                    <div className="h-3 w-full bg-slate-100 rounded-2xl overflow-hidden p-0.5 border border-white shadow-inner">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress.percentage}%` }}
                        className="h-full bg-gradient-to-r from-sky-400 to-blue-500 rounded-xl"
                      />
                    </div>
                  </div>

                  {/* Quick Actions Grid */}
                  <div className="grid grid-cols-2 gap-3 pt-6 border-t border-slate-100">
                    <a
                      href={`/team/case/${c.id}`}
                      className="flex items-center justify-center gap-2 py-3 bg-slate-50 hover:bg-sky-50 text-slate-600 hover:text-sky-600 border border-slate-200 hover:border-sky-200 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      <Eye size={14} />
                      REVISAR
                    </a>

                    <button
                      onClick={() => resendEmail(client?.email || '')}
                      className="flex items-center justify-center gap-2 py-3 bg-slate-50 hover:bg-orange-50 text-slate-600 hover:text-orange-600 border border-slate-200 hover:border-orange-200 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      <Mail size={14} />
                      COBRAR
                    </button>

                    <a
                      href={`/team/case/${c.id}/print`}
                      className="col-span-2 flex items-center justify-center gap-2 py-3 bg-slate-900 hover:bg-sky-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-md shadow-slate-900/10"
                    >
                      <Printer size={14} />
                      ENVIAR PARA ESTEIRA DE IMPRESSÃO
                      <ChevronRight size={14} />
                    </a>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-[9px] font-bold text-slate-300 uppercase tracking-widest">
                    <span>ID: {c.id.slice(0, 8)}</span>
                    <span>Criado: {timeAgo(c.created_at)}</span>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}

        {/* ── Page Signature (Footer) ── */}
        <footer className="mt-20 pt-10 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4 opacity-60 hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Platform Strategy & Operations</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-slate-400">Powered by</span>
            <img src="/bomjur-logo.png" alt="Bomjur" className="h-5 w-auto grayscale" />
          </div>
        </footer>

      </main>

      <CreateCaseModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => { setModalOpen(false); fetchTenantIdAndCases() }}
      />
    </div>
  )
}

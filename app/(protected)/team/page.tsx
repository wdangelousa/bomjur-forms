'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calculateProgress, getCaseStatusLabel, getCaseStatusColor, getCaseTypeColor } from '@/lib/cases/case-helpers'
import CreateCaseModal from '@/components/team/CreateCaseModal'
import type { Case, Profile, CaseDocument, CaseStatus, CaseType } from '@/types'
import { Plus, Search, FolderOpen, Clock, Copy, Send, Mail, CheckCircle2 } from 'lucide-react'

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

    // 1. Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    // 2. Get user's tenant_id
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    if (!userProfile?.tenant_id) {
      setLoading(false)
      return
    }

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

    // Supabase Realtime Subscription for 'Wow' effect
    const channel = supabase.channel('team-dashboard-cases')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cases', filter: `tenant_id=eq.${tenantId}` },
        () => {
          fetchCases(tenantId)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tenantId])

  const copyToClipboard = async (caseId: string, email: string) => {
    // In a real app, you would fetch or construct the login link.
    // We will copy the generic login URL, assuming magic link or boarding password.
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://app.bomjur.com'
    const loginUrl = new URL('/login', baseUrl).toString()
    const msg = `Seu processo na Proexpand foi iniciado.\nAcesse: ${loginUrl}\nLogin: ${email}`

    await navigator.clipboard.writeText(msg)
    setCopiedLink(caseId)
    setTimeout(() => setCopiedLink(null), 2000)
  }

  const resendEmail = async (caseId: string, email: string) => {
    // Typically calls an API to resend the invite email via Resend
    alert(`A funcionalidade de reenviar e-mail para ${email} será implementada na API.`)
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

  // Create sections for 'Recent Invites' vs 'Active Cases'
  const recentInvites = filtered.filter(c => c.status === 'pending_onboarding')
  const activeCases = filtered.filter(c => c.status !== 'pending_onboarding')

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const days = Math.floor(diff / 86400000)
    const hours = Math.floor(diff / 3600000)
    const minutes = Math.floor(diff / 60000)

    if (minutes < 60) return `${minutes} min atrás`
    if (hours < 24) return `${hours} horas atrás`
    if (days === 0) return 'Hoje'
    if (days === 1) return 'Ontem'
    if (days < 7) return `${days} dias atrás`
    return `${Math.floor(days / 7)} sem atrás`
  }

  return (
    <div suppressHydrationWarning className="p-4 lg:p-8 max-w-5xl text-slate-900 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Pipeline de <span className="text-sky-500">Clientes</span></h1>
          <p className="text-slate-500 text-sm font-medium mt-1">
            Acompanhe processos e convites gerados
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center justify-center gap-2 px-6 py-3.5 bg-sky-500 text-white font-black uppercase tracking-widest rounded-2xl text-xs hover:bg-sky-600 transition-all active:scale-[0.98] shadow-lg shadow-sky-500/20"
        >
          <Plus size={18} />
          Gerar Convite / Link
        </button>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar cliente por nome ou email..."
            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 transition-all font-medium shadow-sm"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as CaseStatus | 'all')}
            className="px-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-600 font-bold text-sm focus:outline-none focus:border-sky-500 transition-all appearance-none cursor-pointer shadow-sm"
          >
            <option value="all">Todos os Status</option>
            <option value="pending_onboarding">1. Aguardando Preenchimento</option>
            <option value="documents_pending">2. Docs Pendentes</option>
            <option value="in_progress">3. Em Andamento</option>
            <option value="in_review">4. Em Revisão</option>
            <option value="complete">5. Completo</option>
          </select>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value as CaseType | 'all')}
            className="px-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-600 font-bold text-sm focus:outline-none focus:border-sky-500 transition-all appearance-none cursor-pointer shadow-sm"
          >
            <option value="all">Tipo</option>
            <option value="I-485">I-485</option>
            <option value="I-140">I-140</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-3xl shadow-sm">
          <FolderOpen size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-700 font-black text-lg">
            {cases.length === 0 ? 'Nenhum convite gerado' : 'Nenhum caso encontrado'}
          </p>
          <p className="text-slate-500 text-sm mt-2 font-medium">
            {cases.length === 0 ? 'Clique no botão azul acima para iniciar um novo processo.' : 'Tente limpar os filtros de busca.'}
          </p>
        </div>
      ) : (
        <div className="space-y-12">
          {/* Recent Invites Section */}
          {recentInvites.length > 0 && (
            <section>
              <h2 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" />
                Convites Recentes (Aguardando Cliente)
                <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full ml-2">{recentInvites.length}</span>
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {recentInvites.map(c => {
                  const client = c.profiles as any as Profile
                  return (
                    <div key={c.id} className="bg-white border border-amber-200/60 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-bl-full -z-10 opacity-50" />

                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-black text-slate-900 truncate">
                            {client?.full_name || 'Cliente'}
                          </h3>
                          <p className="text-xs font-semibold text-slate-500 truncate mt-0.5">{client?.email}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className="px-2.5 py-1 rounded-lg bg-orange-50 border border-orange-200 text-orange-600 text-[10px] font-black uppercase tracking-widest">
                            Aguardando Preenchimento
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold">
                            Criado {timeAgo(c.created_at)}
                          </span>
                        </div>
                      </div>

                      {/* Quick Actions */}
                      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100">
                        <button
                          onClick={(e) => { e.preventDefault(); copyToClipboard(c.id, client?.email || ''); }}
                          className="flex-1 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 transition-all flex items-center justify-center gap-2"
                        >
                          {copiedLink === c.id ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Copy size={14} />}
                          {copiedLink === c.id ? 'Copiado!' : 'COPIAR LINK'}
                        </button>
                        <button
                          onClick={(e) => { e.preventDefault(); resendEmail(c.id, client?.email || ''); }}
                          className="flex-1 py-2.5 bg-sky-50 hover:bg-sky-100 border border-sky-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-sky-600 transition-all flex items-center justify-center gap-2"
                        >
                          <Mail size={14} />
                          REENVIAR EMAIL
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Active Cases Section */}
          {activeCases.length > 0 && (
            <section>
              <h2 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-sky-500" />
                Processos em Andamento
                <span className="bg-slate-200 text-slate-700 text-xs px-2 py-0.5 rounded-full ml-2">{activeCases.length}</span>
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {activeCases.map(c => {
                  const client = c.profiles as any as Profile
                  const progress = calculateProgress(c.case_documents || [])

                  return (
                    <a
                      key={c.id}
                      href={`/team/case/${c.id}`}
                      className="block bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-sky-300 transition-all group"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-black text-slate-900 truncate group-hover:text-sky-600 transition-colors">
                            {client?.full_name || 'Sem nome'}
                          </h3>
                          <p className="text-xs font-semibold text-slate-500 truncate mt-0.5">{client?.email}</p>
                        </div>
                        <span className={`shrink-0 ml-2 px-3 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest bg-slate-50 text-slate-700 border-slate-200`}>
                          {c.case_type}
                        </span>
                      </div>

                      <div className="mb-4">
                        <div className="flex justify-between text-[10px] font-bold mb-1.5">
                          <span className="text-slate-500 uppercase tracking-widest">{progress.approved}/{progress.total} docs analisados</span>
                          <span className="text-sky-600">{progress.percentage}%</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                          <div className="h-full bg-sky-500 rounded-full transition-all duration-500" style={{ width: `${progress.percentage}%` }} />
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                        <span className={`px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest ${c.status === 'documents_pending' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                          c.status === 'in_review' ? 'bg-purple-50 text-purple-600 border-purple-200' :
                            'bg-emerald-50 text-emerald-600 border-emerald-200'
                          }`}>
                          {getCaseStatusLabel(c.status)}
                        </span>
                        <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          <Clock size={12} />
                          {timeAgo(c.created_at)}
                        </span>
                      </div>

                      {progress.rejected > 0 && (
                        <div className="mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-600 flex items-center gap-2">
                          ⚠️ {progress.rejected} doc{progress.rejected > 1 ? 's' : ''} rejeitado{progress.rejected > 1 ? 's' : ''}. Ação necessária.
                        </div>
                      )}
                    </a>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      )}

      <CreateCaseModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => { setModalOpen(false); fetchTenantIdAndCases() }}
      />
    </div>
  )
}


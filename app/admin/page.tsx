'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calculateProgress, getCaseStatusLabel, getCaseStatusColor, getCaseTypeColor } from '@/lib/cases/case-helpers'
import CreateCaseModal from '@/components/team/CreateCaseModal'
import type { Case, Profile, CaseDocument, CaseStatus, CaseType } from '@/types'
import { Plus, Search, FolderOpen, Clock } from 'lucide-react'

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
  const supabase = createClient()

  const fetchCases = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('cases')
      .select(`
        *,
        profiles!client_id (id, full_name, email, phone, preferred_language),
        case_documents (status, is_required)
      `)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setCases(data as unknown as CaseWithRelations[])
    }
    setLoading(false)
  }

  useEffect(() => { fetchCases() }, [])

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
    if (days < 7) return `${days} dias atrás`
    if (days < 30) return `${Math.floor(days / 7)} sem atrás`
    return `${Math.floor(days / 30)} mês(es)`
  }

  return (
    <div className="p-4 lg:p-8 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-bomjur-text">Casos</h1>
          <p className="text-bomjur-muted text-sm mt-1">
            {cases.length} caso{cases.length !== 1 ? 's' : ''} no total
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-bomjur-lime text-bomjur-bg font-bold rounded-xl text-sm hover:bg-bomjur-lime-dark transition-colors active:scale-[0.98]"
        >
          <Plus size={18} />
          Novo Caso
        </button>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-bomjur-dim" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome ou email..."
            className="w-full pl-9 pr-4 py-2.5 bg-bomjur-card border border-bomjur-border rounded-xl text-bomjur-text placeholder:text-bomjur-dim text-sm focus:outline-none focus:border-bomjur-lime"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as CaseStatus | 'all')}
            className="px-3 py-2.5 bg-bomjur-card border border-bomjur-border rounded-xl text-bomjur-muted text-sm focus:outline-none focus:border-bomjur-lime appearance-none cursor-pointer"
          >
            <option value="all">Todos os status</option>
            <option value="pending_onboarding">Aguardando Onboarding</option>
            <option value="documents_pending">Docs Pendentes</option>
            <option value="in_progress">Em Andamento</option>
            <option value="in_review">Em Revisão</option>
            <option value="complete">Completo</option>
          </select>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value as CaseType | 'all')}
            className="px-3 py-2.5 bg-bomjur-card border border-bomjur-border rounded-xl text-bomjur-muted text-sm focus:outline-none focus:border-bomjur-lime appearance-none cursor-pointer"
          >
            <option value="all">Todos</option>
            <option value="I-485">I-485</option>
            <option value="I-140">I-140</option>
          </select>
        </div>
      </div>

      {/* Cases List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-bomjur-lime border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-bomjur-card border border-bomjur-border rounded-2xl">
          <FolderOpen size={40} className="mx-auto text-bomjur-dim mb-3" />
          <p className="text-bomjur-muted font-semibold">
            {cases.length === 0 ? 'Nenhum caso ainda' : 'Nenhum caso encontrado'}
          </p>
          <p className="text-bomjur-dim text-sm mt-1">
            {cases.length === 0 ? 'Crie o primeiro caso clicando no botão acima.' : 'Tente ajustar os filtros.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map(c => {
            const client = c.profiles as any as Profile
            const progress = calculateProgress(c.case_documents || [])

            return (
              <a
                key={c.id}
                href={`/team/case/${c.id}`}
                className="block bg-bomjur-card border border-bomjur-border rounded-xl p-4 hover:border-bomjur-dim transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-bomjur-text truncate group-hover:text-bomjur-lime transition-colors">
                      {client?.full_name || 'Sem nome'}
                    </h3>
                    <p className="text-xs text-bomjur-dim truncate mt-0.5">{client?.email}</p>
                  </div>
                  <span className={`shrink-0 ml-2 px-2.5 py-1 rounded-lg border text-[10px] font-bold ${getCaseTypeColor(c.case_type)}`}>
                    {c.case_type}
                  </span>
                </div>

                <div className="mb-3">
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-bomjur-dim">{progress.approved}/{progress.total} docs aprovados</span>
                    <span className="text-bomjur-lime font-semibold">{progress.percentage}%</span>
                  </div>
                  <div className="h-1.5 bg-bomjur-bg rounded-full overflow-hidden">
                    <div className="h-full bg-bomjur-lime rounded-full transition-all duration-500" style={{ width: `${progress.percentage}%` }} />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className={`px-2.5 py-1 rounded-lg border text-[10px] font-semibold ${getCaseStatusColor(c.status)}`}>
                    {getCaseStatusLabel(c.status)}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-bomjur-dim">
                    <Clock size={10} />
                    {timeAgo(c.created_at)}
                  </span>
                </div>

                {progress.rejected > 0 && (
                  <div className="mt-2 px-2.5 py-1.5 bg-red-400/10 border border-red-400/20 rounded-lg text-[10px] text-red-400 font-medium">
                    ⚠️ {progress.rejected} doc{progress.rejected > 1 ? 's' : ''} rejeitado{progress.rejected > 1 ? 's' : ''}
                  </div>
                )}
              </a>
            )
          })}
        </div>
      )}

      <CreateCaseModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => { setModalOpen(false); fetchCases() }}
      />
    </div>
  )
}

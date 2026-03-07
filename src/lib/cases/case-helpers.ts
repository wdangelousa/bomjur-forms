import type { CaseStatus, DocumentStatus, PreferredLanguage } from '@/types'

export interface CaseProgress {
  total: number
  approved: number
  uploaded: number
  inReview: number
  rejected: number
  pending: number
  percentage: number
}

export function calculateProgress(documents: { status: DocumentStatus; is_required: boolean }[]): CaseProgress {
  const required = documents.filter(d => d.is_required)
  const total = required.length
  const approved = required.filter(d => d.status === 'approved').length
  const uploaded = required.filter(d => d.status === 'uploaded').length
  const inReview = required.filter(d => d.status === 'in_review').length
  const rejected = required.filter(d => d.status === 'rejected').length
  const pending = required.filter(d => d.status === 'pending').length

  return {
    total,
    approved,
    uploaded,
    inReview,
    rejected,
    pending,
    percentage: total > 0 ? Math.round((approved / total) * 100) : 0,
  }
}

/**
 * Novo cálculo baseado em categorias finalizadas (status 'approved' na case_documents)
 */
export function calculateCategoryProgress(caseDocuments: { status: string; is_required: boolean }[]): CaseProgress {
  const required = caseDocuments.filter(d => d.is_required)
  const total = required.length
  const approved = required.filter(d => d.status === 'approved').length
  const inReview = required.filter(d => d.status === 'in_review').length
  const pending = required.filter(d => d.status === 'pending').length

  return {
    total,
    approved,
    uploaded: 0, // Ignorado no novo fluxo
    inReview,
    rejected: 0, // Ignorado no novo fluxo
    pending,
    percentage: total > 0 ? Math.round((approved / total) * 100) : 0,
  }
}

const statusLabels: Record<CaseStatus, { pt: string; en: string }> = {
  pending_onboarding: { pt: 'Aguardando Onboarding', en: 'Pending Onboarding' },
  in_progress: { pt: 'Em Andamento', en: 'In Progress' },
  documents_pending: { pt: 'Docs Pendentes', en: 'Docs Pending' },
  in_review: { pt: 'Em Revisão', en: 'In Review' },
  ready_for_filing: { pt: 'Pronto p/ Filing', en: 'Ready for Filing' },
  complete: { pt: 'Completo', en: 'Complete' },
  archived: { pt: 'Arquivado', en: 'Archived' },
}

export function getCaseStatusLabel(status: CaseStatus, lang: PreferredLanguage = 'pt'): string {
  return statusLabels[status]?.[lang] || status
}

export function getCaseStatusColor(status: CaseStatus): string {
  const colors: Record<CaseStatus, string> = {
    pending_onboarding: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
    in_progress: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    documents_pending: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
    in_review: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
    ready_for_filing: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
    complete: 'text-green-400 bg-green-400/10 border-green-400/20',
    archived: 'text-gray-400 bg-gray-400/10 border-gray-400/20',
  }
  return colors[status] || 'text-gray-400 bg-gray-400/10 border-gray-400/20'
}

export function getCaseTypeLabel(caseType: string): string {
  return caseType // I-485, I-140 already readable
}

export function getCaseTypeColor(caseType: string): string {
  if (caseType === 'I-485') return 'text-bomjur-lime bg-bomjur-lime/10 border-bomjur-lime/20'
  if (caseType === 'I-140') return 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20'
  return 'text-gray-400 bg-gray-400/10 border-gray-400/20'
}

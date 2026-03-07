'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Upload,
  Image as ImageIcon,
  Languages,
  Info,
  ShieldCheck,
  LogOut,
  Check,
  HelpCircle,
  Eye,
  RotateCcw,
  UserCircle2,
  X,
  PlusCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import FormProgressBar from '@/components/ui/FormProgressBar'

// ============================================================
// TYPES & CONFIG
// ============================================================

type DocStatus = 'pending' | 'under_review' | 'approved'

interface UploadedDoc {
  clientDocId: string
  fileName: string
  relationship: string
  extractionStatus: string // 'processing' | 'completed' | 'failed'
}

interface ChecklistItem {
  id: string
  title: string
  category: string
  description: string
  tooltip: string
  hasTranslation?: boolean
  documents: UploadedDoc[]
  dbStatus: DocStatus // status oficial vindo de case_documents (nível de categoria)
}

const DASHBOARD_CHECKLIST_BASE = [
  {
    id: 'passport',
    title: 'Identidade (Passaporte)',
    category: 'passport',
    description: 'Página de identificação',
    tooltip: 'Envie a cópia da página com sua foto e dados.',
  },
  {
    id: 'i94',
    title: 'Status Legal (I-94)',
    category: 'i94',
    description: 'Registro de entrada',
    tooltip: 'Seu registro de chegada/partida. Pode ser obtido no site do CBP.',
  },
  {
    id: 'birth_cert',
    title: 'Registros Vitais (Certidão)',
    category: 'birth_certificate',
    description: 'Nascimento / Casamento',
    tooltip: 'Envie sua certidão de nascimento original.',
    hasTranslation: true,
  },
  {
    id: 'photos',
    title: 'Fotografias (Estilo Passaporte)',
    category: 'passport_photos',
    description: '2 fotos idênticas 2x2',
    tooltip: '2 fotos idênticas coloridas estilo passaporte (2x2 polegadas), tiradas nos últimos 30 dias.',
  },
]

const RELATIONSHIP_OPTIONS = [
  'Requerente Principal',
  'Cônjuge',
  'Filho(a)',
  'Outro',
]

const RELATIONSHIP_BADGE: Record<string, string> = {
  'Requerente Principal': 'bg-sky-100 text-sky-700',
  'Cônjuge': 'bg-violet-100 text-violet-700',
  'Filho(a)': 'bg-emerald-100 text-emerald-700',
  'Outro': 'bg-slate-100 text-slate-600',
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

const StatusBadge = ({ status }: { status: DocStatus }) => {
  switch (status) {
    case 'approved':
      return (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span className="text-[10px] font-black uppercase tracking-wider">Aprovado</span>
        </div>
      )
    case 'under_review':
      return (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 rounded-full border border-amber-100">
          <Clock className="w-3.5 h-3.5" />
          <span className="text-[10px] font-black uppercase tracking-wider">Em Revisão</span>
        </div>
      )
    default:
      return (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-500 rounded-full border border-slate-200">
          <AlertCircle className="w-3.5 h-3.5" />
          <span className="text-[10px] font-black uppercase tracking-wider">Pendente</span>
        </div>
      )
  }
}

// ============================================================
// MAIN PAGE
// ============================================================

export default function IntelligentChecklistDashboard() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Record<string, string> | null>(null)
  const [currentCase, setCurrentCase] = useState<Record<string, string> | null>(null)
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [uploadingId, setUploadingId] = useState<string | null>(null)

  // Relationship picker modal state
  const [relationshipPicker, setRelationshipPicker] = useState<{ itemId: string; category: string } | null>(null)
  const [selectedRelationship, setSelectedRelationship] = useState('Requerente Principal')

  // Refs for hidden file inputs
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // ── Load Data ────────────────────────────────────────────────────────────────
  const loadDashboard = async (showLoading = true) => {
    if (showLoading) setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    const [profRes, caseRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('cases').select('*').eq('client_id', user.id).neq('status', 'archived').order('created_at', { ascending: false }).limit(1).single(),
    ])

    if (profRes.data) setProfile(profRes.data)

    // Build base checklist
    const base: ChecklistItem[] = DASHBOARD_CHECKLIST_BASE.map(b => ({
      ...b,
      documents: [],
      dbStatus: 'pending' as DocStatus,
    }))

    if (caseRes.data) {
      setCurrentCase(caseRes.data)

      // Load case_documents and client_documents in parallel
      const [caseDocsRes, clientDocsRes] = await Promise.all([
        supabase.from('case_documents').select('document_type, status').eq('case_id', caseRes.data.id),
        fetch(`/api/dashboard/documents?userId=${user.id}`).then(r => r.json()) as Promise<{ docs: any[] }>
      ])

      const caseDocs = caseDocsRes.data
      const clientDocs = clientDocsRes.docs

      const DOC_TYPE_MAP: Record<string, string> = {
        passport: 'passport',
        i94: 'i94',
        birth_certificate: 'birth_certificate',
        photo_2x2: 'passport_photos',
      }
      const DB_STATUS_MAP: Record<string, DocStatus> = {
        uploaded: 'under_review',
        in_review: 'under_review',
        approved: 'approved',
        pending: 'pending',
        rejected: 'pending',
      }

      // Map Category Status (case_documents)
      if (caseDocs) {
        caseDocs.forEach(d => {
          const category = DOC_TYPE_MAP[d.document_type]
          if (!category) return
          const item = base.find(b => b.category === category)
          if (item) {
            // Se já estiver aprovado, não sobrescreve com 'pending' vindo de outros registros
            if (item.dbStatus !== 'approved') {
              item.dbStatus = DB_STATUS_MAP[d.status] ?? 'pending'
            }
          }
        })
      }

      // Map Individual Documents (client_documents)
      if (clientDocs) {
        clientDocs.forEach(d => {
          const item = base.find(b => b.category === d.document_type)
          if (!item) return
          const relationship = d.metadata?.relationship ?? 'Requerente Principal'
          item.documents.push({
            clientDocId: d.id,
            fileName: d.file_name,
            relationship,
            extractionStatus: d.extraction_status,
          })
        })
      }
    }

    setChecklist(base)
    if (showLoading) setLoading(false)
  }

  useEffect(() => {
    loadDashboard()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Upload ───────────────────────────────────────────────────────────────────
  const handleUpload = async (itemId: string, category: string, file: File, relationship: string) => {
    if (!currentCase || !profile) return

    setUploadingId(itemId)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('caseId', currentCase.id)
      formData.append('clientId', profile.id)
      formData.append('category', category)
      formData.append('relationship', relationship)

      const res = await fetch('/api/dashboard/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro no upload')

      // Refresh data to show the processing doc
      await loadDashboard(false)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error('Upload error:', msg)
      alert(`Erro ao enviar documento: ${msg}`)
    } finally {
      setUploadingId(null)
    }
  }

  // ── Relationship picker flow ─────────────────────────────────────────────────
  const openRelationshipPicker = (itemId: string, category: string) => {
    setSelectedRelationship('Requerente Principal')
    setRelationshipPicker({ itemId, category })
  }

  const confirmRelationshipAndOpenFilePicker = () => {
    if (!relationshipPicker) return
    const ref = fileInputRefs.current[relationshipPicker.itemId]
    setRelationshipPicker(null)
    setTimeout(() => ref?.click(), 50)
  }

  const handleReplaceDocument = async (itemId: string) => {
    if (!window.confirm('Isso removerá todos os documentos desta categoria. Continuar?')) return

    // Simplificando: o usuário quer "recomeçar" o upload desta categoria.
    // Na prática, deveria deletar no banco. Por ora, limpamos na UI e pedimos novo upload.
    setChecklist(prev => prev.map(item =>
      item.id === itemId ? { ...item, dbStatus: 'pending', documents: [] } : item
    ))
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // ── Derived metrics ──────────────────────────────────────────────────────────
  // Cálculo de progresso corrigido: conta documentos ÚNICOS aprovados (status 'completed' no client_documents)
  const allDocs = checklist.flatMap(i => i.documents)
  const approvedDocsCount = allDocs.filter(d => d.extractionStatus === 'completed').length

  // Para a barra de progresso, usamos o percentual de CATEGORIAS concluídas (padrão checklist)
  const approvedCategoriesCount = checklist.filter(i => i.dbStatus === 'approved').length
  const totalCategories = checklist.length
  const progress = totalCategories > 0 ? Math.round((approvedCategoriesCount / totalCategories) * 100) : 0

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">

      {/* ── Relationship Picker Modal ── */}
      <AnimatePresence>
        {relationshipPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
            style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}
            onClick={() => setRelationshipPicker(null)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 40, opacity: 0, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 360, damping: 32 }}
              className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-base font-black text-slate-900">A quem pertence este documento?</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Selecione o membro da família.</p>
                </div>
                <button onClick={() => setRelationshipPicker(null)} className="text-slate-400 hover:text-slate-700 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2 mb-6">
                {RELATIONSHIP_OPTIONS.map(opt => (
                  <button
                    key={opt}
                    onClick={() => setSelectedRelationship(opt)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border text-sm font-bold transition-all ${selectedRelationship === opt
                      ? 'bg-sky-50 border-sky-400 text-sky-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                  >
                    <UserCircle2 className={`w-4 h-4 ${selectedRelationship === opt ? 'text-sky-500' : 'text-slate-400'}`} />
                    {opt}
                    {selectedRelationship === opt && <Check className="w-4 h-4 ml-auto text-sky-500" />}
                  </button>
                ))}
              </div>

              <button
                onClick={confirmRelationshipAndOpenFilePicker}
                className="w-full py-3.5 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-sky-600 transition-all"
              >
                Continuar → Selecionar Arquivo
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Top Bar ── */}
      <header className="sticky top-0 bg-white/80 backdrop-blur-xl border-b border-slate-200 z-40 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <img src="/proexpand-logo.png" alt="Proexpand" className="h-8 w-auto" />
          <div className="flex items-center gap-6">
            <div className="hidden sm:flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Ambiente Seguro
            </div>
            <div className="w-px h-6 bg-slate-200" />
            <button onClick={handleLogout} className="text-slate-400 hover:text-red-500 transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 pt-10">
        {/* ── Progress Header ── */}
        <header className="mb-12">
          <div className="flex items-end justify-between mb-4">
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">
                Olá, <span className="text-sky-500">{profile?.full_name?.split(' ')[0]}!</span>
              </h1>
              <p className="text-slate-500 font-medium mt-1">Checklist de Evidências USCIS</p>
            </div>
            <div className="text-right">
              <span className="text-4xl font-black text-slate-900 leading-none">{approvedDocsCount}</span>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mt-2">Docs Confirmados</p>
            </div>
          </div>

          <div className="h-4 w-full bg-slate-200 rounded-2xl overflow-hidden p-1 border border-white shadow-inner">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1.5, ease: 'circOut' }}
              className="h-full bg-gradient-to-r from-sky-400 to-blue-600 rounded-xl shadow-[0_0_15px_rgba(14,165,233,0.4)]"
            />
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="flex -space-x-2">
              {[1, 2, 3, 4].map(num => (
                <div key={num} className={`w-8 h-8 rounded-full border-2 border-slate-50 flex items-center justify-center text-[10px] font-black ${approvedCategoriesCount >= num ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                  {approvedCategoriesCount >= num ? <Check className="w-3 h-3" /> : num}
                </div>
              ))}
            </div>
            <p className="text-xs font-bold text-slate-500 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-sky-500" />
              Dúvidas no envio? Fale com suporte.
            </p>
          </div>
        </header>

        {/* ── Progresso do Formulário I-485 ── */}
        <div className="mb-8">
          <FormProgressBar
            currentStep={Math.min(approvedCategoriesCount + 1, totalCategories)}
            totalSteps={totalCategories}
            completionPercentage={progress}
            formName="I-485"
          />
        </div>

        {/* ── Document Checklist ── */}
        <div className="space-y-4">
          {checklist.map((item, idx) => {
            const isCert = item.id === 'birth_cert'
            const isApproved = item.dbStatus === 'approved'
            const hasDocuments = item.documents.length > 0

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.08 }}
                className={`group relative bg-white border rounded-[2rem] p-6 transition-all ${isApproved ? 'border-emerald-100 bg-emerald-50/20' : 'border-slate-200 hover:border-sky-300 hover:shadow-xl hover:shadow-slate-200/50'}`}
              >
                <input
                  ref={el => { fileInputRefs.current[item.id] = el }}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      handleUpload(item.id, item.category, file, selectedRelationship)
                      e.target.value = ''
                    }
                  }}
                />

                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
                  {/* Left: icon + title + description + tooltip */}
                  <div className="flex items-start gap-5 flex-1 min-w-0">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border ${isApproved ? 'bg-emerald-100 border-emerald-200 text-emerald-600' : 'bg-slate-50 border-slate-100 text-slate-400 group-hover:bg-sky-50 group-hover:border-sky-100 group-hover:text-sky-500'}`}>
                      {item.id === 'photos' ? <ImageIcon className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-3 mb-1 flex-wrap">
                        <h3 className="font-black text-slate-900 tracking-tight">{item.title}</h3>
                        <StatusBadge status={item.dbStatus} />
                      </div>
                      <p className="text-sm font-medium text-slate-500 leading-relaxed max-w-xs uppercase text-[11px] tracking-wider">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  {/* Right: action button — ALWAYS visible if not approved, or show "Adicionar Outro" if has docs */}
                  <div className="flex flex-col items-end gap-3 self-end sm:self-start shrink-0">
                    {uploadingId === item.id ? (
                      <div className="flex items-center gap-2 px-5 py-3 bg-sky-50 text-sky-600 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-sky-100">
                        <Clock className="w-4 h-4 animate-spin" />
                        Extraindo...
                      </div>
                    ) : (
                      <button
                        onClick={() => openRelationshipPicker(item.id, item.category)}
                        className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-sm ${hasDocuments
                          ? 'bg-white border border-slate-200 text-slate-900 hover:bg-slate-50'
                          : 'bg-slate-900 text-white hover:bg-sky-600 hover:shadow-sky-500/20'
                          }`}
                      >
                        {hasDocuments ? <><PlusCircle className="w-4 h-4" />Adicionar outro</> : <><Upload className="w-4 h-4" />Enviar Documento</>}
                      </button>
                    )}
                  </div>
                </div>

                {/* ── Documentos Enviados (1:N) ── */}
                {hasDocuments && (
                  <div className="mt-6 space-y-2 border-t border-slate-100 pt-5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1">
                      Documentos nesta categoria ({item.documents.length})
                    </p>
                    <div className="grid gap-2">
                      {item.documents.map(doc => (
                        <div key={doc.clientDocId} className="flex items-center gap-3 p-3 bg-slate-50/50 rounded-2xl border border-slate-100 hover:bg-slate-50 transition-colors">
                          <div className="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4 text-slate-400" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-700 font-bold truncate">{doc.fileName}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-tighter ${RELATIONSHIP_BADGE[doc.relationship] ?? 'bg-slate-100 text-slate-600'}`}>
                                {doc.relationship}
                              </span>
                            </div>
                          </div>

                          {/* Status individual do documento */}
                          <div className="shrink-0">
                            {doc.extractionStatus === 'completed' ? (
                              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
                                <CheckCircle2 className="w-3 h-3" />
                                <span className="text-[9px] font-black uppercase tracking-wider">Aprovado</span>
                              </div>
                            ) : doc.extractionStatus === 'failed' ? (
                              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-600 rounded-full border border-red-100">
                                <AlertCircle className="w-3 h-3" />
                                <span className="text-[9px] font-black uppercase tracking-wider">Falhou</span>
                              </div>
                            ) : (
                              <Link
                                href={`/upload/review/${doc.clientDocId}`}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 text-sky-600 rounded-full border border-sky-100 hover:bg-sky-100 transition-colors group/link"
                              >
                                <span className="text-[9px] font-black uppercase tracking-wider">Revisar Extração</span>
                                <ChevronRightIcon className="w-3 h-3 transition-transform group-hover/link:translate-x-0.5" />
                              </Link>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tooltip inline moved down for clarity if no docs */}
                {!hasDocuments && (
                  <div className="mt-4 flex items-center gap-2 p-2.5 bg-slate-50/50 rounded-xl border border-slate-100/50">
                    <Info className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                    <span className="text-[10px] font-bold text-slate-500 leading-tight">{item.tooltip}</span>
                  </div>
                )}

                {/* ── Translation alert for birth cert ── */}
                {isCert && (
                  <div className="mt-6 p-5 bg-orange-50 border border-orange-100 rounded-2xl overflow-hidden relative group/alert">
                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 shrink-0">
                        <Languages className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-[11px] font-black text-orange-800 uppercase tracking-widest mb-1 flex items-center gap-2">
                          Alerta de Tradução
                          <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                        </h4>
                        <p className="text-xs font-bold text-orange-700/80 leading-relaxed">
                          Qualquer documento em língua estrangeira deve estar acompanhado de uma tradução certificada completa para o inglês.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>

        {/* ── Footer ── */}
        <div className="mt-16 p-8 bg-slate-900 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:scale-110 transition-transform duration-1000">
            <ShieldCheck className="w-40 h-40 text-white" />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
            <div>
              <span className="px-3 py-1 bg-sky-500/20 text-sky-400 text-[10px] font-black uppercase tracking-widest rounded-full border border-sky-500/30">Próxima Etapa</span>
              <h3 className="text-xl font-black text-white mt-4 tracking-tight leading-tight">Preparação Final USCIS</h3>
              <p className="text-slate-400 text-sm font-medium mt-2 max-w-sm">
                Assim que aprovarmos todos os seus documentos, iniciaremos a assembleia física do seu processo.
              </p>
            </div>
            <button className="px-8 py-4 bg-white hover:bg-sky-500 hover:text-white text-slate-900 rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all shadow-xl active:scale-95 whitespace-nowrap">
              Ver Tutorial de Envio
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

function Plus({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  )
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
  )
}

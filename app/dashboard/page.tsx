'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
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
  Eye
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// ============================================================
// TYPES & CONFIG
// ============================================================

type DocStatus = 'pending' | 'under_review' | 'approved'

interface ChecklistItem {
  id: string
  title: string
  category: string
  description: string
  tooltip: string
  status: DocStatus
  hasTranslation?: boolean
}

const DASHBOARD_CHECKLIST: ChecklistItem[] = [
  {
    id: 'passport',
    title: 'Identidade (Passaporte)',
    category: 'passport',
    description: 'Página de identificação',
    tooltip: 'Envie a cópia da página com sua foto e dados.',
    status: 'pending'
  },
  {
    id: 'i94',
    title: 'Status Legal (I-94)',
    category: 'i94',
    description: 'Registro de entrada',
    tooltip: 'Seu registro de chegada/partida. Pode ser obtido no site do CBP.',
    status: 'pending'
  },
  {
    id: 'birth_cert',
    title: 'Registros Vitais (Certidão)',
    category: 'birth_certificate',
    description: 'Nascimento / Casamento',
    tooltip: 'Envie sua certidão de nascimento original.',
    status: 'pending',
    hasTranslation: true
  },
  {
    id: 'photos',
    title: 'Fotografias (Estilo Passaporte)',
    category: 'passport_photos',
    description: '2 fotos idênticas 2x2',
    tooltip: '2 fotos idênticas coloridas estilo passaporte (2x2 polegadas), tiradas nos últimos 30 dias.',
    status: 'pending'
  }
]

// ============================================================
// COMPONENTS
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

export default function IntelligentChecklistDashboard() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [currentCase, setCurrentCase] = useState<any>(null)
  const [checklist, setChecklist] = useState<ChecklistItem[]>(DASHBOARD_CHECKLIST)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [clientDocIds, setClientDocIds] = useState<Record<string, string>>({})

  // Load Data
  useEffect(() => {
    async function loadDashboard() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      // Fetch Profile & Case
      const [profRes, caseRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('cases').select('*').eq('client_id', user.id).neq('status', 'archived').order('created_at', { ascending: false }).limit(1).single()
      ])

      if (profRes.data) setProfile(profRes.data)
      if (caseRes.data) {
        setCurrentCase(caseRes.data)

        // Fetch Documents status for the case
        const { data: docs } = await supabase
          .from('case_documents')
          .select('document_type, status')
          .eq('case_id', caseRes.data.id)

        if (docs) {
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
          const updatedChecklist = checklist.map(item => {
            const match = docs.find(d => DOC_TYPE_MAP[d.document_type] === item.category)
            if (match) {
              return { ...item, status: DB_STATUS_MAP[match.status] ?? item.status }
            }
            return item
          })
          setChecklist(updatedChecklist)
        }
      }

      setLoading(false)
    }

    loadDashboard()
  }, [router, supabase])

  const handleUpload = async (itemId: string, category: string, file: File) => {
    if (!currentCase || !profile) return

    setUploadingId(itemId)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('caseId', currentCase.id)
      formData.append('clientId', profile.id)
      formData.append('category', category)

      const res = await fetch('/api/dashboard/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro no upload')

      setChecklist(prev => prev.map(item => item.id === itemId ? { ...item, status: 'under_review' } : item))
      if (data.clientDocumentId) {
        setClientDocIds(prev => ({ ...prev, [itemId]: data.clientDocumentId }))
      }

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error('Upload error:', msg)
      alert(`Erro ao enviar documento: ${msg}`)
    } finally {
      setUploadingId(null)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const approvedCount = checklist.filter(i => i.status === 'approved').length
  const totalCount = checklist.length
  const progress = Math.round((approvedCount / totalCount) * 100)

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* ── Top Bar ── */}
      <header className="sticky top-0 bg-white/80 backdrop-blur-xl border-b border-slate-200 z-50 px-6 py-4">
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
              <span className="text-4xl font-black text-slate-900 leading-none">{approvedCount}/{totalCount}</span>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mt-2">Documentos Aprovados</p>
            </div>
          </div>

          <div className="h-4 w-full bg-slate-200 rounded-2xl overflow-hidden p-1 border border-white shadow-inner">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1.5, ease: "circOut" }}
              className="h-full bg-gradient-to-r from-sky-400 to-blue-600 rounded-xl shadow-[0_0_15px_rgba(14,165,233,0.4)]"
            />
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="flex -space-x-2">
              {[1, 2, 3, 4].map(num => (
                <div key={num} className={`w-8 h-8 rounded-full border-2 border-slate-50 flex items-center justify-center text-[10px] font-black ${approvedCount >= num ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                  {approvedCount >= num ? <Check className="w-3 h-3" /> : num}
                </div>
              ))}
            </div>
            <p className="text-xs font-bold text-slate-500 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-sky-500" />
              Dúvidas no envio? Fale com suporte.
            </p>
          </div>
        </header>

        {/* ── Document Checklist ── */}
        <div className="space-y-4">
          {checklist.map((item, idx) => {
            const isCert = item.id === 'birth_cert'

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`group relative bg-white border rounded-[2rem] p-6 transition-all ${item.status === 'approved' ? 'border-emerald-100 bg-emerald-50/20' : 'border-slate-200 hover:border-sky-300 hover:shadow-xl hover:shadow-slate-200/50'}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div className="flex items-start gap-5">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border ${item.status === 'approved' ? 'bg-emerald-100 border-emerald-200 text-emerald-600' : 'bg-slate-50 border-slate-100 text-slate-400 group-hover:bg-sky-50 group-hover:border-sky-100 group-hover:text-sky-500'}`}>
                      {item.id === 'photos' ? <ImageIcon className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-black text-slate-900 tracking-tight">{item.title}</h3>
                        <StatusBadge status={item.status} />
                      </div>
                      <p className="text-sm font-medium text-slate-500 leading-relaxed max-w-xs uppercase text-[11px] tracking-wider">
                        {item.description}
                      </p>

                      {/* Tooltip Tip */}
                      <div className="mt-3 flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-100 opacity-80">
                        <Info className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                        <span className="text-[10px] font-bold text-slate-500 leading-tight">
                          {item.tooltip}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    <input
                      type="file"
                      id={`upload-${item.id}`}
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleUpload(item.id, item.category, file)
                      }}
                      disabled={item.status === 'approved'}
                    />

                    {item.status === 'pending' ? (
                      <label
                        htmlFor={`upload-${item.id}`}
                        className="flex items-center gap-2 px-6 py-3.5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-sky-600 hover:scale-105 hover:shadow-lg hover:shadow-sky-500/20 active:scale-95 cursor-pointer disabled:opacity-50"
                      >
                        {uploadingId === item.id ? (
                          <>
                            <Clock className="w-4 h-4 animate-spin" />
                            Extraindo...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            Enviar Documento
                          </>
                        )}
                      </label>
                    ) : item.status === 'under_review' ? (
                      <div className="flex items-center gap-2">
                        <button disabled className="flex items-center gap-2 px-6 py-3.5 bg-amber-50 text-amber-600 border border-amber-200 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                          <Clock className="w-4 h-4" />
                          Em Análise
                        </button>
                        {clientDocIds[item.id] && (
                          <Link
                            href={`/upload/review/${clientDocIds[item.id]}`}
                            className="flex items-center gap-2 px-4 py-3.5 bg-sky-50 text-sky-600 border border-sky-200 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-sky-100 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                            Ver Dados
                          </Link>
                        )}
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-200">
                        <Check className="w-5 h-5" />
                      </div>
                    )}
                  </div>
                </div>

                {/* CRITICAL ALERT FOR BIRTH CERTIFICATE */}
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

                        <div className="mt-4 flex gap-4">
                          <button className="flex-1 px-4 py-2 bg-white border border-orange-200 rounded-xl text-[10px] font-black text-orange-600 uppercase tracking-tighter hover:bg-orange-100 transition-colors">
                            Original
                          </button>
                          <button className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-xl text-[10px] font-black uppercase tracking-tighter hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 shadow-sm">
                            <Plus className="w-3 h-3" /> Tradução
                          </button>
                        </div>
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

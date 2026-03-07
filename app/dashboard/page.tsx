'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  ShieldCheck,
  LogOut,
  Check,
  HelpCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import FormProgressBar from '@/components/ui/FormProgressBar'
import DocumentCard from '@/components/documents/DocumentCard'

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
  languages?: boolean
  documents: any[]
  dbStatus: DocStatus
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
    languages: true,
  },
  {
    id: 'photos',
    title: 'Fotografias (Estilo Passaporte)',
    category: 'passport_photos',
    description: '2 fotos idênticas 2x2',
    tooltip: '2 fotos idênticas coloridas estilo passaporte (2x2 polegadas), tiradas nos últimos 30 dias.',
  },
]

// ============================================================
// MAIN PAGE
// ============================================================

export default function IntelligentChecklistDashboard() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [currentCase, setCurrentCase] = useState<any>(null)
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])

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
          item.documents.push({
            id: d.id,
            file_name: d.file_name,
            file_path: d.file_path,
            extraction_status: d.extraction_status,
            metadata: d.metadata,
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

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // ── Derived metrics ──────────────────────────────────────────────────────────
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
              <span className="text-4xl font-black text-slate-900 leading-none">{approvedCategoriesCount}/{totalCategories}</span>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mt-2">Categorias Aprovadas</p>
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
          {checklist.map((item, idx) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
            >
              <DocumentCard
                caseId={currentCase?.id}
                clientId={profile?.id}
                category={item.category}
                label={item.title}
                description={item.description}
                tooltip={item.tooltip}
                documents={item.documents}
                categoryStatus={item.dbStatus}
                onUpdate={() => loadDashboard(false)}
              />
            </motion.div>
          ))}
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

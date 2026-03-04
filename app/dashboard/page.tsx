'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calculateProgress, getCaseStatusLabel, getCaseStatusColor } from '@/lib/cases/case-helpers'
import { FileText, Clock, CheckCircle2, AlertCircle, ArrowRight, Activity, UploadCloud } from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'

export default function ClientDashboard() {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [activeCase, setActiveCase] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        setProfile(profileData)

        if (profileData) {
          const { data: casesData } = await supabase
            .from('cases')
            .select('*, case_documents (*)')
            .eq('client_id', profileData.id)
            .neq('status', 'archived')
            .order('created_at', { ascending: false })
            .limit(1)

          if (casesData && casesData.length > 0) {
            setActiveCase(casesData[0])
          }
        }
      } catch (error) {
        console.error('Error fetching client dashboard:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-2 border-bomjur-lime border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!activeCase) {
    return (
      <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-white">Olá, {profile?.full_name?.split(' ')[0] || 'Cliente'} 👋</h1>
          <p className="text-bomjur-muted mt-1">Bem-vindo(a) ao seu dashboard da Proexpand.</p>
        </header>
        <div className="bg-[#111827] border border-[#1E293B] rounded-2xl p-8 text-center mt-8">
          <div className="w-16 h-16 bg-[#1A2332] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-bomjur-dim" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Nenhum caso ativo</h3>
          <p className="text-bomjur-muted mb-6 max-w-md mx-auto">
            Atualmente, você não tem nenhum processo de imigração ativo em nossa plataforma.
            Se acredita que isso seja um erro, entre em contato com seu consultor.
          </p>
        </div>
      </div>
    )
  }

  const progress = calculateProgress(activeCase.case_documents || [])
  const documents = activeCase.case_documents || []
  const actionRequired = documents.filter((d: any) => d.status === 'rejected' || (d.is_required && d.status === 'pending'))
  const language = profile?.preferred_language || 'pt'

  const getDocStatusString = (status: string) => {
    switch (status) {
      case 'approved': return 'Aprovado';
      case 'rejected': return 'Rejeitado';
      case 'in_review': return 'Em Revisão';
      case 'pending': return 'Pendente';
      case 'uploaded': return 'Enviado';
      default: return 'Desconhecido';
    }
  }

  const getDocStatusStyle = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-500/10 text-green-500 border border-green-500/20';
      case 'rejected': return 'bg-red-500/10 text-red-500 border border-red-500/20';
      case 'in_review': return 'bg-blue-500/10 text-blue-500 border border-blue-500/20';
      case 'pending': return 'bg-[#1A2332] text-bomjur-dim border border-[#1E293B]';
      case 'uploaded': return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
      default: return '';
    }
  }

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            Olá, <span className="text-bomjur-lime">{profile?.full_name?.split(' ')[0] || 'Cliente'}</span>
          </h1>
          <p className="text-bomjur-muted mt-2 text-sm flex items-center gap-2">
            Acompanhe o status do seu processo <strong className="text-white bg-white/10 px-2 py-0.5 rounded-md">{activeCase.case_type}</strong>
          </p>
        </div>
        <div className={`px-4 py-2 rounded-xl text-sm font-bold border ${getCaseStatusColor(activeCase.status)}`}>
          Status Atual: {getCaseStatusLabel(activeCase.status, language)}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-[#111827] border border-[#1E293B] rounded-[24px] p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-bomjur-lime/5 rounded-full blur-3xl -mr-10 -mt-10" />
            <h3 className="text-sm font-bold text-bomjur-muted uppercase tracking-wider mb-6 flex items-center gap-2">
              <Activity className="w-4 h-4" /> Progresso Geral
            </h3>

            <div className="flex flex-col items-center justify-center py-4">
              <div className="relative w-40 h-40 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="80" cy="80" r="70" className="stroke-[#1E293B]" strokeWidth="12" fill="none" />
                  <circle
                    cx="80" cy="80" r="70"
                    className="stroke-bomjur-lime transition-all duration-1000 ease-out"
                    strokeWidth="12" fill="none"
                    strokeDasharray={2 * Math.PI * 70}
                    strokeDashoffset={2 * Math.PI * 70 * (1 - progress.percentage / 100)}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-4xl font-black text-white">{progress.percentage}%</span>
                  <span className="text-[10px] text-bomjur-dim uppercase font-bold tracking-widest mt-1">Concluído</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="bg-[#0A0E17] p-3 rounded-xl border border-[#1E293B]">
                <p className="text-[10px] text-bomjur-dim uppercase font-bold mb-1">Aprovados</p>
                <p className="text-lg font-bold text-white">{progress.approved} <span className="text-xs text-bomjur-muted font-normal">/ {progress.total}</span></p>
              </div>
              <div className="bg-[#0A0E17] p-3 rounded-xl border border-[#1E293B]">
                <p className="text-[10px] text-bomjur-dim uppercase font-bold mb-1">Em Revisão</p>
                <p className="text-lg font-bold text-white">{progress.inReview}</p>
              </div>
            </div>
          </motion.div>

          {actionRequired.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-red-500/10 border border-red-500/20 rounded-[24px] p-6">
              <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> Ação Necessária
              </h3>
              <p className="text-sm text-red-200/80 mb-5">
                Você possui {actionRequired.length} documento(s) pendentes ou que precisam de correção.
              </p>
              <Link href={`/case/${activeCase.id}/documents`} className="flex items-center justify-center gap-2 w-full py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-colors text-sm">
                Gerenciar Documentos <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          )}

          {actionRequired.length === 0 && progress.percentage < 100 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-blue-500/10 border border-blue-500/20 rounded-[24px] p-6">
              <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4" /> Em Análise
              </h3>
              <p className="text-sm text-blue-200/80">
                A nossa equipa está a rever os seus documentos atuais. Notificaremos você assim que houver novidades.
              </p>
            </motion.div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#111827] border border-[#1E293B] rounded-[24px] p-6 overflow-hidden flex flex-col h-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-bomjur-dim" /> Lista de Documentos
              </h3>
              <Link href={`/case/${activeCase.id}/documents`} className="text-xs font-bold text-bomjur-lime hover:text-white transition-colors flex items-center gap-1">
                Ver todos <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="space-y-3 flex-1">
              {documents.slice(0, 6).map((doc: any) => (
                <div key={doc.id} className="flex items-center justify-between p-4 rounded-xl bg-[#0A0E17] border border-[#1E293B] hover:border-[#1E293B]/80 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="mt-1">
                      {doc.status === 'approved' ? <CheckCircle2 className="w-5 h-5 text-green-500" /> :
                        doc.status === 'rejected' ? <AlertCircle className="w-5 h-5 text-red-500" /> :
                          doc.status === 'in_review' ? <Clock className="w-5 h-5 text-blue-500" /> :
                            <FileText className="w-5 h-5 text-bomjur-dim" />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{doc.title}</p>
                      <p className="text-xs text-bomjur-dim mt-0.5 max-w-[200px] sm:max-w-md truncate">{doc.description}</p>
                    </div>
                  </div>
                  <div className="hidden sm:block">
                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${getDocStatusStyle(doc.status)}`}>
                      {getDocStatusString(doc.status)}
                    </span>
                  </div>
                </div>
              ))}

              {documents.length === 0 && (
                <div className="text-center py-12">
                  <UploadCloud className="w-12 h-12 text-[#1E293B] mx-auto mb-3" />
                  <p className="text-sm text-bomjur-muted">Esta área será ativada assim que os seus documentos forem requeridos.</p>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Rocket,
  ArrowRight,
  FileText,
  TrendingUp,
  ShieldCheck,
  LogOut
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface CaseWithStats {
  id: string
  case_type: string
  status: string
  created_at: string
  progress: number
  approvedCount: number
  totalCount: number
}

export default function ClientHeadquarters() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [cases, setCases] = useState<CaseWithStats[]>([])
  const [greeting, setGreeting] = useState('')

  useEffect(() => {
    const hours = new Date().getHours()
    if (hours < 12) setGreeting('Bom dia')
    else if (hours < 18) setGreeting('Boa tarde')
    else setGreeting('Boa noite')
  }, [])

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        console.error('[DASHBOARD] Sem usuário autenticado. Redirecionando para login.')
        router.push('/login')
        return
      }

      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profErr || !prof) {
        console.error('[DASHBOARD] Erro ao buscar perfil. Redirecionando para login.', profErr)
        router.push('/login')
        return
      }

      // Redirect non-clients back to their respective dashboards if they somehow get here
      if (prof.role !== 'client') {
        if (['super_admin', 'admin'].includes(prof.role)) router.push('/admin')
        else if (['team', 'tenant_admin'].includes(prof.role)) router.push('/team')
        return
      }

      setProfile(prof)

      // Fetch Cases
      const { data: userCases } = await supabase
        .from('cases')
        .select('*')
        .eq('client_id', user.id)
        .neq('status', 'archived')
        .order('created_at', { ascending: false })

      if (userCases) {
        const caseStats: CaseWithStats[] = await Promise.all(
          userCases.map(async (c) => {
            const { data: docs } = await supabase
              .from('case_documents')
              .select('status')
              .eq('case_id', c.id)

            const total = docs?.length || 0
            const approved = docs?.filter(d => d.status === 'approved').length || 0
            const progress = total > 0 ? Math.round((approved / total) * 100) : 0

            return {
              ...c,
              progress,
              approvedCount: approved,
              totalCount: total
            }
          })
        )
        setCases(caseStats)
      }

      setLoading(false)
    }

    loadData()
  }, [router, supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-lime-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20 text-slate-900">
      {/* ── Top Navigation ── */}
      <nav className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-200 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-lime-500 rounded-lg flex items-center justify-center shadow-lg shadow-lime-500/20">
              <ShieldCheck className="text-slate-900 w-5 h-5" strokeWidth={2.5} />
            </div>
            <span className="font-black text-slate-900 tracking-tight text-lg">Bomjur</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Status do Acesso</span>
              <span className="text-xs font-bold text-emerald-500">Criptografia Ativa</span>
            </div>
            <div className="w-px h-6 bg-slate-200 hidden sm:block" />
            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
              title="Sair"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 pt-12">
        {/* ── Greeting ── */}
        <header className="mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-lime-500 animate-pulse" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{greeting}, {profile?.full_name?.split(' ')[0]}!</span>
            </div>
            <h1 className="text-4xl font-black text-slate-900 leading-tight tracking-tight mb-2">
              Pronto para o <span className="text-lime-600">próximo passo?</span>
            </h1>
            <p className="text-slate-500 font-medium max-w-lg">
              Sua jornada para os Estados Unidos está em boas mãos. Acompanhe o progresso dos seus formulários abaixo.
            </p>
          </motion.div>
        </header>

        {/* ── Case Cards Grid ── */}
        {cases.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {cases.map((c, idx) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                whileHover={{ y: -4 }}
                className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-[0_10px_40px_rgba(0,0,0,0.02)] flex flex-col relative overflow-hidden group transition-all hover:shadow-[0_20px_50px_rgba(0,0,0,0.05)]"
              >
                {/* Background Decor */}
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-lime-500/5 rounded-full blur-3xl" />

                <div className="relative flex-1">
                  <div className="flex justify-between items-start mb-6">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 group-hover:bg-lime-50 group-hover:border-lime-100 transition-colors">
                      <FileText className="w-6 h-6 text-slate-400 group-hover:text-lime-600" />
                    </div>
                    <div className="px-3 py-1 bg-blue-50 border border-blue-100 text-blue-600 text-[10px] font-black uppercase tracking-widest rounded-full">
                      {c.status === 'pending_onboarding' ? 'Inicialização' : 'Processamento'}
                    </div>
                  </div>

                  <h2 className="text-2xl font-black text-slate-900 mb-2 truncate">
                    Formulário {c.case_type}
                  </h2>
                  <p className="text-sm font-medium text-slate-400 mb-8 capitalize">
                    {/* Status mapping to humanized text */}
                    {c.status === 'pending_onboarding' ? 'Aguardando revisão inicial' : 'Documentação em análise'}
                  </p>

                  {/* Progress Section */}
                  <div className="space-y-3 mb-8">
                    <div className="flex justify-between items-end">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Progresso de Documentos
                      </span>
                      <span className="text-lg font-black text-slate-900">
                        {c.progress}%
                      </span>
                    </div>
                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-50">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${c.progress}%` }}
                        transition={{ duration: 1, ease: 'easeOut', delay: 0.5 }}
                        className="h-full bg-lime-500 rounded-full shadow-[0_0_10px_rgba(132,204,22,0.3)]"
                      />
                    </div>
                    <div className="flex justify-between text-[10px] font-bold text-slate-400">
                      <span>{c.approvedCount} aprovados</span>
                      <span>{c.totalCount} total</span>
                    </div>
                  </div>
                </div>

                <Link
                  href={c.status === 'pending_onboarding' ? `/case/${c.id}/onboarding` : `/case/${c.id}/documents`}
                  className="w-full py-4 bg-slate-900 hover:bg-black text-white rounded-2xl flex items-center justify-center gap-3 transition-all group-hover:scale-[1.02] shadow-xl shadow-slate-900/10"
                >
                  <span className="font-black uppercase tracking-[0.15em] text-xs">Continuar Missão</span>
                  <ArrowRight size={16} strokeWidth={3} />
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 p-16 text-center"
          >
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-slate-300">
              <Rocket size={32} />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">Sua base está sendo preparada</h3>
            <p className="text-slate-500 font-medium max-w-sm mx-auto">
              Ainda não existem formulários ativos em sua conta. Entre em contato com nossa equipe se acreditar que isso é um erro.
            </p>
          </motion.div>
        )}

        {/* ── Help Support Section ── */}
        <footer className="mt-16 pt-12 border-t border-slate-200">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600">
                <TrendingUp size={24} />
              </div>
              <div>
                <h4 className="font-black text-slate-900 text-sm italic">"A liberdade favorece os audazes."</h4>
                <p className="text-xs text-slate-400 font-bold">Estamos aqui para garantir seu sucesso.</p>
              </div>
            </div>
            <button
              onClick={() => window.open('https://wa.me/5500000000000', '_blank')}
              className="px-6 py-3 bg-white border-2 border-slate-100 hover:border-lime-50 rounded-xl text-slate-600 hover:text-lime-600 font-black text-xs uppercase tracking-widest transition-all"
            >
              Falar com Consultor
            </button>
          </div>
        </footer>
      </main>
    </div>
  )
}

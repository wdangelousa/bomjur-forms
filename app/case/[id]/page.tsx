'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Rocket,
    ArrowRight,
    CheckCircle2,
    Clock,
    FileText,
    History,
    Sparkles,
    LayoutGrid,
    ChevronRight,
    TrendingUp
} from 'lucide-react'
import { COLORS } from '@/lib/design-system'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import NotificationBell from '@/components/notifications/NotificationBell'
import XPBar from '@/components/gamification/XPBar'
import ClientWaiverModal from '@/components/onboarding/ClientWaiverModal'

interface TimelineEvent {
    id: string
    type: 'upload' | 'approval' | 'rejection'
    timestamp: string
    doc_label: string
}

export default function ClientDashboard() {
    const { id: caseId } = useParams()
    const router = useRouter()
    const supabase = createClient()

    const [loading, setLoading] = useState(true)
    const [user, setUser] = useState<any>(null)
    const [caseData, setCaseData] = useState<any>(null)
    const [stats, setStats] = useState({ total: 0, approved: 0, pending: 0 })
    const [nextStep, setNextStep] = useState<any>(null)
    const [timeline, setTimeline] = useState<TimelineEvent[]>([])
    const [gamification, setGamification] = useState({ currentXP: 0, level: 1 })

    // State for Waiver
    const [showWaiver, setShowWaiver] = useState(false)

    const fetchDashboardData = async () => {
        try {
            // 0. Fetch User
            const { data: { user: u } } = await supabase.auth.getUser()
            setUser(u)

            if (u) {
                // Fetch Profile for Waiver Status
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('has_accepted_waiver')
                    .eq('id', u.id)
                    .single()

                if (profile && profile.has_accepted_waiver === false) {
                    setShowWaiver(true)
                }
            }

            // 1. Fetch Case & Client Info
            const { data: cData } = await supabase
                .from('cases')
                .select('*')
                .eq('id', caseId)
                .single()
            setCaseData(cData)

            // 1b. Fetch Gamification
            if (cData?.client_id) {
                const { data: gData } = await supabase
                    .from('gamification')
                    .select('current_xp, current_level')
                    .eq('user_id', cData.client_id)
                    .single()
                if (gData) {
                    setGamification({ currentXP: gData.current_xp, level: gData.current_level })
                }
            }

            // 2. Fetch Docs for Progress Calculation
            const { data: dData } = await supabase
                .from('case_documents')
                .select('*')
                .eq('case_id', caseId)

            const totalRequirements = 7 // Mocked for now based on I-485
            const approvedCount = dData?.filter(d => d.status === 'approved').length || 0
            const uploadedCount = dData?.filter(d => ['uploaded', 'under_review', 'approved'].includes(d.status)).length || 0

            setStats({
                total: totalRequirements,
                approved: approvedCount,
                pending: totalRequirements - uploadedCount
            })

            // 3. Generate Intelligent Next Step
            determineNextStep(dData || [])

            // 4. Generate Timeline
            const events: TimelineEvent[] = (dData || []).map(d => ({
                id: d.id,
                type: (d.status === 'approved' ? 'approval' : 'upload') as 'upload' | 'approval' | 'rejection',
                timestamp: d.reviewed_at || d.created_at,
                doc_label: d.category.replace('_', ' ')
            })).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 5)

            setTimeline(events)

        } catch (err) {
            console.error('Error fetching dashboard:', err)
        } finally {
            setLoading(false)
        }
    }

    const determineNextStep = (docs: any[]) => {
        const hasPassport = docs.find(d => d.category === 'passport' && d.status !== 'rejected')
        const hasBirthCert = docs.find(d => d.category === 'birth_certificate' && d.status !== 'rejected')

        if (!hasPassport) {
            setNextStep({
                title: 'Envie seu Passaporte',
                desc: 'Nossa IA precisa ler seus dados básicos para iniciar o preenchimento automático.',
                icon: <FileText className="w-5 h-5" />
            })
        } else if (!hasBirthCert) {
            setNextStep({
                title: 'Próximo: Certidão de Nascimento',
                desc: 'A IA já validou seu passaporte! Agora precisamos da sua certidão para comprovar filiação.',
                icon: <Sparkles className="w-5 h-5" />
            })
        } else {
            setNextStep({
                title: 'Continue o Checklist',
                desc: 'Você está no caminho certo! Complete os documentos restantes para enviarmos sua petição.',
                icon: <Rocket className="w-5 h-5" />
            })
        }
    }

    useEffect(() => {
        fetchDashboardData()

        // Realtime Subscription for automatic updates
        const channel = supabase
            .channel(`dashboard-${caseId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'case_documents', filter: `case_id=eq.${caseId}` },
                () => fetchDashboardData()
            )
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [caseId])

    if (loading) return <div className="min-h-screen bg-[#0A0E17] flex items-center justify-center"><div className="w-8 h-8 border-2 border-lime-500 border-t-transparent rounded-full animate-spin" /></div>

    const progress = (stats.approved / stats.total) * 100

    return (
        <div className="min-h-screen flex flex-col p-6 max-w-md mx-auto" style={{ background: COLORS.bg }}>
            {user && (
                <ClientWaiverModal
                    isOpen={showWaiver}
                    userId={user.id}
                    onAccept={() => setShowWaiver(false)}
                />
            )}
            <header className="py-6 flex flex-col gap-4">
                <div className="flex justify-between items-start w-full">
                    <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-lime-500">Olá, {caseData?.client_name?.split(' ')[0]}!</span>
                        <h1 className="text-2xl font-black text-white leading-tight">Bem-vindo ao seu <span className="text-lime-500">Dashboard</span></h1>
                    </div>
                    {user && <NotificationBell userId={user.id} />}
                </div>
                <div className="w-full">
                    <XPBar currentXP={gamification.currentXP} level={gamification.level} />
                </div>
            </header>

            {/* Case Summary Card */}
            <section className="relative p-6 rounded-[32px] overflow-hidden mb-8 group" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <TrendingUp className="w-24 h-24 text-lime-500" />
                </div>

                <div className="relative z-10 space-y-6">
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <span className="px-2 py-0.5 rounded-md bg-lime-500/10 text-lime-500 text-[9px] font-black uppercase tracking-widest border border-lime-500/20">
                                {caseData?.status || 'Em Progresso'}
                            </span>
                            <h2 className="text-sm font-bold text-dim">{caseData?.case_type}</h2>
                        </div>
                        <div className="text-right">
                            <span className="text-2xl font-black text-white">{Math.round(progress)}%</span>
                        </div>
                    </div>

                    <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
                        <motion.div
                            className="h-full bg-lime-500 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 1.5, ease: "easeOut" }}
                            style={{ boxShadow: `0 0 15px ${COLORS.lime}44` }}
                        />
                    </div>

                    <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-dim">
                        <span>{stats.approved} Aprovados</span>
                        <span>{stats.total} Requeridos</span>
                    </div>
                </div>
            </section>

            {/* Intelligent Suggestion */}
            <AnimatePresence mode="wait">
                {nextStep && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-5 rounded-3xl bg-purple-500/10 border border-purple-500/20 mb-8 flex gap-4 items-center relative overflow-hidden"
                    >
                        <div className="w-12 h-12 rounded-2xl bg-purple-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/30 shrink-0">
                            {nextStep.icon}
                        </div>
                        <div className="space-y-1 flex-1">
                            <h3 className="text-xs font-black text-purple-200 uppercase tracking-tighter">Sugestão da IA</h3>
                            <h4 className="text-sm font-bold text-white">{nextStep.title}</h4>
                            <p className="text-[11px] text-purple-200/60 font-medium leading-tight">{nextStep.desc}</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-purple-400" />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-4 mb-8">
                <Link
                    href={`/case/${caseId}/documents`}
                    className="p-6 rounded-[32px] bg-white text-black flex flex-col gap-4 shadow-xl active:scale-95 transition-all"
                >
                    <div className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center">
                        <FileText className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-black leading-tight">Enviar<br />Documentos</span>
                </Link>
                <button className="p-6 rounded-[32px] bg-white/5 border border-white/10 text-white flex flex-col gap-4 active:scale-95 transition-all">
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-dim">
                        <LayoutGrid className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-black leading-tight text-dim">Ver Meu<br />Progresso</span>
                </button>
            </div>

            {/* Timeline Area (Simplified) */}
            <section className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <History className="w-4 h-4 text-dim" />
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-dim">Atividade Recente</h3>
                </div>

                <div className="space-y-3">
                    {timeline.length > 0 ? timeline.map((event, idx) => (
                        <div key={idx} className="flex items-start gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${event.type === 'approval' ? 'bg-green-500/10 text-green-500' : 'bg-blue-500/10 text-blue-500'}`}>
                                {event.type === 'approval' ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                            </div>
                            <div className="space-y-0.5">
                                <p className="text-xs font-bold text-white leading-none">
                                    {event.type === 'approval' ? 'Documento Aprovado' : 'Documento Recebido'}
                                </p>
                                <p className="text-[10px] text-dim font-medium capitalize">
                                    {event.doc_label}
                                </p>
                            </div>
                            <div className="ml-auto">
                                <span className="text-[8px] font-black text-dim uppercase">Recentemente</span>
                            </div>
                        </div>
                    )) : (
                        <p className="text-xs text-dim text-center py-4 italic">Nenhuma atividade recente.</p>
                    )}
                </div>
            </section>
        </div>
    )
}

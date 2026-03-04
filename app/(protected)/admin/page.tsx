'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Users,
    Clock,
    CheckCircle2,
    Zap,
    TrendingUp,
    Filter,
    ArrowUpRight,
    Activity,
    Search
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import CasePipeline from '@/components/admin/CasePipeline'
import CreateCaseModal from '@/components/team/CreateCaseModal'
import { COLORS } from '@/lib/design-system'

export default function AdminDashboard() {
    const supabase = createClient()
    const [kpis, setKpis] = useState({
        activeCases: 0,
        awaitingReview: 0,
        approved7d: 0,
        aiSuccessRate: 94 // Mocked for now
    })
    const [recentActivity, setRecentActivity] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [modalOpen, setModalOpen] = useState(false)

    const fetchKPIs = async () => {
        try {
            // 1. Active Cases
            const { count: activeCount } = await supabase
                .from('cases')
                .select('*', { count: 'exact', head: true })
                .not('status', 'in', '("complete","archived")')

            // 2. Awaiting Review (documents)
            const { count: reviewCount } = await supabase
                .from('case_documents')
                .select('*', { count: 'exact', head: true })
                .in('status', ['uploaded', 'under_review'])

            // 3. Approved in last 7 days
            const sevenDaysAgo = new Date()
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
            const { count: approvedCount } = await supabase
                .from('case_documents')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'approved')
                .gt('reviewed_at', sevenDaysAgo.toISOString())

            setKpis(prev => ({
                ...prev,
                activeCases: activeCount || 0,
                awaitingReview: reviewCount || 0,
                approved7d: approvedCount || 0
            }))

            // 4. Recent Activity
            const { data: activity } = await supabase
                .from('case_documents')
                .select('*, cases(client_name)')
                .order('updated_at', { ascending: false })
                .limit(5)

            setRecentActivity(activity || [])

        } catch (err) {
            console.error('Error fetching Admin KPIs:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchKPIs()

        // Subscribe to changes for live KPIs
        const channel = supabase.channel('admin-kpis')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'cases' }, () => fetchKPIs())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'case_documents' }, () => fetchKPIs())
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [])

    return (
        <div className="min-h-screen p-8 space-y-10" style={{ background: COLORS.bg }}>
            {/* Top Navigation / Title */}
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight">Admin <span className="text-lime-500">Center</span></h1>
                    <p className="text-xs text-dim font-bold uppercase tracking-widest mt-1">Visão Geral para Walter D'Angelo</p>
                </div>
                <div className="flex gap-3">
                    <button className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2">
                        <Filter className="w-4 h-4" /> Filtros
                    </button>
                    <button
                        onClick={() => setModalOpen(true)}
                        className="px-5 py-2.5 rounded-xl bg-lime-500 text-black text-xs font-black uppercase tracking-widest hover:bg-lime-400 transition-all shadow-lg shadow-lime-500/20 active:scale-95 transition-transform"
                    >
                        Novo Caso +
                    </button>
                </div>
            </header>

            {/* KPI Cards */}
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KPICard
                    title="Casos Ativos"
                    value={kpis.activeCases}
                    icon={<Users className="w-5 h-5" />}
                    trend="+12%"
                    color="#84CC16"
                />
                <KPICard
                    title="Aguardando Revisão"
                    value={kpis.awaitingReview}
                    icon={<Clock className="w-5 h-5 text-amber-500" />}
                    trend="-5%"
                    color="#F59E0B"
                />
                <KPICard
                    title="Aprovados (7d)"
                    value={kpis.approved7d}
                    icon={<CheckCircle2 className="w-5 h-5 text-lime-500" />}
                    trend="+24%"
                    color="#10B981"
                />
                <KPICard
                    title="Taxa de Sucesso IA"
                    value={`${kpis.aiSuccessRate}%`}
                    icon={<Zap className="w-5 h-5 text-purple-500" />}
                    trend="+1.2%"
                    color="#A855F7"
                />
            </section>

            {/* Pipeline / Kanban */}
            <section className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black text-white flex items-center gap-3">
                        <TrendingUp className="w-6 h-6 text-lime-500" />
                        Fluxo de Casos
                    </h2>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-lime-500 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-dim">Sincronizado ao Vivo</span>
                    </div>
                </div>
                <CasePipeline />
            </section>

            {/* Recent Activity Mini-List */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 p-6 rounded-[32px] bg-[#111827] border border-white/5">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                            <Activity className="w-4 h-4 text-dim" />
                            Atividade Recente
                        </h3>
                        <ArrowUpRight className="w-4 h-4 text-dim" />
                    </div>
                    <div className="space-y-4">
                        {recentActivity.map((act) => (
                            <div key={act.id} className="flex gap-4 items-start p-3 rounded-2xl hover:bg-white/[0.02] transition-all">
                                <div className={`mt-1 p-2 rounded-lg bg-white/5 ${act.status === 'approved' ? 'text-lime-500' : 'text-blue-500'}`}>
                                    {act.status === 'approved' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[11px] font-black text-white truncate">{act.cases?.client_name}</p>
                                    <p className="text-[10px] text-dim">{act.category} • {act.status}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="lg:col-span-2 p-6 rounded-[32px] bg-[#111827] border border-white/5 flex items-center justify-center text-dim text-[10px] font-bold uppercase tracking-widest">
                    Espaço para Gráfico de Produtividade (Sprint Futura)
                </div>
            </section>

            <CreateCaseModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onSuccess={() => {
                    setModalOpen(false)
                    fetchKPIs()
                }}
            />
        </div>
    )
}

function KPICard({ title, value, icon, trend, color }: any) {
    return (
        <motion.div
            whileHover={{ y: -5 }}
            className="p-6 rounded-[32px] bg-[#111827] border border-white/5 relative overflow-hidden group"
        >
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                {icon}
            </div>
            <div className="space-y-4 relative z-10">
                <div className="p-3 w-fit rounded-2xl bg-white/5 text-white/50 group-hover:text-white transition-colors">
                    {icon}
                </div>
                <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-dim">{title}</span>
                    <div className="flex items-baseline gap-3">
                        <h3 className="text-3xl font-black text-white">{value}</h3>
                        <span className="text-[10px] font-bold text-lime-500">{trend}</span>
                    </div>
                </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: color, opacity: 0.3 }} />
        </motion.div>
    )
}

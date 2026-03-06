'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    Users,
    CheckCircle2,
    TrendingUp,
    Filter,
    Building2,
    Activity,
    Plus,
    Calendar,
    FolderOpen,
    Mail
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { COLORS } from '@/lib/design-system'
import CreateCaseModal from '@/components/team/CreateCaseModal'

export default function AdminDashboard() {
    const supabase = createClient()
    const [kpis, setKpis] = useState({
        totalCases: 0,
        totalAgencies: 0,
        finishedCases: 0,
    })
    const [agencies, setAgencies] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [modalOpen, setModalOpen] = useState(false)

    const fetchDashboardData = async () => {
        try {
            setLoading(true)

            // 1. Total Agencies
            const { data: tenantsData, count: tenantsCount } = await supabase
                .from('tenants')
                .select('*', { count: 'exact' })

            // 2. All Cases to calculate metrics and map to agencies
            const { data: casesData } = await supabase
                .from('cases')
                .select('*')

            const totalAgencies = tenantsCount || 0

            let totalCases = 0
            let finishedCases = 0

            const agencyMap = new Map()

            if (tenantsData) {
                tenantsData.forEach(t => {
                    agencyMap.set(t.id, {
                        ...t,
                        activeClients: 0,
                        completedCases: 0
                    })
                })
            }

            if (casesData) {
                totalCases = casesData.length
                finishedCases = casesData.filter(c => c.status === 'complete').length

                casesData.forEach(c => {
                    if (c.tenant_id && agencyMap.has(c.tenant_id)) {
                        const agency = agencyMap.get(c.tenant_id)
                        agency.activeClients += 1
                        if (c.status === 'complete') {
                            agency.completedCases += 1
                        }
                    }
                })
            }

            setKpis({
                totalCases,
                totalAgencies,
                finishedCases
            })

            // Convert to array and sort by active clients
            const agenciesList = Array.from(agencyMap.values()).sort((a, b) => b.activeClients - a.activeClients)
            setAgencies(agenciesList)

        } catch (err) {
            console.error('Error fetching Admin Dashboard Data:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchDashboardData()

        // Realtime Subscription
        const channel = supabase.channel('admin-dashboard')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'cases' }, () => fetchDashboardData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tenants' }, () => fetchDashboardData())
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [])

    return (
        <div suppressHydrationWarning className="min-h-screen p-4 lg:p-8 bg-slate-50 text-slate-900 font-sans">
            <div className="max-w-6xl mx-auto space-y-10">
                {/* Header */}
                <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Painel de <span className="text-sky-500">Controle</span></h1>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Visão Global da Plataforma</p>
                    </div>
                    <div className="flex gap-3">
                        <button className="px-5 py-3 rounded-2xl bg-white border border-slate-200 text-slate-600 text-xs font-black uppercase tracking-widest hover:bg-slate-50 hover:border-slate-300 shadow-sm transition-all flex items-center gap-2">
                            <Filter className="w-4 h-4" /> Filtros
                        </button>
                        <button
                            onClick={() => setModalOpen(true)}
                            className="px-6 py-3 rounded-2xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-900/10 flex items-center gap-2 active:scale-95"
                        >
                            <Plus className="w-4 h-4" /> Registrar Processo Interno
                        </button>
                    </div>
                </header>

                {/* KPI Cards */}
                <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <KPICard
                        title="Total de Processos"
                        value={kpis.totalCases}
                        icon={<FolderOpen className="w-5 h-5 text-sky-500" />}
                        trend="Crescente"
                        color="#0ea5e9"
                        bgColor="bg-sky-50"
                    />
                    <KPICard
                        title="Agências Ativas"
                        value={kpis.totalAgencies}
                        icon={<Building2 className="w-5 h-5 text-purple-500" />}
                        trend="Estável"
                        color="#a855f7"
                        bgColor="bg-purple-50"
                    />
                    <KPICard
                        title="Processos Finalizados"
                        value={kpis.finishedCases}
                        icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                        trend="Positivo"
                        color="#10b981"
                        bgColor="bg-emerald-50"
                    />
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Active Agencies Component */}
                    <section className="lg:col-span-2 space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
                                <Building2 className="w-6 h-6 text-sky-500" />
                                Agências Desdobradas
                            </h2>
                        </div>

                        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                            {loading ? (
                                <div className="p-12 flex justify-center">
                                    <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : agencies.length === 0 ? (
                                <div className="p-12 text-center text-slate-400">
                                    <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                    <p className="font-bold">Nenhuma agência encontrada</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {agencies.map((agency, idx) => (
                                        <div key={agency.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-xl font-black text-slate-400 group-hover:bg-sky-100 group-hover:text-sky-500 transition-colors">
                                                    {agency.name ? agency.name.charAt(0).toUpperCase() : 'A'}
                                                </div>
                                                <div>
                                                    <h3 className="font-black text-slate-900">{agency.name || 'Agência Desconhecida'}</h3>
                                                    <div className="flex items-center gap-3 mt-1 text-[10px] uppercase font-bold text-slate-400 tracking-widest">
                                                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Adesão: {new Date(agency.created_at).toLocaleDateString('pt-BR')}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-2xl font-black text-slate-900">{agency.activeClients}</div>
                                                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Clientes Ativos</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Quick System Health */}
                    <section className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
                                <Activity className="w-6 h-6 text-emerald-500" />
                                Saúde do Sistema
                            </h2>
                        </div>
                        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6 space-y-6">
                            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-4">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 animate-pulse shrink-0" />
                                <div>
                                    <h4 className="text-xs font-black text-emerald-800 uppercase tracking-widest">Servidor Operacional</h4>
                                    <p className="text-xs text-emerald-600 mt-1 font-medium">Todos os microserviços estão online. Latência média: 45ms.</p>
                                </div>
                            </div>

                            <div>
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Modelos de IA</h4>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-sm font-bold text-slate-700">
                                        <span>Extração OCR (Claude 3.5)</span>
                                        <span className="text-emerald-500">100% Ups</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm font-bold text-slate-700">
                                        <span>Geração de Resumos</span>
                                        <span className="text-emerald-500">100% Ups</span>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-6 border-t border-slate-100">
                                <button className="w-full py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 font-black text-[10px] uppercase tracking-widest rounded-xl transition-colors border border-slate-200">
                                    Ver Logs Completos
                                </button>
                            </div>
                        </div>
                    </section>
                </div>
            </div>

            <CreateCaseModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onSuccess={() => {
                    setModalOpen(false)
                    fetchDashboardData()
                }}
            />
        </div>
    )
}

function KPICard({ title, value, icon, trend, color, bgColor }: any) {
    return (
        <motion.div
            whileHover={{ y: -4 }}
            className={`p-6 rounded-[2rem] bg-white border border-slate-200 shadow-sm relative overflow-hidden group transition-shadow hover:shadow-md`}
        >
            <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-20 blur-xl transition-opacity group-hover:opacity-40" style={{ background: color }} />

            <div className="space-y-6 relative z-10">
                <div className={`p-3 w-fit rounded-2xl ${bgColor} text-slate-700`}>
                    {icon}
                </div>
                <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</span>
                    <div className="flex items-baseline gap-3 mt-1">
                        <h3 className="text-4xl font-black text-slate-900 tracking-tight">{value}</h3>
                    </div>
                </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 h-1 opacity-20" style={{ background: color }} />
        </motion.div>
    )
}

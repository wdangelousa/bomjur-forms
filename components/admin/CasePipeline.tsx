'use client'

import React, { useState, useEffect } from 'react'
import { motion, Reorder, useDragControls } from 'framer-motion'
import {
    ChevronRight,
    FileText,
    AlertCircle,
    CheckCircle2,
    Clock,
    User,
    ArrowRight
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { COLORS } from '@/lib/design-system'
import { CaseStatus } from '@/types'

const COLUMNS: { id: CaseStatus; label: string; color: string }[] = [
    { id: 'pending_onboarding', label: 'Novo', color: '#6366F1' },
    { id: 'in_progress', label: 'Onboarding', color: '#A855F7' },
    { id: 'documents_pending', label: 'Docs Pendentes', color: '#F59E0B' },
    { id: 'in_review', label: 'Em Revisão', color: '#84CC16' },
    { id: 'ready_for_filing', label: 'Pronto p/ Protocolo', color: '#10B981' }
]

export default function CasePipeline() {
    const supabase = createClient()
    const [cases, setCases] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const fetchCases = async () => {
        try {
            const { data, error } = await supabase
                .from('cases')
                .select(`
                    *,
                    case_documents (status)
                `)
                .not('status', 'in', '("complete","archived")')
                .order('updated_at', { ascending: false })

            if (error) throw error
            setCases(data || [])
        } catch (err) {
            console.error('Error fetching pipeline cases:', err)
        } finally {
            setLoading(false)
        }
    }

    const updateCaseStatus = async (caseId: string, newStatus: CaseStatus) => {
        const { error } = await supabase
            .from('cases')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', caseId)

        if (!error) {
            setCases(prev => prev.map(c => c.id === caseId ? { ...c, status: newStatus } : c))
        }
    }

    useEffect(() => {
        fetchCases()

        const channel = supabase.channel('pipeline-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'cases' }, () => fetchCases())
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [])

    if (loading) return <div className="grid grid-cols-5 gap-4 opacity-50"><div className="h-64 bg-white/5 rounded-[32px] animate-pulse" /><div className="h-64 bg-white/5 rounded-[32px] animate-pulse" /><div className="h-64 bg-white/5 rounded-[32px] animate-pulse" /><div className="h-64 bg-white/5 rounded-[32px] animate-pulse" /><div className="h-64 bg-white/5 rounded-[32px] animate-pulse" /></div>

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 items-start overflow-x-auto pb-8 scrollbar-hide">
            {COLUMNS.map((col) => (
                <div key={col.id} className="space-y-4 min-w-[200px]">
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: col.color }} />
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-dim">{col.label}</h3>
                        </div>
                        <span className="text-[10px] font-bold text-white/20 bg-white/5 px-2 py-0.5 rounded-lg">
                            {cases.filter(c => c.status === col.id).length}
                        </span>
                    </div>

                    <div className="space-y-3 min-h-[500px] p-2 rounded-[32px] bg-white/[0.02] border border-white/5">
                        {cases.filter(c => c.status === col.id).map((caseItem) => (
                            <CaseCard
                                key={caseItem.id}
                                caseItem={caseItem}
                                onMove={(status) => updateCaseStatus(caseItem.id, status)}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}

function CaseCard({ caseItem, onMove }: { caseItem: any, onMove: (status: CaseStatus) => void }) {
    const docs = caseItem.case_documents || []
    const approved = docs.filter((d: any) => d.status === 'approved').length
    const total = 7 // Mocked expected total
    const progress = Math.round((approved / total) * 100)

    const nextStatusMap: Record<CaseStatus, CaseStatus | null> = {
        'pending_onboarding': 'in_progress',
        'in_progress': 'documents_pending',
        'documents_pending': 'in_review',
        'in_review': 'ready_for_filing',
        'ready_for_filing': null,
        'complete': null,
        'archived': null
    }

    const nextStatus = nextStatusMap[caseItem.status as CaseStatus]

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.02 }}
            className="p-5 rounded-3xl bg-[#0D1117] border border-white/5 shadow-xl group relative overflow-hidden"
        >
            <div className="space-y-4">
                <div className="flex justify-between items-start">
                    <div className="space-y-0.5">
                        <h4 className="text-[11px] font-black text-white leading-tight group-hover:text-lime-500 transition-colors uppercase truncate max-w-[120px]">
                            {caseItem.client_name}
                        </h4>
                        <p className="text-[9px] font-bold text-dim tracking-tighter">{caseItem.case_type}</p>
                    </div>
                    <div className="p-1.5 rounded-lg bg-white/5 text-dim">
                        <User className="w-3.5 h-3.5" />
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between items-center text-[8px] font-black text-dim uppercase tracking-widest">
                        <span>Progresso</span>
                        <span className="text-white">{progress}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-lime-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                <div className="pt-2 flex justify-between items-center">
                    <button className="text-[9px] font-bold text-dim hover:text-white flex items-center gap-1 transition-colors">
                        <AlertCircle className="w-3 h-3" /> Detalhes
                    </button>
                    {nextStatus && (
                        <button
                            onClick={() => onMove(nextStatus)}
                            className="text-[9px] font-black text-lime-500 flex items-center gap-1 hover:gap-2 transition-all"
                        >
                            Mover <ArrowRight className="w-3 h-3" />
                        </button>
                    )}
                </div>
            </div>
            {caseItem.priority === 1 && (
                <div className="absolute top-0 right-0 w-8 h-8 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-lg shadow-amber-500/50" />
                </div>
            )}
        </motion.div>
    )
}

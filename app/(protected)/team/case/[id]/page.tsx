'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { calculateCategoryProgress } from '@/lib/cases/case-helpers'
import type { CaseDocument, ClientDocument, Case } from '@/types'
import {
    FileText,
    ArrowLeft,
    Download,
    Printer,
    CheckCircle2,
    Clock,
    AlertCircle,
    User,
    Users,
    ChevronDown,
    ChevronUp,
    Lock
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function TeamCaseDetailPage() {
    const { id: caseId } = useParams()
    const router = useRouter()
    const supabase = createClient()

    const [loading, setLoading] = useState(true)
    const [caseData, setCaseData] = useState<any>(null)
    const [caseDocuments, setCaseDocuments] = useState<CaseDocument[]>([])
    const [clientFiles, setClientFiles] = useState<ClientDocument[]>([])
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})

    const fetchCaseData = useCallback(async () => {
        try {
            // Fetch case and client data
            const { data: cData } = await supabase
                .from('cases')
                .select('*, user_profiles!client_id(full_name, email)')
                .eq('id', caseId)
                .single()
            setCaseData(cData)

            // Fetch categories (case_documents)
            const { data: catData } = await supabase
                .from('case_documents')
                .select('*')
                .eq('case_id', caseId)
                .order('category', { ascending: true })

            if (catData) {
                setCaseDocuments(catData as CaseDocument[])
            }

            // Fetch actual files (client_documents)
            const { data: filesData } = await supabase
                .from('client_documents')
                .select('*')
                .eq('case_id', caseId)
                .order('created_at', { ascending: false })

            if (filesData) {
                setClientFiles(filesData as ClientDocument[])
            }
        } catch (error) {
            console.error('Error fetching case details:', error)
        } finally {
            setLoading(false)
        }
    }, [caseId, supabase])

    useEffect(() => {
        if (caseId) {
            fetchCaseData()

            // Realtime Sync
            const channel = supabase.channel(`case-detail-${caseId}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'case_documents', filter: `case_id=eq.${caseId}` }, () => fetchCaseData())
                .on('postgres_changes', { event: '*', schema: 'public', table: 'client_documents', filter: `case_id=eq.${caseId}` }, () => fetchCaseData())
                .subscribe()

            return () => { supabase.removeChannel(channel) }
        }
    }, [caseId, fetchCaseData, supabase])

    const toggleCategory = (category: string) => {
        setExpandedCategories(prev => ({
            ...prev,
            [category]: !prev[category]
        }))
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    if (!caseData) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
                <FileText className="w-16 h-16 text-slate-300 mb-4" />
                <h1 className="text-xl font-bold text-slate-700">Caso não encontrado</h1>
                <button onClick={() => router.back()} className="mt-4 text-sky-500 font-medium hover:underline">
                    Voltar para a lista
                </button>
            </div>
        )
    }

    const progress = calculateCategoryProgress(caseDocuments)

    const getRelationshipBadge = (relationship: string) => {
        const styles: Record<string, string> = {
            'Requerente Principal': 'bg-sky-100 text-sky-700 border-sky-200',
            'Cônjuge': 'bg-purple-100 text-purple-700 border-purple-200',
            'Filho(a)': 'bg-amber-100 text-amber-700 border-amber-200',
            'Outro': 'bg-slate-100 text-slate-600 border-slate-200'
        }
        return styles[relationship] || styles['Outro']
    }

    return (
        <div className="min-h-screen bg-slate-50 p-4 lg:p-12 font-sans">
            <div className="max-w-5xl mx-auto space-y-10">

                {/* Breadcrumb & Simple Back */}
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-slate-400 hover:text-slate-600 font-bold text-[10px] uppercase tracking-widest transition-colors mb-4 group"
                >
                    <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                    Voltar ao Pipeline
                </button>

                {/* Header Section */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-10 border-b border-slate-200">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className="px-3 py-1 bg-sky-500 text-white text-[10px] font-black rounded-lg uppercase tracking-widest">
                                {caseData.case_type}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID: {caseData.id.slice(0, 8)}</span>
                        </div>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-none">
                            {caseData.user_profiles?.full_name || 'Protocolo Sem Nome'}
                        </h1>
                        <p className="text-slate-500 font-medium mt-3 flex items-center gap-2">
                            <User size={16} className="text-slate-300" />
                            {caseData.user_profiles?.email}
                        </p>
                    </div>

                    <div className="w-full md:w-64 space-y-3">
                        <div className="flex justify-between items-end">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Progresso do Formulário</span>
                            <span className="text-xl font-black text-sky-500">{progress.percentage}%</span>
                        </div>
                        <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${progress.percentage}%` }}
                                className="h-full bg-sky-500"
                            />
                        </div>
                        <p className="text-[9px] font-bold text-slate-400 text-right uppercase tracking-wider">
                            {progress.approved} de {progress.total} categorias finalizadas
                        </p>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    {/* Main Document List */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
                                <FileText className="text-sky-500" />
                                Documentação Coletada
                            </h2>
                        </div>

                        <div className="space-y-4">
                            {caseDocuments.length === 0 ? (
                                <div className="text-center py-20 bg-white rounded-[2.5rem] border border-dashed border-slate-200">
                                    <FileText size={48} className="mx-auto text-slate-200 mb-4" />
                                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Aguardando início do cliente</p>
                                </div>
                            ) : (
                                caseDocuments.map((cat) => {
                                    const filesInCategory = clientFiles.filter(f => f.category === cat.category)
                                    const isExpanded = expandedCategories[cat.category]
                                    const isApproved = cat.status === 'approved'

                                    return (
                                        <div
                                            key={cat.id}
                                            className={`bg-white rounded-[2rem] border transition-all overflow-hidden ${isApproved ? 'border-emerald-100 bg-emerald-50/10' : 'border-slate-200 hover:border-slate-300'
                                                }`}
                                        >
                                            {/* Category Header */}
                                            <div
                                                onClick={() => toggleCategory(cat.category)}
                                                className="p-6 flex items-center justify-between cursor-pointer group"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isApproved ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'
                                                        }`}>
                                                        {isApproved ? <CheckCircle2 size={20} /> : <FileText size={20} />}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-black text-slate-900 uppercase tracking-tight text-sm">
                                                            {cat.category.replace(/_/g, ' ')}
                                                        </h3>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${isApproved ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-100 text-slate-400'
                                                                }`}>
                                                                {isApproved ? 'Finalizado' : filesInCategory.length > 0 ? 'Em Revisão' : 'Pendente'}
                                                            </span>
                                                            <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest truncate max-w-[150px]">
                                                                • {filesInCategory.length} {filesInCategory.length === 1 ? 'arquivo' : 'arquivos'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {isApproved && <Lock size={14} className="text-emerald-400" />}
                                                    {isExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                                                </div>
                                            </div>

                                            {/* Files List */}
                                            <AnimatePresence>
                                                {isExpanded && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        className="px-6 pb-6"
                                                    >
                                                        <div className="pt-4 border-t border-slate-100 space-y-3">
                                                            {filesInCategory.length === 0 ? (
                                                                <p className="text-center py-6 text-slate-400 text-xs font-bold uppercase tracking-widest">Nenhum arquivo enviado</p>
                                                            ) : (
                                                                filesInCategory.map((file) => (
                                                                    <div key={file.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-2xl group/file">
                                                                        <div className="flex items-center gap-3 min-w-0">
                                                                            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center border border-slate-200 text-slate-400 group-hover/file:text-sky-500 group-hover/file:border-sky-200 transition-colors">
                                                                                <FileText size={16} />
                                                                            </div>
                                                                            <div className="min-w-0">
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className="text-xs font-bold text-slate-700 truncate">{file.file_name}</span>
                                                                                    {file.metadata?.relationship && (
                                                                                        <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${getRelationshipBadge(file.metadata.relationship)}`}>
                                                                                            {file.metadata.relationship}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                <p className="text-[9px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">
                                                                                    {new Date(file.created_at).toLocaleDateString('pt-BR')}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <a
                                                                                href={file.file_url}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="p-2 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-sky-500 hover:border-sky-200 transition-all shadow-sm active:scale-90"
                                                                            >
                                                                                <Download size={14} />
                                                                            </a>
                                                                        </div>
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>

                    {/* Sidebar Actions */}
                    <div className="space-y-6">
                        <section className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-slate-900/20">
                            <h3 className="text-xl font-black tracking-tight mb-4 flex items-center gap-3">
                                <Printer size={20} className="text-sky-400" />
                                Ações do Caso
                            </h3>
                            <div className="space-y-3">
                                <button className="w-full flex items-center justify-between p-4 bg-white/10 hover:bg-white/20 rounded-2xl transition-all group active:scale-95">
                                    <span className="text-xs font-black uppercase tracking-widest">Print Order PDF</span>
                                    <Download size={18} className="group-hover:translate-y-0.5 transition-transform" />
                                </button>
                                <button className="w-full flex items-center justify-between p-4 bg-white/10 hover:bg-white/20 rounded-2xl transition-all group active:scale-95">
                                    <span className="text-xs font-black uppercase tracking-widest">Enviar p/ Esteira</span>
                                    <Printer size={18} />
                                </button>
                            </div>
                        </section>

                        <section className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-3">
                                <Users size={16} className="text-sky-500" />
                                Membros da Família
                            </h3>
                            <div className="space-y-4">
                                {Array.from(new Set(clientFiles.map(f => f.metadata?.relationship).filter(Boolean))).map(rel => (
                                    <div key={rel as string} className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${rel === 'Requerente Principal' ? 'bg-sky-500' : 'bg-purple-400'
                                            }`} />
                                        <span className="text-xs font-bold text-slate-600">{rel as string}</span>
                                    </div>
                                ))}
                                {clientFiles.length === 0 && <p className="text-slate-400 text-xs font-medium italic">Nenhum dado extraído</p>}
                            </div>
                        </section>
                    </div>
                </div>

                {/* Footer Signature */}
                <footer className="pt-20 pb-10 flex flex-col md:flex-row items-center justify-between gap-6 opacity-40 hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Agency Operations Platform</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Powered by</span>
                        <img src="/bomjur-logo.png" alt="Bomjur" className="h-5 w-auto grayscale" />
                    </div>
                </footer>
            </div>
        </div>
    )
}

'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
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
    FileCheck,
    Loader2,
    Search,
    ExternalLink
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getCaseStatusLabel } from '@/lib/cases/case-helpers'
import type { ClientDocument, Profile, Case } from '@/types'

// ============================================================
// AGENCY DASHBOARD - CLIENT DETAIL VIEW
// ============================================================

export default function AgencyClientDetailPage() {
    const { id: clientId } = useParams()
    const router = useRouter()
    const supabase = createClient()

    // ── States ──
    const [loading, setLoading] = useState(true)
    const [profile, setProfile] = useState<Profile | null>(null)
    const [cases, setCases] = useState<Case[]>([])
    const [documents, setDocuments] = useState<any[]>([])
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})
    const [generatingPDF, setGeneratingPDF] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')

    // ── Fetch Data ──
    const fetchData = async () => {
        setLoading(true)
        try {
            // 1. Fetch Profile
            const { data: profData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', clientId)
                .single()

            if (profData) setProfile(profData)

            // 2. Fetch Cases
            const { data: caseData } = await supabase
                .from('cases')
                .select('*')
                .eq('client_id', clientId)
                .order('created_at', { ascending: false })

            if (caseData) setCases(caseData)

            // 3. Fetch All Client Documents
            const { data: docData } = await supabase
                .from('client_documents')
                .select('*')
                .or(`client_id.eq.${clientId},uploaded_by.eq.${clientId}`)
                .order('created_at', { ascending: false })

            if (docData) setDocuments(docData)

        } catch (err) {
            console.error('Error fetching dashboard data:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (clientId) fetchData()
    }, [clientId])

    // ── Smart Identity Logic ──
    const clientIdentity = useMemo(() => {
        // Try to find Passport
        const passport = documents.find(d =>
            d.document_type?.toLowerCase() === 'passport' ||
            d.metadata?.category?.toLowerCase() === 'passport'
        )

        if (passport) {
            // Priority 1: Metadata FullName
            const metaName = passport.metadata?.full_name || passport.metadata?.FullName
            if (metaName) return metaName

            // Priority 2: Raw Extraction
            const rawName = passport.raw_extraction_json?.FullName ||
                passport.raw_extraction_json?.full_name ||
                (passport.raw_extraction_json?.GivenName && passport.raw_extraction_json?.Surname
                    ? `${passport.raw_extraction_json.GivenName} ${passport.raw_extraction_json.Surname}`
                    : null)
            if (rawName) return rawName
        }

        // Fallback: Profile Name
        return profile?.full_name || 'Protocolo Sem Nome'
    }, [documents, profile])

    // ── Document Grouping ──
    const groupedDocuments = useMemo(() => {
        const groups: Record<string, any[]> = {}

        documents.forEach(doc => {
            const category = doc.document_type || doc.metadata?.category || 'GERAL'
            const upperCat = category.toUpperCase()
            if (!groups[upperCat]) groups[upperCat] = []
            groups[upperCat].push(doc)
        })

        return groups
    }, [documents])

    // ── Handlers ──
    const handleGeneratePDF = async () => {
        const activeCase = cases[0] // Assume o caso mais recente
        if (!activeCase) {
            alert('Nenhum caso ativo encontrado para este cliente.')
            return
        }

        setGeneratingPDF(true)
        try {
            const res = await fetch(`/api/cases/${activeCase.id}/generate-pdf`, {
                method: 'POST'
            })

            const data = await res.json()
            if (data.success && data.downloadUrl) {
                window.open(data.downloadUrl, '_blank')
            } else {
                throw new Error(data.error || 'Erro desconhecido ao gerar PDF')
            }
        } catch (err: any) {
            alert(`Falha na geração: ${err.message}`)
        } finally {
            setGeneratingPDF(false)
        }
    }

    const toggleCategory = (cat: string) => {
        setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }))
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-10 h-10 text-sky-500 animate-spin" />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Sincronizando Dossiê...</p>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
            {/* Header / Nav */}
            <header className="bg-white/80 backdrop-blur-xl sticky top-0 z-50 border-b border-slate-200 px-6 py-4">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-slate-400 hover:text-slate-600 font-bold text-[10px] uppercase tracking-widest transition-colors group"
                    >
                        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                        Voltar ao Pipeline
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                            <FileCheck size={12} />
                            Modo Auditoria
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-6 pt-12">
                {/* Profile Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 mb-12">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="px-2 py-0.5 bg-sky-500 text-white text-[9px] font-black rounded uppercase tracking-widest">
                                CLIENTE ID: {clientId?.toString().slice(0, 8)}
                            </span>
                            {cases[0] && (
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    • {cases[0].case_type} em andamento
                                </span>
                            )}
                        </div>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-none truncate">
                            {clientIdentity}
                        </h1>
                        <p className="text-slate-500 font-medium mt-3 flex items-center gap-2">
                            <User size={16} className="text-slate-300" />
                            {profile?.email || 'Sem email cadastrado'}
                        </p>
                    </div>

                    <div className="flex gap-4 w-full md:w-auto">
                        <button
                            onClick={handleGeneratePDF}
                            disabled={generatingPDF}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-sky-600 transition-all shadow-xl active:scale-95 disabled:opacity-50"
                        >
                            {generatingPDF ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <Printer size={16} />
                            )}
                            Gerar PDF Oficial (I-485)
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                    {/* Document List */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
                                <FileText className="text-sky-500" />
                                Cofre de Documentos
                            </h2>
                            <div className="relative group">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-sky-500" />
                                <input
                                    type="text"
                                    placeholder="Filtrar arquivos..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-sky-500/20 outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            {Object.keys(groupedDocuments).length === 0 ? (
                                <div className="text-center py-20 bg-white rounded-[2.5rem] border border-dashed border-slate-200">
                                    <FileText size={48} className="mx-auto text-slate-200 mb-4" />
                                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Nenhum documento encontrado</p>
                                </div>
                            ) : (
                                Object.entries(groupedDocuments).map(([category, docs]) => {
                                    const isExpanded = expandedCategories[category] ?? true
                                    const filteredDocs = docs.filter(d =>
                                        d.file_name?.toLowerCase().includes(searchQuery.toLowerCase())
                                    )

                                    if (searchQuery && filteredDocs.length === 0) return null

                                    return (
                                        <div key={category} className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                            {/* Category Header */}
                                            <div
                                                onClick={() => toggleCategory(category)}
                                                className="p-6 flex items-center justify-between cursor-pointer group hover:bg-slate-50 transition-colors"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-sky-100 group-hover:text-sky-600 transition-colors">
                                                        <FileText size={20} />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-black text-slate-900 uppercase tracking-tight text-sm">{category.replace(/_/g, ' ')}</h3>
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                                            {docs.length} {docs.length === 1 ? 'Arquivo' : 'Arquivos'}
                                                        </span>
                                                    </div>
                                                </div>
                                                {isExpanded ? <ChevronUp className="text-slate-400" /> : <ChevronDown className="text-slate-400" />}
                                            </div>

                                            {/* Files List */}
                                            <AnimatePresence>
                                                {isExpanded && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        className="px-6 pb-6 overflow-hidden"
                                                    >
                                                        <div className="pt-4 border-t border-slate-100 space-y-3">
                                                            {filteredDocs.map((doc) => {
                                                                const isVerified = ['approved', 'confirmed', 'verified', 'concluido', 'confirmado'].includes((doc.status || '').toLowerCase())

                                                                return (
                                                                    <div key={doc.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-2xl group/file">
                                                                        <div className="flex items-center gap-3 min-w-0">
                                                                            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center border border-slate-200 text-slate-400 group-hover/file:text-sky-500 transition-colors">
                                                                                <Download size={14} />
                                                                            </div>
                                                                            <div className="min-w-0">
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className="text-xs font-bold text-slate-700 truncate">{doc.file_name}</span>
                                                                                    {doc.metadata?.relationship && (
                                                                                        <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-slate-200 bg-white text-slate-400">
                                                                                            {doc.metadata.relationship}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                <div className="flex items-center gap-2 mt-0.5">
                                                                                    {isVerified ? (
                                                                                        <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                                                                                            <CheckCircle2 size={10} /> Verificado
                                                                                        </span>
                                                                                    ) : (
                                                                                        <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest flex items-center gap-1">
                                                                                            <Clock size={10} /> Em Análise
                                                                                        </span>
                                                                                    )}
                                                                                    <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">
                                                                                        • {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        <div className="flex items-center gap-2">
                                                                            <a
                                                                                href={doc.file_url}
                                                                                target="_blank"
                                                                                className="p-2 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-sky-500 hover:shadow-sm transition-all"
                                                                            >
                                                                                <ExternalLink size={14} />
                                                                            </a>
                                                                        </div>
                                                                    </div>
                                                                )
                                                            })}
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

                    {/* Sidebar Stats */}
                    <div className="space-y-8">
                        <section className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl">
                            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-sky-400 mb-6 flex items-center gap-2">
                                <Users size={16} /> Relacionamentos
                            </h3>
                            <div className="space-y-4">
                                {Array.from(new Set(documents.map(d => d.metadata?.relationship).filter(Boolean))).map(rel => (
                                    <div key={rel as string} className="flex items-center justify-between group cursor-default">
                                        <div className="flex items-center gap-3">
                                            <div className="w-1.5 h-1.5 rounded-full bg-sky-500 group-hover:scale-150 transition-transform" />
                                            <span className="text-xs font-bold text-slate-300">{rel as string}</span>
                                        </div>
                                        <span className="text-[10px] font-black text-slate-500">TAGGED</span>
                                    </div>
                                ))}
                                {documents.filter(d => d.metadata?.relationship).length === 0 && (
                                    <p className="text-slate-500 text-xs italic">Nenhum membro identificado</p>
                                )}
                            </div>
                        </section>

                        <section className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6 border-b border-slate-100 pb-4">
                                Info de Contato
                            </h3>
                            <div className="space-y-6">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Email Principal</p>
                                    <p className="text-sm font-bold text-slate-700">{profile?.email || '—'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Telefone</p>
                                    <p className="text-sm font-bold text-slate-700">{profile?.phone || 'Não informado'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Idioma Pref.</p>
                                    <p className="text-sm font-bold text-slate-700 uppercase">{profile?.preferred_language || 'EN'}</p>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>

                <footer className="mt-24 pt-12 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-6 opacity-40 hover:opacity-100 transition-opacity">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Agency Operations • Judicial Intelligence</p>
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Powered by</span>
                        <img src="/bomjur-logo.png" alt="Bomjur" className="h-5 w-auto grayscale" />
                    </div>
                </footer>
            </main>
        </div>
    )
}

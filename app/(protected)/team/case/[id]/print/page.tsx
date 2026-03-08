'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Printer,
    Download,
    FileText,
    CheckCircle2,
    AlertCircle,
    Clock,
    CreditCard,
    Image as ImageIcon,
    Bell,
    ChevronRight,
    ArrowLeft,
    Check,
    Lock,
    ExternalLink,
    HelpCircle,
    Square
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { sortForUscis } from '@/lib/uscis-sorter'
import type { CaseDocument } from '@/types'

// ============================================================
// TYPES & MOCK CONFIG
// ============================================================

interface AssemblyStep {
    id: string
    title: string
    type: 'manual_verification' | 'document' | 'form' | 'photos'
    description: string
    category?: string
    isMandatory: boolean
    status: 'missing' | 'ready' | 'verified'
    fileUrl?: string
}

// ============================================================
// COMPONENTS
// ============================================================

export default function PrintAssemblyDashboard() {
    const { id: caseId } = useParams()
    const router = useRouter()
    const supabase = createClient()

    const [loading, setLoading] = useState(true)
    const [caseData, setCaseData] = useState<any>(null)
    const [clientProfile, setClientProfile] = useState<any>(null)
    const [documents, setDocuments] = useState<CaseDocument[]>([])
    const [verifiedSteps, setVerifiedSteps] = useState<Record<string, boolean>>({})

    // Fetch Data
    useEffect(() => {
        async function loadCaseForPrint() {
            setLoading(true)
            try {
                const { data: cData } = await supabase
                    .from('cases')
                    .select('*, user_profiles!client_id(*)')
                    .eq('id', caseId)
                    .single()

                if (cData) {
                    setCaseData(cData)
                    setClientProfile(cData.user_profiles)

                    const { data: dData } = await supabase
                        .from('case_documents')
                        .select('*')
                        .eq('case_id', caseId)

                    if (dData) setDocuments(dData as CaseDocument[])
                }
            } catch (err) {
                console.error('Error loading print dashboard:', err)
            } finally {
                setLoading(false)
            }
        }
        loadCaseForPrint()
    }, [caseId, supabase])

    const toggleStep = (stepId: string) => {
        setVerifiedSteps(prev => ({ ...prev, [stepId]: !prev[stepId] }))
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    if (!caseData) return <div className="p-20 text-center">Caso não encontrado.</div>

    // Document Logic
    const passportDoc = documents.find(d => d.category === 'passport')
    const i94Doc = documents.find(d => d.category === 'i94')
    const birthCertDoc = documents.find(d => d.category === 'birth_certificate')
    const translationDoc = documents.find(d => d.category === 'translation') // Theoretical category
    const photosDoc = documents.find(d => d.category === 'passport_photos')
    const mainForm = documents.find(d => d.category.includes('form_'))

    const handlePrint = (url?: string) => {
        if (!url) return
        window.open(url, '_blank')
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
            {/* ── Admin Top Bar ── */}
            <header className="sticky top-0 bg-white border-b border-slate-200 z-50 px-8 py-4 shadow-sm">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-colors group"
                    >
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        <span className="text-xs font-black uppercase tracking-widest">Voltar ao Caso</span>
                    </button>

                    <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Esteira de Impressão</p>
                            <h1 className="text-sm font-black text-slate-900">Processo: {clientProfile?.full_name}</h1>
                        </div>
                        <div className="w-px h-8 bg-slate-200" />
                        <button className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-slate-900/20 hover:bg-sky-600 transition-all active:scale-95">
                            <Download className="w-4 h-4" />
                            Imprimir Pacote Completo
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-8 pt-12">
                {/* ── Hero Info ── */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className="px-2 py-0.5 bg-sky-100 text-sky-600 text-[10px] font-black uppercase tracking-widest rounded">USCIS Order</span>
                            <span className="text-slate-300">•</span>
                            <span className="text-xs font-bold text-slate-400">ID: {caseId?.slice(0, 8)}</span>
                        </div>
                        <h2 className="text-4xl font-black text-slate-900 tracking-tight">Print Assembly Line</h2>
                        <p className="text-slate-500 font-medium mt-2 max-w-lg">Siga a ordem rigorosa abaixo para a montagem física do dossiê USCIS.</p>
                    </div>

                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center gap-4">
                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-emerald-500 shadow-sm">
                            <Printer className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-emerald-700 uppercase tracking-wider">Dica de Produtividade</p>
                            <p className="text-xs font-bold text-emerald-600/70">Use (Ctrl + P) em cada item pronto.</p>
                        </div>
                    </div>
                </div>

                <div className="relative">
                    {/* Vertical Timeline Line */}
                    <div className="absolute left-7 top-0 bottom-0 w-1 bg-slate-200 rounded-full" />

                    <div className="space-y-8 relative">

                        {/* 1. FILING FEE */}
                        <StepCard
                            number={1}
                            title="Pagamento de Taxas (Filing Fee)"
                            description="Verifique se o Cheque ou Money Order físico está anexado ao topo do pacote."
                            icon={<CreditCard className="w-5 h-5" />}
                            isVerified={verifiedSteps['fee']}
                            onToggle={() => toggleStep('fee')}
                        />

                        {/* 2. G-1145 */}
                        <StepCard
                            number={2}
                            title="Formulário G-1145"
                            description="E-Notification of Application/Petition Acceptance."
                            icon={<Bell className="w-5 h-5" />}
                            isVerified={verifiedSteps['g1145']}
                            onToggle={() => toggleStep('g1145')}
                            action={
                                <button className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-sky-50 hover:border-sky-200 hover:text-sky-600 transition-all flex items-center gap-2">
                                    <Printer className="w-3.5 h-3.5" /> Imprimir G-1145
                                </button>
                            }
                        />

                        {/* 3. MAIN FORM */}
                        <StepCard
                            number={3}
                            title={`Formulário Principal (${caseData.case_type})`}
                            description="O formulário preenchido pela plataforma e revisado."
                            icon={<FileText className="w-5 h-5" />}
                            status={mainForm ? 'ready' : 'missing'}
                            isVerified={verifiedSteps['main_form']}
                            onToggle={() => toggleStep('main_form')}
                            action={
                                mainForm && (
                                    <button
                                        onClick={() => handlePrint(mainForm.file_url)}
                                        className="px-4 py-2 bg-sky-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-sky-600 shadow-md shadow-sky-500/20 transition-all flex items-center gap-2"
                                    >
                                        <Printer className="w-3.5 h-3.5" /> Imprimir {caseData.case_type}
                                    </button>
                                )
                            }
                        />

                        {/* 4. PHOTOS */}
                        <StepCard
                            number={4}
                            title="Fotografias (Style Passport)"
                            description="2 fotos idênticas 2x2 fixadas em envelope plástico ou pequeno saco."
                            icon={<ImageIcon className="w-5 h-5" />}
                            status={photosDoc ? 'ready' : 'missing'}
                            isVerified={verifiedSteps['photos']}
                            onToggle={() => toggleStep('photos')}
                            action={
                                photosDoc && (
                                    <button
                                        onClick={() => handlePrint(photosDoc.file_url)}
                                        className="px-4 py-2 bg-slate-100 border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-sky-300 hover:text-sky-600 transition-all flex items-center gap-2"
                                    >
                                        <Printer className="w-3.5 h-3.5" /> Imprimir Fotos
                                    </button>
                                )
                            }
                        />

                        {/* 5. EVIDENCE BUNDLE */}
                        <div className="relative pl-16">
                            <div className="absolute left-4 top-2 w-6 h-6 bg-slate-900 text-white rounded-lg flex items-center justify-center text-[10px] font-black shadow-md z-10 transition-transform group-hover:scale-110">
                                5
                            </div>
                            <div className="bg-white border-2 border-slate-200 rounded-[2.5rem] p-8 shadow-sm">
                                <div className="flex items-center gap-3 mb-6">
                                    <h3 className="text-xl font-black text-slate-900 tracking-tight">Documentos de Suporte / Evidências</h3>
                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-widest rounded">Checklist</span>
                                </div>

                                <div className="space-y-4">
                                    <EvidenceItem
                                        title="Cópia do Passaporte"
                                        doc={passportDoc}
                                        isVerified={verifiedSteps['evidence_passport']}
                                        onToggle={() => toggleStep('evidence_passport')}
                                        onPrint={() => handlePrint(passportDoc?.file_url)}
                                    />
                                    <EvidenceItem
                                        title="I-94 (Status de Chegada)"
                                        doc={i94Doc}
                                        isVerified={verifiedSteps['evidence_i94']}
                                        onToggle={() => toggleStep('evidence_i94')}
                                        onPrint={() => handlePrint(i94Doc?.file_url)}
                                    />
                                    <EvidenceItem
                                        title="Registros Vitais (Original + Tradução)"
                                        doc={birthCertDoc}
                                        isVerified={verifiedSteps['evidence_vital']}
                                        onToggle={() => toggleStep('evidence_vital')}
                                        onPrint={() => handlePrint(birthCertDoc?.file_url)}
                                        hasAlert
                                    />
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                {/* ── Conclusion Section ── */}
                <div className="mt-20 text-center">
                    <button className="px-12 py-5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-[2rem] font-black uppercase tracking-[0.2em] text-xs shadow-2xl shadow-emerald-500/20 hover:scale-105 transition-all active:scale-95">
                        Concluir e Selar Pacote
                    </button>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-6 flex items-center justify-center gap-2">
                        <Lock className="w-3.5 h-3.5" />
                        Confirmação de Integridade do Dossiê
                    </p>
                </div>
            </main>
        </div>
    )
}

function StepCard({ number, title, description, icon, status = 'ready', action, isVerified, onToggle }: any) {
    return (
        <div className="group relative pl-16">
            {/* Step Number Dot */}
            <div className={`absolute left-4 top-2 w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shadow-md z-10 transition-all border-2 ${isVerified ? 'bg-emerald-500 border-emerald-400 text-white' : 'bg-slate-900 border-slate-800 text-white'}`}>
                {isVerified ? <Check className="w-3 h-3" /> : number}
            </div>

            <motion.div
                whileHover={{ x: 4 }}
                className={`bg-white border-2 rounded-[2rem] p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all ${isVerified ? 'border-emerald-100 bg-emerald-50/10 grayscale-[0.8]' : 'border-slate-200'}`}
            >
                <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${isVerified ? 'bg-emerald-100 text-emerald-600 border-emerald-200' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                        {icon}
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-black text-slate-900 tracking-tight">{title}</h3>
                            {status === 'missing' && (
                                <span className="flex items-center gap-1 text-[10px] font-black text-red-500 uppercase tracking-widest">
                                    <AlertCircle className="w-3 h-3" /> Faltando
                                </span>
                            )}
                        </div>
                        <p className="text-xs font-medium text-slate-500 max-w-sm">{description}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 self-end md:self-center">
                    {action}
                    <button
                        onClick={onToggle}
                        className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${isVerified ? 'bg-emerald-500 border-emerald-400 text-white' : 'border-slate-200 text-slate-300 hover:border-emerald-400 hover:text-emerald-500'}`}
                    >
                        <Check className="w-5 h-5" />
                    </button>
                </div>
            </motion.div>
        </div>
    )
}

function EvidenceItem({ title, doc, isVerified, onToggle, onPrint, hasAlert }: any) {
    return (
        <div className={`group/item flex items-center justify-between p-4 rounded-2xl border transition-all ${isVerified ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100 hover:border-sky-200 hover:bg-sky-50/30'}`}>
            <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isVerified ? 'bg-emerald-100 text-emerald-600' : 'bg-white border border-slate-200 text-slate-400 group-hover/item:text-sky-500'}`}>
                    <FileText className="w-5 h-5" />
                </div>
                <div>
                    <h4 className="text-xs font-black text-slate-900 tracking-tight">{title}</h4>
                    {doc ? (
                        <p className="text-[10px] font-bold text-slate-400 truncate max-w-[150px]">{doc.title}</p>
                    ) : (
                        <p className="text-[10px] font-bold text-red-400 italic">Pendente no Portal do Cliente</p>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-2">
                {doc && (
                    <button
                        onClick={onPrint}
                        className="p-2 text-slate-400 hover:text-sky-600 transition-colors"
                    >
                        <Printer className="w-4 h-4" />
                    </button>
                )}
                <button
                    onClick={onToggle}
                    className={`p-2 rounded-lg border-2 transition-all ${isVerified ? 'bg-emerald-500 border-emerald-400 text-white' : 'bg-white border-slate-200 text-slate-200 hover:border-emerald-300 hover:text-emerald-400'}`}
                >
                    <Check className="w-4 h-4" />
                </button>
            </div>
        </div>
    )
}

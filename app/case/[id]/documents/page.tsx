'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    ChevronLeft,
    LayoutGrid,
    ShieldCheck,
    AlertCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import DocumentCard from '@/components/documents/DocumentCard'
import DocumentGuide from '@/components/documents/DocumentGuide'
import { useParams, useRouter } from 'next/navigation'
import FormProgressBar from '@/components/ui/FormProgressBar'

interface DocRequirement {
    category: string
    label: string
    description?: string
    tooltip?: string
    documents: any[]
    categoryStatus: 'pending' | 'under_review' | 'approved'
}

export default function ClientDocumentsChecklist() {
    const { id: caseId } = useParams()
    const router = useRouter()
    const supabase = createClient()

    const [docs, setDocs] = useState<DocRequirement[]>([])
    const [loading, setLoading] = useState(true)
    const [caseData, setCaseData] = useState<any>(null)

    // Guide State
    const [guideOpen, setGuideOpen] = useState(false)
    const [selectedCategory, setSelectedCategory] = useState('passport')

    const fetchDocuments = async () => {
        try {
            // 1. Buscar dados do caso
            const { data: cData, error: cError } = await supabase
                .from('cases')
                .select('*')
                .eq('id', caseId)
                .single()

            if (cError) throw cError
            setCaseData(cData)

            // 2. Buscar documentos existentes (client_documents) e status (case_documents)
            const [clientDocsRes, caseDocsRes] = await Promise.all([
                supabase.from('client_documents').select('*').eq('client_id', cData.client_id),
                supabase.from('case_documents').select('document_type, status').eq('case_id', caseId)
            ])

            const dData = clientDocsRes.data || []
            const caseDocs = caseDocsRes.data || []

            // 3. Obter requisitos baseados no tipo de caso
            const requirements = getRequirementsForType(cData.case_type)

            const DOC_TYPE_TO_ENUM_MAP: Record<string, string> = {
                passport: 'passport',
                i94: 'i94',
                birth_certificate: 'birth_certificate',
                passport_photos: 'photo_2x2',
                marriage_certificate: 'marriage_certificate',
                visa_copy: 'visa',
                tax_return: 'tax_return'
            }

            const DB_STATUS_MAP: Record<string, 'pending' | 'under_review' | 'approved'> = {
                uploaded: 'under_review',
                in_review: 'under_review',
                approved: 'approved',
                pending: 'pending',
                rejected: 'pending',
            }

            // 4. Mapear requisitos para documentos
            const mergedDocs: DocRequirement[] = requirements.map(req => {
                const categoryDocs = dData.filter(d => d.document_type === req.category)

                // Pegar status da categoria
                const enumType = DOC_TYPE_TO_ENUM_MAP[req.category] || req.category
                const caseDoc = caseDocs.find(cd => cd.document_type === enumType)
                const categoryStatus = DB_STATUS_MAP[caseDoc?.status ?? 'pending'] ?? 'pending'

                return {
                    ...req,
                    documents: categoryDocs.map(d => ({
                        id: d.id,
                        file_name: d.file_name,
                        file_path: d.file_path,
                        extraction_status: d.extraction_status,
                        metadata: d.metadata
                    })),
                    categoryStatus
                }
            })

            setDocs(mergedDocs)
        } catch (err: any) {
            console.error('[DocumentsPage] Error fetching docs:', err.message);
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchDocuments()
        // Realtime Subscription
        const channel = supabase
            .channel(`docs-case-${caseId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'client_documents' }, () => fetchDocuments())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'case_documents' }, () => fetchDocuments())
            .subscribe()

        return () => { supabase.removeChannel(channel) }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [caseId])

    const openGuide = (category: string) => {
        setSelectedCategory(category)
        setGuideOpen(true)
    }

    const totalCategories = docs.length
    const approvedCategories = docs.filter(d => d.categoryStatus === 'approved').length
    const progress = totalCategories > 0 ? Math.round((approvedCategories / totalCategories) * 100) : 0

    if (loading) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
        </div>
    )

    return (
        <div className="min-h-screen bg-slate-50 pb-24">
            <header className="sticky top-0 bg-white/80 backdrop-blur-xl border-b border-slate-200 z-40 px-6 py-4">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <button onClick={() => router.back()} className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 hover:bg-white hover:text-sky-500 transition-all">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="text-center">
                        <h1 className="text-sm font-black uppercase tracking-[0.2em] text-slate-900">Checklist de Documentos</h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{caseData?.case_type}</p>
                    </div>
                    <div className="w-10 h-10" />
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-6 pt-10">
                {/* Progress Header */}
                <header className="mb-12">
                    <div className="flex items-end justify-between mb-4">
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">Envio de Evidências</h2>
                            <p className="text-slate-500 font-medium mt-1">Carregue seus documentos originais</p>
                        </div>
                        <div className="text-right">
                            <span className="text-3xl font-black text-slate-900 leading-none">{approvedCategories}/{totalCategories}</span>
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">Categorias Aprovadas</p>
                        </div>
                    </div>

                    <div className="h-4 w-full bg-slate-200 rounded-2xl overflow-hidden p-1 border border-white shadow-inner">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 1.5, ease: 'circOut' }}
                            className="h-full bg-gradient-to-r from-sky-400 to-blue-600 rounded-xl"
                        />
                    </div>
                </header>

                {/* Checklist UI */}
                <div className="space-y-6">
                    {docs.map((doc, idx) => (
                        <motion.div
                            key={doc.category}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="space-y-3"
                        >
                            <DocumentCard
                                caseId={caseId as string}
                                clientId={caseData?.client_id}
                                category={doc.category}
                                label={doc.label}
                                description={doc.description}
                                tooltip={doc.tooltip}
                                documents={doc.documents}
                                categoryStatus={doc.categoryStatus}
                                onUpdate={fetchDocuments}
                            />
                            <button
                                onClick={() => openGuide(doc.category)}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-sky-600 hover:border-sky-200 transition-all shadow-sm active:scale-95"
                            >
                                <AlertCircle className="w-3.5 h-3.5" />
                                Como preparar este documento?
                            </button>
                        </motion.div>
                    ))}
                </div>

                <div className="mt-16 p-8 bg-slate-900 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:scale-110 transition-transform duration-1000">
                        <ShieldCheck className="w-40 h-40 text-white" />
                    </div>
                    <div className="relative z-10 flex gap-6 items-center">
                        <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
                            <ShieldCheck className="w-6 h-6 text-sky-400" />
                        </div>
                        <p className="text-xs text-slate-300 font-medium leading-relaxed max-w-sm">
                            Este é um ambiente criptografado e seguro. Seus documentos são processados automaticamente para garantir sua privacidade.
                        </p>
                    </div>
                </div>
            </main>

            <DocumentGuide
                isOpen={guideOpen}
                onClose={() => setGuideOpen(false)}
                category={selectedCategory}
            />
        </div>
    )
}

function getRequirementsForType(type: string) {
    const base = [
        {
            category: 'passport',
            label: 'Identidade (Passaporte)',
            description: 'Página de identificação com foto',
            tooltip: 'Envie a cópia nítida da página bio do seu passaporte válido.'
        },
        {
            category: 'birth_certificate',
            label: 'Registros Vitais (Certidão)',
            description: 'Nascimento ou Casamento',
            tooltip: 'Sua certidão original com firma reconhecida (se aplicável).'
        },
    ]

    if (type?.includes('I-485')) {
        return [
            ...base,
            {
                category: 'i94',
                label: 'Status Legal (I-94)',
                description: 'Registro de entrada nos EUA',
                tooltip: 'Pode ser obtido online no oficial do CBP.'
            },
            {
                category: 'visa_copy',
                label: 'Visto Atual',
                description: 'Cópia do visto estampado',
                tooltip: 'Página do passaporte com o carimbo do visto americano mais recente.'
            },
            {
                category: 'passport_photos',
                label: 'Fotografias 2x2',
                description: '2 fotos estilo passaporte',
                tooltip: 'Fundo branco, tiradas nos últimos 30 dias.'
            },
        ]
    }
    return base
}

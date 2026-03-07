'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    ChevronLeft,
    LayoutGrid,
    ShieldCheck,
    AlertCircle,
    CheckCircle2
} from 'lucide-react'
import { COLORS } from '@/lib/design-system'
import { createClient } from '@/lib/supabase/client'
import DocumentCard from '@/components/documents/DocumentCard'
import DocumentGuide from '@/components/documents/DocumentGuide'
import { useParams, useRouter } from 'next/navigation'

interface DocRequirement {
    category: string
    label: string
    documents: any[]
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
            console.log(`[DocumentsPage] Fetching data for case: ${caseId}`);
            // 1. Buscar dados do caso
            const { data: cData, error: cError } = await supabase
                .from('cases')
                .select('*')
                .eq('id', caseId)
                .single()

            if (cError) throw cError
            setCaseData(cData)

            // 2. Buscar documentos existentes (tabela client_documents para 1:N)
            // Nota: usamos client_documents para listar os arquivos reais
            const { data: dData, error: dError } = await supabase
                .from('client_documents')
                .select('*')
                .eq('client_id', cData.client_id)
                .not('extraction_status', 'eq', 'skipped')

            if (dError) throw dError

            // 3. Obter requisitos baseados no tipo de caso
            const requirements = getRequirementsForType(cData.case_type)

            // 4. Mapear requisitos para documentos
            const mergedDocs = requirements.map(req => {
                const categoryDocs = dData?.filter(d => d.document_type === req.category) || []
                return {
                    ...req,
                    documents: categoryDocs.map(d => ({
                        id: d.id,
                        file_name: d.file_name,
                        status: d.extraction_status === 'completed' ? 'approved' : 'uploaded', // Simplificação para a UI antiga
                        file_path: d.file_path,
                        metadata: d.metadata
                    }))
                }
            })

            setDocs(mergedDocs)
        } catch (err: any) {
            console.error('Error fetching docs:', err.message);
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchDocuments()

        // Realtime Subscription
        const channel = supabase
            .channel(`docs-${caseId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'client_documents' },
                () => fetchDocuments()
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [caseId])

    const openGuide = (category: string) => {
        setSelectedCategory(category)
        setGuideOpen(true)
    }

    const totalCategories = docs.length
    const completedCategories = docs.filter(d => d.documents.some(doc => doc.status === 'approved')).length
    const progress = totalCategories > 0 ? (completedCategories / totalCategories) * 100 : 0

    if (loading) return (
        <div className="min-h-screen bg-[#0A0E17] flex items-center justify-center">
            <div className="animate-pulse flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-lime-500/20 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-lime-500 border-t-transparent rounded-full animate-spin" />
                </div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-lime-500">A Carregar Checklist...</span>
            </div>
        </div>
    )

    return (
        <div className="min-h-screen flex flex-col p-6 max-w-md mx-auto relative pb-20" style={{ background: COLORS.bg }}>
            {/* Header Area */}
            <header className="flex items-center justify-between mb-8">
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-xl bg-white/5 border border-white/10 text-dim"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="text-center">
                    <h1 className="text-sm font-black uppercase tracking-widest" style={{ color: COLORS.text }}>Checklist</h1>
                    <p className="text-[10px] font-bold text-dim">{caseData?.case_type}</p>
                </div>
                <div className="w-9 h-9" />
            </header>

            {/* Progress Card */}
            <div className="p-6 rounded-3xl mb-8 relative overflow-hidden" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <ShieldCheck className="w-20 h-20 text-lime-500" />
                </div>

                <div className="relative z-10 space-y-4">
                    <div className="flex justify-between items-end">
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: COLORS.textDim }}>
                                Progresso do Envio
                            </span>
                            <h2 className="text-3xl font-black text-white">
                                {completedCategories}<span className="text-lime-500">/{totalCategories}</span>
                            </h2>
                        </div>
                        <div className="text-right">
                            <span className="text-lg font-black text-lime-500">{Math.round(progress)}%</span>
                        </div>
                    </div>

                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-lime-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            style={{ boxShadow: `0 0 10px ${COLORS.lime}44` }}
                        />
                    </div>

                    <p className="text-[11px] font-medium leading-relaxed" style={{ color: COLORS.textMuted }}>
                        {progress === 100
                            ? '🎉 Parabéns! Todos os documentos foram enviados. Nossa equipe iniciará a conferência.'
                            : 'Mantenha seus documentos organizados. Nossa IA ajudará na validação imediata.'
                        }
                    </p>
                </div>
            </div>

            {/* Documents List */}
            <div className="flex-1 space-y-4">
                <div className="flex items-center justify-between px-2 mb-2">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-dim">Documentos Necessários</h3>
                    <LayoutGrid className="w-4 h-4 text-dim" />
                </div>

                <div className="space-y-6">
                    {docs.map((doc, idx) => (
                        <motion.div
                            key={doc.category}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="space-y-2"
                        >
                            <DocumentCard
                                caseId={caseId as string}
                                category={doc.category}
                                label={doc.label}
                                documents={doc.documents}
                                onUpdate={fetchDocuments}
                            />
                            <button
                                onClick={() => openGuide(doc.category)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-[10px] font-black uppercase tracking-widest text-dim hover:text-lime-500 transition-all ml-1"
                            >
                                <AlertCircle className="w-3 h-3" />
                                Como preparar este documento?
                            </button>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Guide Component */}
            <DocumentGuide
                isOpen={guideOpen}
                onClose={() => setGuideOpen(false)}
                category={selectedCategory}
            />

            {/* Footer Advice */}
            <footer className="mt-12 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 flex gap-3 items-center">
                <AlertCircle className="w-5 h-5 text-blue-400 shrink-0" />
                <p className="text-[10px] text-blue-300 font-medium leading-tight">
                    Precisa de ajuda? Use o chat de suporte para falar com seu gestor de caso.
                </p>
            </footer>
        </div>
    )
}

function getRequirementsForType(type: string) {
    const base = [
        { category: 'passport', label: 'Passaporte (Página de Dados)' },
        { category: 'birth_certificate', label: 'Certidão de Nascimento' },
    ]

    if (type?.includes('I-485')) {
        return [
            ...base,
            { category: 'i94', label: 'Registro de Entrada I-94' },
            { category: 'visa_copy', label: 'Cópia do Visto Atual' },
            { category: 'passport_photos', label: 'Foto 2x2 (Fundo Branco)' },
            { category: 'marriage_certificate', label: 'Certidão de Casamento' },
            { category: 'tax_return', label: 'Declaração de Imposto (IRS)' }
        ]
    }

    return base
}

'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    ChevronLeft,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Maximize2,
    Download,
    Eye,
    ShieldCheck,
    Loader2
} from 'lucide-react'
import { COLORS } from '@/lib/design-system'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import { getDocumentUrl } from '@/lib/storage/upload'

const REJECTION_REASONS = [
    "Imagem ilegível",
    "Documento incorreto",
    "Falta tradução",
    "Documento vencido",
    "Outro"
]

export default function DocumentReviewWorkbench() {
    const { docId } = useParams()
    const router = useRouter()
    const supabase = createClient()

    const [doc, setDoc] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [signedUrl, setSignedUrl] = useState<string | null>(null)

    // Action States
    const [action, setAction] = useState<'none' | 'approve' | 'reject'>('none')
    const [reason, setReason] = useState(REJECTION_REASONS[0])
    const [details, setDetails] = useState('')

    const fetchData = async () => {
        try {
            const { data, error } = await supabase
                .from('case_documents')
                .select(`
                    *,
                    cases (
                        client_name,
                        case_type
                    )
                `)
                .eq('id', docId)
                .single()

            if (error) throw error
            setDoc(data)

            // Get Signed URL
            const url = await getDocumentUrl(data.file_path)
            setSignedUrl(url)

            // Mark as 'under_review' if it's currently 'uploaded'
            if (data.status === 'uploaded') {
                await supabase
                    .from('case_documents')
                    .update({ status: 'under_review' })
                    .eq('id', docId)
            }
        } catch (err) {
            console.error('Error fetching doc:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [docId])

    const handleReview = async () => {
        if (action === 'none') return
        setSubmitting(true)

        try {
            const response = await fetch('/api/documents/review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    docId,
                    action,
                    reason: action === 'reject' ? reason : null,
                    details: action === 'reject' ? details : null
                })
            })

            if (!response.ok) throw new Error('Falha na resposta da API')
            router.push('/team/review')
        } catch (err) {
            console.error('Review submission error:', err)
            alert('Erro ao processar revisão.')
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) return (
        <div className="min-h-screen bg-[#0A0E17] flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-lime-500 animate-spin" />
        </div>
    )

    const isPdf = doc?.file_path?.toLowerCase().endsWith('.pdf')

    return (
        <div className="min-h-screen bg-[#0A0E17] flex flex-col h-screen overflow-hidden">
            {/* Topbar */}
            <header className="h-16 flex items-center justify-between px-6 bg-[#0D1117] border-b border-white/5 sticky top-0 z-30">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="p-2 rounded-lg text-dim hover:bg-white/5 hover:text-white transition-all">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-sm font-bold text-white leading-none capitalize">
                            {doc.category.replace('_', ' ')}
                        </h1>
                        <p className="text-[10px] text-dim font-bold uppercase tracking-widest mt-1">
                            {doc.cases?.client_name} · {doc.cases?.case_type}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-[10px] font-black uppercase text-purple-400">
                        Workbench de Revisão
                    </div>
                </div>
            </header>

            {/* Main Workbench Area */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                {/* Left Side: Document Viewer */}
                <div className="flex-[3] relative bg-[#05070A] overflow-auto border-r border-white/5 scrollbar-hide">
                    {signedUrl ? (
                        <div className="w-full h-full flex items-center justify-center p-4">
                            {isPdf ? (
                                <embed
                                    src={signedUrl}
                                    type="application/pdf"
                                    className="w-full h-full max-w-4xl rounded-lg shadow-2xl"
                                />
                            ) : (
                                <div className="relative group max-w-full">
                                    <img
                                        src={signedUrl}
                                        alt="Documento para Revisão"
                                        className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain cursor-zoom-in"
                                        onClick={() => window.open(signedUrl, '_blank')}
                                    />
                                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => window.open(signedUrl, '_blank')}
                                            className="p-3 rounded-full bg-black/60 backdrop-blur-md text-white hover:bg-black/80 shadow-xl"
                                        >
                                            <Maximize2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-dim">
                            <AlertCircle className="w-8 h-8" />
                            <p className="text-sm">Erro ao carregar ficheiro.</p>
                        </div>
                    )}
                </div>

                {/* Right Side: Decision Actions */}
                <div className="flex-1 min-w-[320px] bg-[#0D1117] flex flex-col relative z-20">
                    <div className="p-6 space-y-8 flex-1 overflow-auto">
                        {/* Status Header */}
                        <div>
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-dim mb-4">Ação Administrativa</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setAction('approve')}
                                    className={`flex flex-col items-center gap-2 py-4 rounded-2xl border transition-all ${action === 'approve' ? 'bg-green-500/10 border-green-500 text-green-500' : 'bg-white/5 border-white/10 text-dim'}`}
                                >
                                    <CheckCircle2 className="w-6 h-6" />
                                    <span className="text-xs font-bold">Aprovar</span>
                                </button>
                                <button
                                    onClick={() => setAction('reject')}
                                    className={`flex flex-col items-center gap-2 py-4 rounded-2xl border transition-all ${action === 'reject' ? 'bg-red-500/10 border-red-500 text-red-500' : 'bg-white/5 border-white/10 text-dim'}`}
                                >
                                    <XCircle className="w-6 h-6" />
                                    <span className="text-xs font-bold">Rejeitar</span>
                                </button>
                            </div>
                        </div>

                        {/* Rejection Form */}
                        <AnimatePresence>
                            {action === 'reject' && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="space-y-6"
                                >
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-dim tracking-wider pl-1">Motivo Padronizado</label>
                                        <select
                                            value={reason}
                                            onChange={(e) => setReason(e.target.value)}
                                            className="w-full bg-[#111827] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 text-white"
                                        >
                                            {REJECTION_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-dim tracking-wider pl-1">Detalhes (Opcional)</label>
                                        <textarea
                                            placeholder="Ex: A foto está desfocada no canto superior..."
                                            value={details}
                                            onChange={(e) => setDetails(e.target.value)}
                                            rows={4}
                                            className="w-full bg-[#111827] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 text-white resize-none"
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Summary / Confirmation */}
                        {action === 'approve' && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="p-4 rounded-2xl bg-green-500/5 border border-green-500/10 flex gap-3"
                            >
                                <ShieldCheck className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                                <p className="text-xs text-green-400 leading-relaxed font-medium">
                                    O documento será marcado como <span className="font-bold">Aprovado</span> e o cliente receberá uma notificação instantânea.
                                </p>
                            </motion.div>
                        )}
                    </div>

                    {/* Fixed Footer Action */}
                    <div className="p-6 border-t border-white/5 bg-[#0D1117]">
                        <button
                            disabled={action === 'none' || submitting}
                            onClick={handleReview}
                            className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 ${action === 'reject' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : action === 'approve' ? 'bg-lime-500 text-black shadow-lg shadow-lime-500/20' : 'bg-white/5 text-dim'}`}
                        >
                            {submitting ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    {action === 'approve' ? 'Confirmar Aprovação' : action === 'reject' ? 'Confirmar Rejeição' : 'Selecione uma Ação'}
                                </>
                            )}
                        </button>
                        <p className="text-[10px] text-center mt-4 text-dim font-medium">
                            As revisões são registradas no log de auditoria do sistema.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

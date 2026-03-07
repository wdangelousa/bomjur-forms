Substitua todo o código por...
'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    FileText,
    CheckCircle2,
    Clock,
    AlertCircle,
    ChevronRight,
    Eye,
    Upload,
    Sparkles,
    XCircle,
    RotateCcw,
    Trash2,
    RefreshCw,
    PlusCircle
} from 'lucide-react'
import { COLORS } from '@/lib/design-system'
import { createClient } from '@/lib/supabase/client'
import DocumentUpload from './DocumentUpload'
import Link from 'next/link'

export type DocumentStatus = 'pending' | 'uploaded' | 'under_review' | 'approved' | 'rejected'

interface DocumentItem {
    id: string
    file_name: string
    status: DocumentStatus
    file_path?: string
    file_url?: string
    rejection_reason?: string
    metadata?: any
}

interface DocumentCardProps {
    caseId: string
    category: string
    label: string
    documents: DocumentItem[]
    onUpdate?: () => void
}

const RELATIONSHIP_BADGE: Record<string, string> = {
    'Requerente Principal': 'bg-sky-100 text-sky-700',
    'Cônjuge': 'bg-violet-100 text-violet-700',
    'Filho(a)': 'bg-emerald-100 text-emerald-700',
    'Outro': 'bg-slate-100 text-slate-600',
}

export default function DocumentCard({
    caseId,
    category,
    label,
    documents,
    onUpdate
}: DocumentCardProps) {
    const [isUploadOpen, setIsUploadOpen] = useState(false)
    const [isRemoving, setIsRemoving] = useState(null as string | null)
    const supabase = createClient()

    const hasDocuments = documents.length > 0
    const isCategoryApproved = documents.length > 0 && documents.some(d => d.status === 'approved')

    const handleRemove = async (docId: string, filePath?: string) => {
        if (!window.confirm('Tem certeza que deseja remover este documento?')) return

        setIsRemoving(docId)
        try {
            if (filePath) {
                await supabase.storage.from('documents').remove([filePath])
            }

            const { error } = await supabase
                .from('client_documents')
                .delete()
                .eq('id', docId)

            if (error) throw error

            if (onUpdate) onUpdate()
        } catch (err) {
            console.error('[DocumentCard] Error removing document:', err)
            alert('Erro ao remover documento.')
        } finally {
            setIsRemoving(null)
        }
    }

    return (
        <div className={`group relative p-6 rounded-[2rem] border bg-white transition-all shadow-sm ${isCategoryApproved ? 'border-emerald-100 bg-emerald-50/20' : 'border-slate-200'}`}>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
                <div className="flex items-start gap-5 flex-1 min-w-0">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border ${isCategoryApproved ? 'bg-emerald-100 border-emerald-200 text-emerald-600' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                        <FileText className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                            <h3 className="font-black text-slate-900 tracking-tight">{label}</h3>
                            {isCategoryApproved && (
                                <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span className="text-[10px] font-black uppercase tracking-wider">Aprovado</span>
                                </div>
                            )}
                        </div>
                        <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                            Requisito: {label}
                        </p>
                    </div>
                </div>

                <div className="flex flex-col items-end gap-3 self-end sm:self-start shrink-0">
                    <button
                        onClick={() => setIsUploadOpen(true)}
                        className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-sm ${hasDocuments
                                ? 'bg-white border border-slate-200 text-slate-900 hover:bg-slate-50'
                                : 'bg-slate-900 text-white hover:bg-sky-600'
                            }`}
                    >
                        {hasDocuments ? <><PlusCircle className="w-4 h-4" />Adicionar outro</> : <><Upload className="w-4 h-4" />Enviar Documento</>}
                    </button>
                </div>
            </div>

            {/* List of Documents (1:N) */}
            {hasDocuments && (
                <div className="mt-6 space-y-2 border-t border-slate-100 pt-5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1">
                        Arquivos Enviados ({documents.length})
                    </p>
                    <div className="grid gap-2">
                        {documents.map(doc => {
                            const relationship = doc.metadata?.relationship ?? 'Requerente Principal'
                            return (
                                <div key={doc.id} className="flex items-center gap-3 p-3 bg-slate-50/50 rounded-2xl border border-slate-100 hover:bg-slate-50 transition-colors">
                                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center shrink-0">
                                        <FileText className="w-4 h-4 text-slate-400" />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-slate-700 font-bold truncate">{doc.file_name}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-tighter ${RELATIONSHIP_BADGE[relationship] ?? 'bg-slate-100 text-slate-600'}`}>
                                                {relationship}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        {doc.status === 'approved' ? (
                                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
                                                <CheckCircle2 className="w-3 h-3" />
                                                <span className="text-[9px] font-black uppercase tracking-wider">Aprovado</span>
                                            </div>
                                        ) : doc.status === 'rejected' ? (
                                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-600 rounded-full border border-red-100">
                                                <AlertCircle className="w-3 h-3" />
                                                <span className="text-[9px] font-black uppercase tracking-wider">Rejeitado</span>
                                            </div>
                                        ) : (
                                            <Link
                                                href={`/upload/review/${doc.id}`}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 text-sky-600 rounded-full border border-sky-100 hover:bg-sky-100 transition-colors"
                                            >
                                                <span className="text-[9px] font-black uppercase tracking-wider">Revisar</span>
                                                <ChevronRight className="w-3 h-3" />
                                            </Link>
                                        )}

                                        <button
                                            onClick={() => handleRemove(doc.id, doc.file_path)}
                                            disabled={isRemoving === doc.id}
                                            className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                                        >
                                            {isRemoving === doc.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            <AnimatePresence>
                {isUploadOpen && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-slate-900/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="w-full max-w-sm relative"
                        >
                            <button
                                onClick={() => setIsUploadOpen(false)}
                                className="absolute -top-12 right-0 p-2 text-white/50 hover:text-white transition-colors"
                            >
                                <XCircle className="w-8 h-8" />
                            </button>

                            <DocumentUpload
                                caseId={caseId}
                                category={category}
                                label={label}
                                onComplete={() => {
                                    setIsUploadOpen(false)
                                    if (onUpdate) onUpdate()
                                }}
                            />
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}

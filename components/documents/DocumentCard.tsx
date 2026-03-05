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
    RotateCcw
} from 'lucide-react'
import { COLORS } from '@/lib/design-system'
import DocumentUpload from './DocumentUpload'

export type DocumentStatus = 'pending' | 'uploaded' | 'under_review' | 'approved' | 'rejected'

interface DocumentCardProps {
    caseId: string
    id: string // Identificador único na tabela case_documents
    category: string
    label: string
    status: DocumentStatus
    fileUrl?: string
    rejectionReason?: string
    aiProcessed?: boolean
    onUpdate?: () => void
}

export default function DocumentCard({
    caseId,
    category,
    label,
    status,
    fileUrl,
    rejectionReason,
    aiProcessed,
    onUpdate
}: DocumentCardProps) {
    const [isUploadOpen, setIsUploadOpen] = useState(false)

    const statusConfig = {
        pending: {
            label: 'Pendente',
            icon: <Clock className="w-3.5 h-3.5" />,
            color: COLORS.textDim,
            bg: 'bg-slate-100'
        },
        uploaded: {
            label: 'Enviado',
            icon: <CheckCircle2 className="w-3.5 h-3.5" />,
            color: COLORS.blue,
            bg: 'bg-blue-50'
        },
        under_review: {
            label: 'Em Revisão',
            icon: <LoaderIcon />,
            color: COLORS.purple,
            bg: 'bg-sky-50'
        },
        approved: {
            label: 'Aprovado',
            icon: <CheckCircle2 className="w-3.5 h-3.5" />,
            color: COLORS.success,
            bg: 'bg-emerald-50'
        },
        rejected: {
            label: 'Rejeitado',
            icon: <XCircle className="w-3.5 h-3.5" />,
            color: COLORS.danger,
            bg: 'bg-red-50'
        }
    }

    const currentStatus = statusConfig[status]

    return (
        <div
            className={`group relative p-4 rounded-2xl border bg-white transition-all hover:bg-slate-50 shadow-sm ${status === 'rejected' ? 'border-red-200' : 'border-slate-200'}`}
        >
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                    {/* Icon / Thumbnail */}
                    <div className="relative w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                        {fileUrl && (status === 'uploaded' || status === 'approved') ? (
                            <img src={fileUrl} alt={label} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                        ) : (
                            <FileText className="w-6 h-6 text-dim" />
                        )}

                        {aiProcessed && (status === 'uploaded' || status === 'approved') && (
                            <div className="absolute -top-1 -right-1 p-1 rounded-full bg-sky-500 shadow-sm">
                                <Sparkles className="w-2.5 h-2.5 text-white" />
                            </div>
                        )}
                    </div>

                    <div className="space-y-1">
                        <h4 className="text-sm font-bold" style={{ color: COLORS.text }}>{label}</h4>
                        <div className="flex items-center gap-2">
                            <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${currentStatus.bg}`} style={{ color: currentStatus.color }}>
                                {currentStatus.icon}
                                {currentStatus.label}
                            </span>

                            {aiProcessed && (status === 'uploaded' || status === 'approved') && (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-[10px] font-bold text-sky-600 uppercase tracking-tighter">
                                    <Sparkles className="w-2.5 h-2.5" />
                                    Extraído por IA
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                    {status === 'pending' || status === 'rejected' ? (
                        <button
                            onClick={() => setIsUploadOpen(true)}
                            className="p-2 rounded-xl bg-sky-500 text-white shadow-sm transition-all active:scale-95"
                        >
                            {status === 'rejected' ? <RotateCcw className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
                        </button>
                    ) : (
                        <button
                            onClick={() => fileUrl && window.open(fileUrl, '_blank')}
                            className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-900 transition-all"
                        >
                            <Eye className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Rejection Feedback */}
            <AnimatePresence>
                {status === 'rejected' && rejectionReason && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden mt-3"
                    >
                        <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
                            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-xs font-medium text-red-600 leading-relaxed">
                                <span className="font-bold block mb-1">Motivo da Rejeição:</span>
                                {rejectionReason}
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Upload Modal Overlay */}
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
                                className="absolute -top-12 right-0 p-2 text-slate-400 hover:text-slate-900 transition-colors"
                            >
                                <XCircle className="w-8 h-8" />
                            </button>

                            <DocumentUpload
                                caseId={caseId}
                                category={category}
                                label={label}
                                onComplete={() => {
                                    console.log(`[DocumentCard] Upload complete for ${label}`);
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

function LoaderIcon() {
    return (
        <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
    )
}

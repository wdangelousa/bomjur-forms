'use client'

import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    FileText,
    CheckCircle2,
    Clock,
    AlertCircle,
    ChevronRight,
    Upload,
    Sparkles,
    XCircle,
    RotateCcw,
    Trash2,
    RefreshCw,
    PlusCircle,
    UserCircle2,
    Check,
    Info
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export type DocumentStatus = 'pending' | 'uploaded' | 'under_review' | 'approved' | 'rejected'

interface DocumentItem {
    id: string
    file_name: string
    status: DocumentStatus
    file_path?: string
    metadata?: any
    extraction_status?: string
}

interface DocumentCardProps {
    caseId: string
    clientId: string
    category: string
    label: string
    description?: string
    tooltip?: string
    documents: DocumentItem[]
    categoryStatus: 'pending' | 'under_review' | 'approved'
    onUpdate?: () => void
}

const RELATIONSHIP_OPTIONS = [
    'Requerente Principal',
    'Cônjuge',
    'Filho(a)',
    'Outro',
]

const RELATIONSHIP_BADGE: Record<string, string> = {
    'Requerente Principal': 'bg-sky-100 text-sky-700',
    'Cônjuge': 'bg-violet-100 text-violet-700',
    'Filho(a)': 'bg-emerald-100 text-emerald-700',
    'Outro': 'bg-slate-100 text-slate-600',
}

export default function DocumentCard({
    caseId,
    clientId,
    category,
    label,
    description,
    tooltip,
    documents,
    categoryStatus,
    onUpdate
}: DocumentCardProps) {
    const supabase = createClient()
    const [isUploading, setIsUploading] = useState(false)
    const [isRemoving, setIsRemoving] = useState(null as string | null)
    const [relationshipPickerOpen, setRelationshipPickerOpen] = useState(false)
    const [selectedRelationship, setSelectedRelationship] = useState('Requerente Principal')

    const fileInputRef = useRef<HTMLInputElement>(null)

    const hasDocuments = documents.length > 0
    const isApproved = categoryStatus === 'approved'

    // ── Handlers ─────────────────────────────────────────────────────────────

    const handleUploadClick = () => {
        setRelationshipPickerOpen(true)
    }

    const confirmRelationshipAndSelectFile = () => {
        setRelationshipPickerOpen(false)
        setTimeout(() => fileInputRef.current?.click(), 100)
    }

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsUploading(true)
        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('caseId', caseId)
            formData.append('clientId', clientId)
            formData.append('category', category)
            formData.append('relationship', selectedRelationship)

            const res = await fetch('/api/dashboard/upload', { method: 'POST', body: formData })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Erro no upload')

            if (onUpdate) onUpdate()
        } catch (error) {
            console.error('[DocumentCard] Upload error:', error)
            alert('Erro ao enviar documento.')
        } finally {
            setIsUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const handleRemove = async (docId: string, filePath?: string) => {
        if (!window.confirm('Tem certeza que deseja excluir este documento?')) return

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
            alert('Erro ao excluir documento.')
        } finally {
            setIsRemoving(null)
        }
    }

    return (
        <div className={`group relative p-6 rounded-[2rem] border bg-white transition-all hover:shadow-xl hover:shadow-slate-200/50 ${isApproved ? 'border-emerald-100 bg-emerald-50/20' : 'border-slate-200 hover:border-sky-300'}`}>
            <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
                accept="application/pdf,image/*"
            />

            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
                <div className="flex items-start gap-5 flex-1 min-w-0">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border transition-colors ${isApproved ? 'bg-emerald-100 border-emerald-200 text-emerald-600' : 'bg-slate-50 border-slate-100 text-slate-400 group-hover:bg-sky-50 group-hover:border-sky-100 group-hover:text-sky-500'}`}>
                        <FileText className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                            <h3 className="font-black text-slate-900 tracking-tight">{label}</h3>
                            <CategoryStatusBadge status={categoryStatus} />
                        </div>
                        {description && (
                            <p className="text-sm font-medium text-slate-500 leading-relaxed uppercase text-[11px] tracking-wider">
                                {description}
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex flex-col items-end gap-3 self-end sm:self-start shrink-0">
                    {isUploading ? (
                        <div className="flex items-center gap-2 px-5 py-3 bg-sky-50 text-sky-600 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-sky-100">
                            <Clock className="w-4 h-4 animate-spin" />
                            Extraindo...
                        </div>
                    ) : (
                        <button
                            onClick={handleUploadClick}
                            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-sm ${hasDocuments
                                ? 'bg-white border border-slate-200 text-slate-900 hover:bg-slate-50'
                                : 'bg-slate-900 text-white hover:bg-sky-600 hover:shadow-sky-500/20'
                                }`}
                        >
                            {hasDocuments ? <><PlusCircle className="w-4 h-4" />Adicionar outro</> : <><Upload className="w-4 h-4" />Enviar Documento</>}
                        </button>
                    )}
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
                            const extractionStatus = doc.extraction_status ?? 'processing'

                            return (
                                <div key={doc.id} className="flex items-center justify-between gap-3 p-3 bg-slate-50/50 rounded-2xl border border-slate-100 hover:bg-slate-50 transition-colors">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
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
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        <div className="shrink-0">
                                            {extractionStatus === 'failed' ? (
                                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-600 rounded-full border border-red-100">
                                                    <AlertCircle className="w-3 h-3" />
                                                    <span className="text-[9px] font-black uppercase tracking-wider">Falhou</span>
                                                </div>
                                            ) : extractionStatus === 'processing' ? (
                                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-600 rounded-full border border-amber-100">
                                                    <Clock className="w-3 h-3 animate-spin" />
                                                    <span className="text-[9px] font-black uppercase tracking-wider">Extraindo</span>
                                                </div>
                                            ) : isApproved ? (
                                                <Link
                                                    href={`/upload/review/${doc.id}`}
                                                    className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 hover:bg-emerald-100 transition-colors"
                                                >
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    <span className="text-[9px] font-black uppercase tracking-wider">Confirmado</span>
                                                </Link>
                                            ) : (
                                                <Link
                                                    href={`/upload/review/${doc.id}`}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 text-sky-600 rounded-full border border-sky-100 hover:bg-sky-100 transition-colors group/link"
                                                >
                                                    <span className="text-[9px] font-black uppercase tracking-wider">Revisar</span>
                                                    <ChevronRight className="w-3 h-3 transition-transform group-hover/link:translate-x-0.5" />
                                                </Link>
                                            )}
                                        </div>

                                        <button
                                            onClick={() => handleRemove(doc.id, doc.file_path)}
                                            disabled={isRemoving === doc.id}
                                            aria-label="Excluir documento"
                                            className="text-slate-400 hover:text-red-500 transition-colors cursor-pointer p-1.5 rounded-md hover:bg-red-50 disabled:opacity-50"
                                        >
                                            {isRemoving === doc.id ? (
                                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                                <Trash2 className="w-3.5 h-3.5" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Tooltip inline */}
            {!hasDocuments && tooltip && (
                <div className="mt-4 flex items-center gap-2 p-2.5 bg-slate-50/50 rounded-xl border border-slate-100/50">
                    <Info className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                    <span className="text-[10px] font-bold text-slate-500 leading-tight">{tooltip}</span>
                </div>
            )}

            {/* ── Relationship Picker Modal ── */}
            <AnimatePresence>
                {relationshipPickerOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
                        style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}
                        onClick={() => setRelationshipPickerOpen(false)}
                    >
                        <motion.div
                            initial={{ y: 40, opacity: 0, scale: 0.97 }}
                            animate={{ y: 0, opacity: 1, scale: 1 }}
                            exit={{ y: 40, opacity: 0, scale: 0.97 }}
                            transition={{ type: 'spring', stiffness: 360, damping: 32 }}
                            className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-5">
                                <div>
                                    <h2 className="text-base font-black text-slate-900">A quem pertence este documento?</h2>
                                    <p className="text-xs text-slate-500 mt-0.5">Selecione o membro da família.</p>
                                </div>
                                <button onClick={() => setRelationshipPickerOpen(false)} className="text-slate-400 hover:text-slate-700 transition-colors">
                                    <XCircle className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="space-y-2 mb-6">
                                {RELATIONSHIP_OPTIONS.map(opt => (
                                    <button
                                        key={opt}
                                        onClick={() => setSelectedRelationship(opt)}
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border text-sm font-bold transition-all ${selectedRelationship === opt
                                            ? 'bg-sky-50 border-sky-400 text-sky-700'
                                            : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                            }`}
                                    >
                                        <UserCircle2 className={`w-4 h-4 ${selectedRelationship === opt ? 'text-sky-500' : 'text-slate-400'}`} />
                                        {opt}
                                        {selectedRelationship === opt && <Check className="w-4 h-4 ml-auto text-sky-500" />}
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={confirmRelationshipAndSelectFile}
                                className="w-full py-3.5 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-sky-600 transition-all font-bold"
                            >
                                Continuar → Selecionar Arquivo
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

function CategoryStatusBadge({ status }: { status: 'pending' | 'under_review' | 'approved' }) {
    switch (status) {
        case 'approved':
            return (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-black uppercase tracking-wider">Aprovado</span>
                </div>
            )
        case 'under_review':
            return (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 rounded-full border border-amber-100">
                    <Clock className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-black uppercase tracking-wider">Em Revisão</span>
                </div>
            )
        default:
            return (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-500 rounded-full border border-slate-200">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-black uppercase tracking-wider">Pendente</span>
                </div>
            )
    }
}

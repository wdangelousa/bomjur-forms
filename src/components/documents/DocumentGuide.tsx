'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    X,
    Lightbulb,
    CheckCircle2,
    Info,
    Sparkles,
    BookOpen
} from 'lucide-react'
import { COLORS } from '@/lib/design-system'
import { DOCUMENT_GUIDES, GuideContent } from '@/lib/documents/document-guides'

interface DocumentGuideProps {
    isOpen: boolean
    onClose: () => void
    category: string
    lang?: 'pt' | 'en'
}

export default function DocumentGuide({
    isOpen,
    onClose,
    category,
    lang = 'pt'
}: DocumentGuideProps) {
    const guide = DOCUMENT_GUIDES[category] || DOCUMENT_GUIDES['passport'] // Fallback
    const content: GuideContent = guide[lang]

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[300]"
                    />

                    {/* Content Drawer/Modal */}
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-[#0D1117] rounded-t-[32px] border-t border-white/10 shadow-2xl z-[301] overflow-hidden flex flex-col max-h-[90vh]"
                    >
                        {/* Header */}
                        <div className="p-6 pb-2 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-lime-500/10 flex items-center justify-center">
                                    <BookOpen className="w-5 h-5 text-lime-500" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-white">Guia de Preparação</h3>
                                    <p className="text-[10px] text-dim font-bold uppercase tracking-widest">Documento: {category.replace('_', ' ')}</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-full bg-white/5 text-dim hover:text-white transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-8 overflow-y-auto pb-12">
                            {/* Step 1: How to prepare */}
                            <section className="space-y-3">
                                <div className="flex items-center gap-2 text-lime-500">
                                    <Info className="w-4 h-4" />
                                    <h4 className="text-xs font-black uppercase tracking-wider">Como preparar</h4>
                                </div>
                                <p className="text-sm text-white/80 leading-relaxed font-medium">
                                    {content.howToPrepare}
                                </p>
                            </section>

                            {/* Step 2: Requirements */}
                            <section className="space-y-4">
                                <div className="flex items-center gap-2 text-blue-400">
                                    <CheckCircle2 className="w-4 h-4" />
                                    <h4 className="text-xs font-black uppercase tracking-wider">Requisitos Obrigatórios</h4>
                                </div>
                                <div className="grid gap-3">
                                    {content.requirements.map((req, idx) => (
                                        <div key={idx} className="flex items-start gap-3 p-3 rounded-2xl bg-white/5 border border-white/5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                                            <span className="text-xs text-white/70 font-medium">{req}</span>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* Step 3: AI Tip */}
                            <section className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <Sparkles className="w-12 h-12 text-purple-500" />
                                </div>
                                <div className="relative z-10">
                                    <div className="flex items-center gap-2 text-purple-400 mb-2">
                                        <Lightbulb className="w-4 h-4" />
                                        <h4 className="text-[10px] font-black uppercase tracking-widest">Dica da nossa IA</h4>
                                    </div>
                                    <p className="text-xs text-purple-200/80 leading-relaxed font-medium italic">
                                        "{content.aiTip}"
                                    </p>
                                </div>
                            </section>
                        </div>

                        {/* Footer Action */}
                        <div className="p-6 pt-0">
                            <button
                                onClick={onClose}
                                className="w-full py-4 rounded-2xl bg-lime-500 text-black font-black text-sm uppercase tracking-widest shadow-lg shadow-lime-500/20 active:scale-[0.98] transition-all"
                            >
                                Entendi, Vou Preparar
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}

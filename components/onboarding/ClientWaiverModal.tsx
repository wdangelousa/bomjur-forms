'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldAlert, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface ClientWaiverModalProps {
    isOpen: boolean
    userId: string
    onAccept: () => void
}

export default function ClientWaiverModal({ isOpen, userId, onAccept }: ClientWaiverModalProps) {
    const [accepted, setAccepted] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const supabase = createClient()

    if (!isOpen) return null

    const handleAcceptTerms = async () => {
        if (!accepted) return

        setIsSubmitting(true)
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    has_accepted_waiver: true,
                    waiver_accepted_at: new Date().toISOString()
                })
                .eq('id', userId)

            if (error) throw error
            onAccept()
        } catch (error) {
            console.error('Error accepting waiver:', error)
            alert('Ocorreu um erro ao salvar o seu aceite. Por favor, tente novamente.')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="p-6 sm:p-8 border-b border-slate-100 bg-slate-50 flex items-center gap-4 shrink-0">
                        <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 shrink-0">
                            <ShieldAlert className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 tracking-tight">Termos e Isenção de Responsabilidade</h2>
                            <p className="text-sm font-medium text-slate-500 mt-1">Aviso Legal Importante (Waiver)</p>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 sm:p-8 overflow-y-auto text-sm text-slate-600 space-y-5 leading-relaxed bg-white flex-1">
                        <p className="font-bold text-slate-900">
                            Prezado(a) Cliente, antes de prosseguir para o sistema, é obrigatório ler e concordar com os termos abaixo:
                        </p>

                        <div className="space-y-4">
                            <div className="flex gap-3">
                                <span className="font-black text-slate-400 mt-0.5">1.</span>
                                <div>A <span className="font-bold text-slate-800">Proexpand atua exclusivamente na preparação administrativa</span> de documentos e formulários imigratórios. A Proexpand <span className="font-bold text-slate-800 underline decoration-orange-300 decoration-2 underline-offset-2">não é um escritório de advocacia</span> e nenhum membro de sua equipe atua como seu advogado para este processo.</div>
                            </div>

                            <div className="flex gap-3">
                                <span className="font-black text-slate-400 mt-0.5">2.</span>
                                <div>A <span className="font-bold text-slate-800">manutenção do status imigratório</span> (legalidade da estadia nos Estados Unidos, renovações, prazos) é de <span className="font-bold text-slate-800">responsabilidade total e exclusiva do cliente</span>.</div>
                            </div>

                            <div className="flex gap-3">
                                <span className="font-black text-slate-400 mt-0.5">3.</span>
                                <div>Recomenda-se fortemente a consulta a um advogado de imigração para aconselhamento legal. Ao utilizar os serviços administrativos, <span className="font-bold text-slate-800">o cliente isenta a Proexpand</span> de quaisquer responsabilidades sobre o mérito legal de sua petição, atrasos governamentais ou o resultado final do seu processo junto ao USCIS.</div>
                            </div>

                            <div className="flex gap-3">
                                <span className="font-black text-slate-400 mt-0.5">4.</span>
                                <div>Os formulários serão preenchidos <span className="font-bold text-slate-800">unicamente com base nas informações e documentos fornecidos pelo cliente</span>. O cliente assume total responsabilidade pela veracidade, precisão e integridade de todos os dados informados.</div>
                            </div>

                            <div className="flex gap-3">
                                <span className="font-black text-slate-400 mt-0.5">5.</span>
                                <div>As <span className="font-bold text-slate-800">taxas governamentais do USCIS não são reembolsáveis</span> em nenhuma hipótese. Respostas a Pedidos de Evidência (RFE) ou Notificações de Intenção de Negação (NOID) não estão cobertas por este serviço administrativo e exigirão representação legal às custas exclusivas do cliente.</div>
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="p-6 sm:p-8 bg-slate-50 border-t border-slate-100 shrink-0 space-y-6">
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${accepted ? 'bg-sky-500 border-sky-500 text-white' : 'bg-white border-slate-300 text-transparent group-hover:border-sky-400'}`}>
                                <Check className="w-4 h-4" />
                            </div>
                            <input
                                type="checkbox"
                                className="hidden"
                                checked={accepted}
                                onChange={(e) => setAccepted(e.target.checked)}
                            />
                            <span className="text-sm font-bold text-slate-700 select-none">
                                Li, compreendi e concordo com todas as cláusulas acima.
                            </span>
                        </label>

                        <button
                            onClick={handleAcceptTerms}
                            disabled={!accepted || isSubmitting}
                            className={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-sm transition-all flex items-center justify-center gap-2 ${accepted && !isSubmitting
                                    ? 'bg-sky-500 hover:bg-sky-600 text-white shadow-lg shadow-sky-500/25 active:scale-[0.99]'
                                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                }`}
                        >
                            {isSubmitting ? (
                                <div className="w-5 h-5 border-2 border-white/80 border-t-transparent rounded-full animate-spin" />
                            ) : (
                                'Aceitar Termos e Acessar Dashboard'
                            )}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    )
}

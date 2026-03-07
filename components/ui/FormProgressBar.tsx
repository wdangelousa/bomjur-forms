'use client'

import { motion } from 'framer-motion'
import { CheckCircle2, Zap } from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface FormProgressBarProps {
    currentStep: number
    totalSteps: number
    completionPercentage: number
    formName?: string // Ex: "I-140" ou "I-485"
}

// ─── Textos de encorajamento por faixa de progresso ──────────────────────────
function getMensagemEncorajamento(pct: number, formName: string): string {
    if (pct === 0)  return `Vamos começar! Seu ${formName} está pronto para ser preenchido.`
    if (pct < 20)   return `Ótimo início! Cada campo preenchido nos aproxima da aprovação.`
    if (pct < 40)   return `Você já completou ${pct}% do seu ${formName}. Continue assim!`
    if (pct < 60)   return `Mais da metade está por vir — você está indo muito bem! ${pct}% concluído.`
    if (pct < 80)   return `Incrível! ${pct}% do ${formName} já está pronto. A reta final!`
    if (pct < 100)  return `Quase lá! Só faltam mais alguns campos para completar seu ${formName}.`
    return `Parabéns! Seu ${formName} está 100% preenchido e pronto para revisão.`
}

// ─── Componente ───────────────────────────────────────────────────────────────
export default function FormProgressBar({
    currentStep,
    totalSteps,
    completionPercentage,
    formName = 'I-140',
}: FormProgressBarProps) {
    const pct = Math.min(100, Math.max(0, Math.round(completionPercentage)))
    const isConcluido = pct === 100

    return (
        <div className="w-full bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            {/* ── Cabeçalho ── */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    {isConcluido ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                        <Zap className="w-4 h-4 text-sky-500" />
                    )}
                    <span className="text-xs font-black uppercase tracking-widest text-slate-500">
                        Progresso — {formName}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Etapa {currentStep} de {totalSteps}
                    </span>
                    <span className={`text-sm font-black tabular-nums ${isConcluido ? 'text-emerald-500' : 'text-sky-600'}`}>
                        {pct}%
                    </span>
                </div>
            </div>

            {/* ── Trilha de progresso ── */}
            <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden">
                <motion.div
                    className={`h-full rounded-full ${isConcluido
                        ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                        : 'bg-gradient-to-r from-sky-400 to-blue-500'
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                />
            </div>

            {/* ── Indicadores de etapa ── */}
            <div className="flex justify-between mt-2 px-0.5">
                {Array.from({ length: totalSteps }).map((_, i) => {
                    const etapaConcluida = i + 1 < currentStep
                    const etapaAtual = i + 1 === currentStep
                    return (
                        <div
                            key={i}
                            className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                                etapaConcluida
                                    ? 'bg-sky-500'
                                    : etapaAtual
                                    ? 'bg-sky-400 ring-2 ring-sky-200'
                                    : 'bg-slate-300'
                            }`}
                        />
                    )
                })}
            </div>

            {/* ── Mensagem de encorajamento ── */}
            <p className="text-slate-600 font-medium text-sm mt-3 leading-snug">
                {getMensagemEncorajamento(pct, formName)}
            </p>
        </div>
    )
}

'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    ChevronRight,
    ChevronLeft,
    CheckCircle2,
    User,
    FileText,
    Rocket,
    Camera,
    Languages
} from 'lucide-react'
import { COLORS } from '@/lib/design-system'

interface OnboardingWizardProps {
    caseId: string
    clientName: string
    caseType: string
}

export default function OnboardingWizard({ caseId, clientName, caseType }: OnboardingWizardProps) {
    const [step, setStep] = useState(0)
    const [direction, setDirection] = useState(0)

    const steps = [
        {
            id: 'welcome',
            title: 'Bem-vindo ao Bomjur!',
            icon: <Rocket className="w-8 h-8" />,
            content: (
                <div className="space-y-4 text-center">
                    <div className="flex justify-center mb-6">
                        <div
                            className="w-20 h-20 rounded-full flex items-center justify-center"
                            style={{ background: COLORS.limeGlow, border: `2px solid ${COLORS.lime}` }}
                        >
                            <Rocket className="w-10 h-10" style={{ color: COLORS.lime }} />
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold" style={{ color: COLORS.text }}>
                        Olá, {clientName}! 👋
                    </h2>
                    <p className="text-sm leading-relaxed" style={{ color: COLORS.textMuted }}>
                        Seu caso <span className="font-bold text-white">{caseType}</span> está pronto para começar.
                        Preparamos um fluxo simples para você enviar seus dados e documentos com segurança.
                    </p>
                    <div className="mt-8 p-4 rounded-xl border" style={{ background: `${COLORS.blue}11`, borderColor: `${COLORS.blue}33` }}>
                        <p className="text-xs font-medium" style={{ color: COLORS.blue }}>
                            💡 Dica: Você pode completar tudo pelo celular e usar a câmera para tirar fotos dos documentos!
                        </p>
                    </div>
                </div>
            )
        },
        {
            id: 'profile',
            title: 'Dados Pessoais',
            icon: <User className="w-8 h-8" />,
            content: (
                <div className="space-y-6">
                    <p className="text-sm" style={{ color: COLORS.textMuted }}>
                        Confirme seus dados básicos para iniciarmos o preenchimento dos formulários oficiais.
                    </p>
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider" style={{ color: COLORS.textDim }}>
                                Nome Completo
                            </label>
                            <input
                                type="text"
                                defaultValue={clientName}
                                className="w-full bg-[#0D1117] border rounded-xl px-4 py-3 text-sm transition-all focus:outline-none focus:ring-2"
                                style={{ borderColor: COLORS.border, color: COLORS.text }}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: COLORS.textDim }}>
                                    Data de Nascimento
                                </label>
                                <input
                                    type="date"
                                    className="w-full bg-[#0D1117] border rounded-xl px-4 py-3 text-sm focus:outline-none"
                                    style={{ borderColor: COLORS.border, color: COLORS.text }}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: COLORS.textDim }}>
                                    País de Origem
                                </label>
                                <select
                                    className="w-full bg-[#0D1117] border rounded-xl px-4 py-3 text-sm focus:outline-none appearance-none"
                                    style={{ borderColor: COLORS.border, color: COLORS.text }}
                                >
                                    <option value="BR">Brasil</option>
                                    <option value="US">Estados Unidos</option>
                                    <option value="PT">Portugal</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 'documents',
            title: 'Documentos Necessários',
            icon: <FileText className="w-8 h-8" />,
            content: (
                <div className="space-y-6">
                    <p className="text-sm" style={{ color: COLORS.textMuted }}>
                        Para este tipo de caso, você precisará providenciar os seguintes documentos:
                    </p>
                    <div className="space-y-3">
                        {[
                            "Passaporte (página de dados)",
                            "Certidão de Nascimento",
                            "Foto 2x2 (fundo branco)",
                            "Cópia do Visto Atual"
                        ].map((doc, i) => (
                            <div
                                key={i}
                                className="flex items-center gap-3 p-4 rounded-xl border transition-all"
                                style={{ background: COLORS.card, borderColor: COLORS.border }}
                            >
                                <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                                    style={{ background: `${COLORS.lime}22` }}
                                >
                                    <CheckCircle2 className="w-4 h-4" style={{ color: COLORS.lime }} />
                                </div>
                                <span className="text-sm font-medium" style={{ color: COLORS.text }}>{doc}</span>
                            </div>
                        ))}
                    </div>
                    <div className="p-4 rounded-xl flex gap-3" style={{ background: `${COLORS.cyan}11`, border: `1px solid ${COLORS.cyan}22` }}>
                        <Camera className="w-5 h-5 shrink-0" style={{ color: COLORS.cyan }} />
                        <p className="text-xs leading-relaxed" style={{ color: COLORS.cyan }}>
                            Após este onboarding, você poderá subir cada um desses arquivos direto do seu celular.
                        </p>
                    </div>
                </div>
            )
        }
    ]

    const nextStep = () => {
        if (step < steps.length - 1) {
            setDirection(1)
            setStep(s => s + 1)
        }
    }

    const prevStep = () => {
        if (step > 0) {
            setDirection(-1)
            setStep(s => s - 1)
        }
    }

    const currentStepData = steps[step]
    const progress = ((step + 1) / steps.length) * 100

    return (
        <div className="min-h-screen flex flex-col p-6 max-w-md mx-auto" style={{ background: COLORS.bg }}>
            {/* Header */}
            <header className="flex justify-between items-center mb-10">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: COLORS.lime }}>
                        <span className="font-black text-black text-lg">B</span>
                    </div>
                    <span className="text-lg font-bold tracking-tight" style={{ color: COLORS.text }}>Bomjur</span>
                </div>
                <button
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-bold uppercase tracking-wider"
                    style={{ borderColor: COLORS.border, color: COLORS.textMuted }}
                >
                    <Languages className="w-3.5 h-3.5" />
                    PT-BR
                </button>
            </header>

            {/* Progress Bar */}
            <div className="mb-10 space-y-2">
                <div className="flex justify-between items-end">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: COLORS.textDim }}>
                        Etapa {step + 1} de {steps.length}
                    </span>
                    <span className="text-xs font-black" style={{ color: COLORS.lime }}>{Math.round(progress)}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: COLORS.border }}>
                    <motion.div
                        className="h-full rounded-full"
                        style={{ background: COLORS.lime }}
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ type: "spring", stiffness: 50, damping: 15 }}
                    />
                </div>
            </div>

            {/* Content */}
            <main className="flex-1 relative">
                <AnimatePresence mode="wait" custom={direction}>
                    <motion.div
                        key={step}
                        custom={direction}
                        initial={{ opacity: 0, x: direction > 0 ? 20 : -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: direction > 0 ? -20 : 20 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="w-full"
                    >
                        {currentStepData.content}
                    </motion.div>
                </AnimatePresence>
            </main>

            {/* Footer / Navigation */}
            <footer className="mt-12 flex gap-4">
                {step > 0 && (
                    <button
                        onClick={prevStep}
                        className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl border font-bold transition-all active:scale-[0.98]"
                        style={{ background: 'transparent', borderColor: COLORS.border, color: COLORS.textMuted }}
                    >
                        <ChevronLeft className="w-5 h-5" />
                        Voltar
                    </button>
                )}
                <button
                    onClick={nextStep}
                    className="flex-[2] flex items-center justify-center gap-2 py-4 rounded-2xl font-bold transition-all active:scale-[0.98] shadow-lg shadow-[#84CC16]/20"
                    style={{ background: COLORS.lime, color: COLORS.bg }}
                >
                    {step === steps.length - 1 ? 'Começar Caso' : 'Continuar'}
                    <ChevronRight className="w-5 h-5" />
                </button>
            </footer>
        </div>
    )
}

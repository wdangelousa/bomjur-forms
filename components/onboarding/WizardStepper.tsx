'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { COLORS } from '@/lib/design-system'

interface WizardStepperProps {
    currentStep: number
    totalSteps: number
}

export default function WizardStepper({ currentStep, totalSteps }: WizardStepperProps) {
    const progress = (currentStep / totalSteps) * 100

    return (
        <div className="w-full space-y-3">
            <div className="flex justify-between items-end">
                <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        Progresso do Onboarding
                    </span>
                    <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-slate-900">
                            Etapa {currentStep}
                        </span>
                        <span className="text-sm font-medium mt-1 text-slate-500">
                            de {totalSteps}
                        </span>
                    </div>
                </div>
                <div className="text-right">
                    <span className="text-lg font-black" style={{ color: COLORS.primary }}>
                        {Math.round(progress)}%
                    </span>
                </div>
            </div>

            <div
                className="h-2 w-full rounded-full overflow-hidden relative bg-slate-100 border border-slate-200"
            >
                {/* Background glow track */}
                <div
                    className="absolute inset-0 opacity-10"
                    style={{ background: `linear-gradient(90deg, transparent, ${COLORS.primary}, transparent)` }}
                />

                <motion.div
                    className="h-full rounded-full relative z-10"
                    style={{
                        background: `linear-gradient(90deg, ${COLORS.primaryDark}, ${COLORS.primary})`,
                        boxShadow: `0 0 8px ${COLORS.primary}44`
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ type: "spring", stiffness: 40, damping: 15 }}
                />
            </div>

            {/* Step Indicators */}
            <div className="flex justify-between px-1">
                {Array.from({ length: totalSteps }).map((_, i) => (
                    <div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full transition-all duration-500"
                        style={{
                            background: i < currentStep ? COLORS.primary : COLORS.border,
                            transform: i + 1 === currentStep ? 'scale(1.3)' : 'scale(1)',
                            boxShadow: i + 1 === currentStep ? `0 0 6px ${COLORS.primary}` : 'none'
                        }}
                    />
                ))}
            </div>
        </div>
    )
}

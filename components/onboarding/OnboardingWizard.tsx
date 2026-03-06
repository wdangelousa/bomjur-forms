'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    ChevronRight,
    ChevronLeft,
    CheckCircle2,
    User,
    MapPin,
    Rocket,
    Languages,
    ShieldCheck
} from 'lucide-react'
import { COLORS } from '@/lib/design-system'
import { createClient } from '@/lib/supabase/client'
import AutoSaveIndicator, { SaveStatus } from './AutoSaveIndicator'
import WizardStepper from './WizardStepper'

interface OnboardingWizardProps {
    caseId: string
    clientName: string
    caseType: string
    initialData?: {
        personal_data?: any
        address_data?: any
    }
}

export default function OnboardingWizard({
    caseId,
    clientName,
    caseType,
    initialData
}: OnboardingWizardProps) {
    const [step, setStep] = useState(1)
    const [direction, setDirection] = useState(0)
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
    const [validationError, setValidationError] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Data States
    const [personalData, setPersonalData] = useState(initialData?.personal_data || {
        full_name: clientName,
        birth_date: '',
        country_origin: 'BR'
    })
    const [addressData, setAddressData] = useState(initialData?.address_data || {
        street: '',
        city: '',
        state: '',
        zip_code: ''
    })

    const supabase = createClient()

    // Auto-save function
    const saveToSupabase = useCallback(async (pData: any, aData: any) => {
        setSaveStatus('saving')
        try {
            const { error } = await supabase
                .from('cases')
                .update({
                    personal_data: pData,
                    address_data: aData,
                    updated_at: new Date().toISOString()
                })
                .eq('id', caseId)

            if (error) throw error
            setSaveStatus('saved')

            // Return to idle after 3 seconds
            setTimeout(() => setSaveStatus('idle'), 3000)
        } catch (err) {
            console.error('Error saving data:', err)
            setSaveStatus('error')
        }
    }, [caseId, supabase])

    // Effect for Debounced Auto-save
    useEffect(() => {
        const timer = setTimeout(() => {
            if (saveStatus === 'idle' || saveStatus === 'error') {
                saveToSupabase(personalData, addressData)
            }
        }, 1000)

        return () => clearTimeout(timer)
    }, [personalData, addressData, saveToSupabase])

    // Clear error on input change
    useEffect(() => {
        if (validationError) setValidationError(null)
    }, [personalData, addressData])

    const nextStep = async () => {
        setValidationError(null)

        if (step === 2) {
            if (!personalData.full_name?.trim() || !personalData.birth_date) {
                setValidationError('Por favor, preencha o Nome Completo e a Data de Nascimento.')
                return
            }
        }

        if (step === 3) {
            if (!addressData.street?.trim() || !addressData.city?.trim() || !addressData.state?.trim() || !addressData.zip_code?.trim()) {
                setValidationError('Por favor, preencha todos os campos do endereço.')
                return
            }

            setIsSubmitting(true)
            try {
                const { error } = await supabase
                    .from('cases')
                    .update({
                        personal_data: personalData,
                        address_data: addressData,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', caseId)

                if (error) throw error
                setSaveStatus('saved')
            } catch (err) {
                console.error('Error saving final data:', err)
                setValidationError('Erro ao salvar os dados. Tente novamente.')
                setIsSubmitting(false)
                return
            }
            setIsSubmitting(false)
        }

        if (step < 4) {
            setDirection(1)
            setStep(s => s + 1)
        }
    }

    const prevStep = () => {
        if (step > 1) {
            setDirection(-1)
            setStep(s => s - 1)
        }
    }

    const steps = [
        {
            id: 1,
            title: 'Boas-vindas',
            content: (
                <div className="space-y-6 text-center py-4">
                    <div className="flex justify-center">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-24 h-24 rounded-full flex items-center justify-center bg-slate-50 border-2 border-slate-200"
                        >
                            <Rocket className="w-12 h-12 text-slate-400" />
                        </motion.div>
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-3xl font-bold tracking-tight" style={{ color: COLORS.text }}>
                            Vamos começar!
                        </h2>
                        <p className="text-sm leading-relaxed px-4 text-slate-500">
                            Olá, <span className="text-slate-900 font-bold">{clientName}</span>.
                            Estamos prontos para processar seu caso de <span className="text-slate-900 font-bold">{caseType}</span>.
                            Siga os passos abaixo para completar seu perfil.
                        </p>
                    </div>
                    <div className="p-4 rounded-2xl border bg-white text-left flex gap-3" style={{ borderColor: COLORS.border }}>
                        <ShieldCheck className="w-5 h-5 shrink-0" style={{ color: COLORS.primary }} />
                        <p className="text-xs" style={{ color: COLORS.textDim }}>
                            Seus dados são protegidos por criptografia de ponta a ponta e usados apenas para fins legais.
                        </p>
                    </div>
                </div>
            )
        },
        {
            id: 2,
            title: 'Dados Pessoais',
            content: (
                <div className="space-y-6 py-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                            <User className="w-5 h-5" style={{ color: COLORS.primary }} />
                        </div>
                        <h3 className="text-lg font-bold" style={{ color: COLORS.text }}>Informações Básicas</h3>
                    </div>
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider pl-1" style={{ color: COLORS.textDim }}>
                                Nome Completo (como no passaporte)
                            </label>
                            <input
                                type="text"
                                value={personalData.full_name}
                                onChange={(e) => setPersonalData({ ...personalData, full_name: e.target.value })}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                                style={{ color: COLORS.text }}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-wider pl-1" style={{ color: COLORS.textDim }}>
                                    Nascimento
                                </label>
                                <input
                                    type="date"
                                    value={personalData.birth_date}
                                    onChange={(e) => setPersonalData({ ...personalData, birth_date: e.target.value })}
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                                    style={{ color: COLORS.text }}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-wider pl-1" style={{ color: COLORS.textDim }}>
                                    País de Origem
                                </label>
                                <select
                                    value={personalData.country_origin}
                                    onChange={(e) => setPersonalData({ ...personalData, country_origin: e.target.value })}
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 appearance-none"
                                    style={{ color: COLORS.text }}
                                >
                                    <option value="BR">Brasil</option>
                                    <option value="US">Estados Unidos</option>
                                    <option value="PT">Portugal</option>
                                </select>
                            </div>
                        </div>
                        {validationError && step === 2 && (
                            <p className="text-red-500 text-sm font-medium mt-2 animate-in fade-in">{validationError}</p>
                        )}
                    </div>
                </div>
            )
        },
        {
            id: 3,
            title: 'Endereço Atual',
            content: (
                <div className="space-y-6 py-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                            <MapPin className="w-5 h-5" style={{ color: COLORS.primary }} />
                        </div>
                        <h3 className="text-lg font-bold" style={{ color: COLORS.text }}>Onde você mora?</h3>
                    </div>
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider pl-1" style={{ color: COLORS.textDim }}>
                                Rua e Número
                            </label>
                            <input
                                type="text"
                                value={addressData.street}
                                onChange={(e) => setAddressData({ ...addressData, street: e.target.value })}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                                style={{ color: COLORS.text }}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-wider pl-1" style={{ color: COLORS.textDim }}>
                                    Cidade
                                </label>
                                <input
                                    type="text"
                                    value={addressData.city}
                                    onChange={(e) => setAddressData({ ...addressData, city: e.target.value })}
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                                    style={{ color: COLORS.text }}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-wider pl-1" style={{ color: COLORS.textDim }}>
                                    Estado / Província
                                </label>
                                <input
                                    type="text"
                                    value={addressData.state}
                                    onChange={(e) => setAddressData({ ...addressData, state: e.target.value })}
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                                    style={{ color: COLORS.text }}
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider pl-1" style={{ color: COLORS.textDim }}>
                                CEP / Zip Code
                            </label>
                            <input
                                type="text"
                                value={addressData.zip_code}
                                onChange={(e) => setAddressData({ ...addressData, zip_code: e.target.value })}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                                style={{ color: COLORS.text }}
                            />
                        </div>
                        {validationError && step === 3 && (
                            <p className="text-red-500 text-sm font-medium mt-2 animate-in fade-in">{validationError}</p>
                        )}
                    </div>
                </div>
            )
        },
        {
            id: 4,
            title: 'Confirmação',
            content: (
                <div className="space-y-8 text-center py-4">
                    <div className="flex justify-center">
                        <div className="relative">
                            <motion.div
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.2 }}
                                className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center border-2 border-green-500"
                            >
                                <CheckCircle2 className="w-12 h-12 text-green-500" />
                            </motion.div>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: [0, 1, 0] }}
                                transition={{ repeat: Infinity, duration: 2 }}
                                className="absolute inset-0 rounded-full border-2 border-green-500"
                            />
                        </div>
                    </div>
                    <div className="space-y-3">
                        <h2 className="text-2xl font-bold" style={{ color: COLORS.text }}>Tudo Pronto!</h2>
                        <p className="text-sm px-6" style={{ color: COLORS.textMuted }}>
                            Seus dados foram salvos automaticamente. Agora você pode prosseguir para o painel de documentos.
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-4">
                        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm text-left">
                            <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Perfil</p>
                            <p className="text-xs font-medium truncate text-slate-700">{personalData.full_name}</p>
                        </div>
                        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm text-left">
                            <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Localização</p>
                            <p className="text-xs font-medium truncate text-slate-700">{addressData.city}, {addressData.state}</p>
                        </div>
                    </div>
                </div>
            )
        }
    ]

    return (
        <div className="min-h-screen flex flex-col p-6 max-w-4xl mx-auto relative overflow-hidden" style={{ background: COLORS.bg }}>
            {/* Background Decorative Elements */}
            <div className="absolute top-[-10%] right-[-10%] w-64 h-64 rounded-full blur-[120px] opacity-10 pointer-events-none" style={{ background: COLORS.primary }} />
            <div className="absolute bottom-[-10%] left-[-10%] w-64 h-64 rounded-full blur-[120px] opacity-10 pointer-events-none" style={{ background: COLORS.accent }} />

            {/* Header */}
            <header className="flex justify-between items-center mb-10 relative z-10 px-4">
                <div className="flex items-center gap-2.5">
                    <img src="/proexpand-logo.png" alt="Proexpand" className="h-10 w-auto" />
                </div>

                <div className="flex items-center gap-3">
                    <AutoSaveIndicator status={saveStatus} />
                    <button className="p-2 rounded-full border bg-white border-slate-200 shadow-sm text-slate-500">
                        <Languages className="w-4 h-4" />
                    </button>
                </div>
            </header>

            {/* Progress Stepper */}
            <div className="mb-8 relative z-10">
                <WizardStepper currentStep={step} totalSteps={4} />
            </div>

            {/* Main Content Area */}
            <main className="flex-1 relative z-10 flex flex-col">
                <AnimatePresence mode="wait" custom={direction}>
                    <motion.div
                        key={step}
                        custom={direction}
                        initial={{ opacity: 0, x: direction > 0 ? 50 : -50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: direction > 0 ? -50 : 50 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="w-full flex-1 flex flex-col"
                    >
                        {steps.find(s => s.id === step)?.content}
                    </motion.div>
                </AnimatePresence>
            </main>

            {/* Navigation Controls */}
            <footer className="mt-8 flex gap-4 relative z-10 pb-4">
                {step > 1 && (
                    <button
                        onClick={prevStep}
                        className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl border border-slate-200 bg-white font-bold transition-all active:scale-[0.98] text-slate-600 shadow-sm hover:bg-slate-50"
                    >
                        <ChevronLeft className="w-5 h-5" />
                        Retroceder
                    </button>
                )}

                <button
                    onClick={step === 4 ? () => window.location.href = `/case/${caseId}/documents` : nextStep}
                    disabled={isSubmitting}
                    className={`flex-[2] flex items-center justify-center gap-2 py-4 rounded-2xl font-bold transition-all shadow-xl text-white ${isSubmitting ? 'opacity-70 cursor-not-allowed' : 'active:scale-[0.98]'}`}
                    style={{
                        background: COLORS.primary,
                        boxShadow: `0 8px 24px ${COLORS.primary}33`
                    }}
                >
                    {isSubmitting ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Salvando...
                        </>
                    ) : (
                        <>
                            {step === 4 ? 'Aceder Documentos' : 'Próxima Etapa'}
                            <ChevronRight className="w-5 h-5" />
                        </>
                    )}
                </button>
            </footer>
        </div>
    )
}

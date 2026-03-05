'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { loginWithPassword } from './actions'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import {
    ShieldCheck, ArrowRight, Mail, Lock, CheckCircle2,
    Sparkles, Send, AlertTriangle, Loader2
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// ── Submit button for password form (Server Action) ──
function PasswordSubmitButton() {
    const { pending } = useFormStatus()
    return (
        <button
            type="submit"
            disabled={pending}
            className="w-full py-4 bg-slate-900 hover:bg-black text-white font-black rounded-2xl transition-all shadow-[0_10px_20px_rgba(0,0,0,0.15)] flex items-center justify-center gap-3 active:scale-[0.98] disabled:bg-slate-300 disabled:shadow-none overflow-hidden relative group"
        >
            <span className="relative z-10">
                {pending ? 'Verificando credenciais...' : 'Entrar na Plataforma'}
            </span>
            {!pending && (
                <ArrowRight size={20} strokeWidth={3} className="relative z-10 group-hover:translate-x-1 transition-transform" />
            )}
            <div className="absolute inset-0 bg-emerald-500 translate-y-full group-hover:translate-y-0 transition-transform duration-300 -z-10" />
        </button>
    )
}

// ── Página de Login ──
export default function LoginPage() {
    const searchParams = useSearchParams()
    const [passwordState, passwordAction] = useActionState(loginWithPassword, { error: null })

    return (
        <div className="flex flex-col flex-1 items-center justify-center min-h-[calc(100vh-80px)] w-full relative overflow-hidden bg-slate-50 py-16 px-4 font-sans">

            {/* Decorative blurs */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
                <div className="absolute top-0 right-0 w-[40vw] h-[40vh] bg-emerald-100/40 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3" />
                <div className="absolute bottom-0 left-0 w-[40vw] h-[40vh] bg-blue-100/40 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/3" />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="w-full max-w-xl mx-auto z-10"
            >
                {/* Status pill */}
                <div className="flex justify-center mb-8">
                    <div className="bg-white/80 backdrop-blur-md px-5 py-2 rounded-full border border-slate-200 shadow-sm flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                            Acesso Seguro Ativo
                        </span>
                    </div>
                </div>

                {/* Card */}
                <div className="bg-white rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-slate-100 p-8 md:p-12 relative overflow-hidden">

                    {/* Logo */}
                    <div className="flex flex-col items-center mb-8">
                        <div className="mb-6 flex justify-center w-full">
                            <img
                                src="/proexpand-logo.png"
                                alt="Proexpand"
                                className="h-20 sm:h-24 w-auto mx-auto object-contain"
                            />
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2 text-center">
                            Acesse sua conta
                        </h1>
                        <p className="text-slate-400 text-sm font-medium text-center">
                            Utilize seu e-mail e senha de embarque
                        </p>
                    </div>

                    <div className="w-full">
                        {/* Server action error */}
                        {passwordState?.error && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm font-bold text-center"
                            >
                                {passwordState.error}
                            </motion.div>
                        )}

                        <form action={passwordAction} className="flex flex-col gap-6 w-full">
                            <div className="flex flex-col gap-2 relative z-20">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                    Seu E-mail
                                </label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors pointer-events-none">
                                        <Mail size={18} strokeWidth={2.5} />
                                    </div>
                                    <input
                                        type="email"
                                        name="email"
                                        required
                                        placeholder="seu@email.com"
                                        className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-bold text-slate-700 placeholder:text-slate-300 shadow-inner"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-2 relative z-20">
                                <div className="flex justify-between items-center px-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Senha de Embarque
                                    </label>
                                </div>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors pointer-events-none">
                                        <Lock size={18} strokeWidth={2.5} />
                                    </div>
                                    <input
                                        type="password"
                                        name="password"
                                        required
                                        placeholder="••••••••"
                                        className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-bold text-slate-700 placeholder:text-slate-300 shadow-inner"
                                    />
                                </div>
                            </div>

                            <div className="pt-2">
                                <PasswordSubmitButton />
                            </div>
                        </form>
                    </div>

                    {/* Footer badges */}
                    <div className="mt-10 pt-8 border-t border-slate-100 flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-slate-300">
                        <div className="flex items-center gap-1.5">
                            <ShieldCheck size={14} strokeWidth={3} />
                            <span className="text-[9px] font-black uppercase tracking-tighter">USCIS Ready</span>
                        </div>
                        <div className="hidden sm:block w-1 h-1 rounded-full bg-slate-200" />
                        <div className="flex items-center gap-1.5">
                            <Lock size={14} strokeWidth={3} />
                            <span className="text-[9px] font-black uppercase tracking-tighter">AES-256 Bit</span>
                        </div>
                        <div className="hidden sm:block w-1 h-1 rounded-full bg-slate-200" />
                        <div className="flex items-center gap-1.5">
                            <CheckCircle2 size={14} strokeWidth={3} />
                            <span className="text-[9px] font-black uppercase tracking-tighter">Verified</span>
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex flex-col items-center">
                    <p className="text-xs font-bold text-slate-400">
                        Problemas com o acesso?{' '}
                        <a href="#" className="text-slate-600 hover:text-emerald-600 underline underline-offset-4 decoration-slate-200 hover:decoration-emerald-200 transition-all">
                            Fale com seu consultor no WhatsApp
                        </a>
                    </p>
                </div>
            </motion.div>
        </div>
    )
}
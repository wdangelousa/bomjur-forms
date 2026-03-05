'use client'

import { useState, useEffect, useTransition } from 'react'
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
    const urlError = searchParams.get('error')

    // Se o cliente caiu cá por link expirado, abrir aba Magic Link automaticamente
    const [mode, setMode] = useState<'password' | 'magic'>(
        urlError === 'expired_link' ? 'magic' : 'password'
    )

    const [passwordState, passwordAction] = useActionState(loginWithPassword, { error: null })

    // State for Magic Link flow (client-side Supabase OTP)
    const [magicEmail, setMagicEmail] = useState('')
    const [magicLoading, setMagicLoading] = useState(false)
    const [magicSent, setMagicSent] = useState(false)
    const [magicError, setMagicError] = useState('')
    const [isPending, startTransition] = useTransition()

    // Pre-fill email from ?email= param (from WhatsApp deep link)
    useEffect(() => {
        const paramEmail = searchParams.get('email')
        if (paramEmail) setMagicEmail(paramEmail)
    }, [searchParams])

    const handleMagicLink = async () => {
        if (!magicEmail.trim() || !magicEmail.includes('@')) {
            setMagicError('Digite um e-mail válido')
            return
        }

        setMagicLoading(true)
        setMagicError('')

        const supabase = createClient()
        const redirectTo = `${window.location.origin}/auth/callback`

        const { error } = await supabase.auth.signInWithOtp({
            email: magicEmail.trim().toLowerCase(),
            options: { emailRedirectTo: redirectTo },
        })

        setMagicLoading(false)

        if (error) {
            setMagicError(`Erro: ${error.message}`)
        } else {
            setMagicSent(true)
        }
    }

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
                            Sistema Operacional Ativo
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
                            Plataforma Legal Tech de Alta Performance
                        </p>
                    </div>

                    {/* ── WhatsApp Expired Link Banner ── */}
                    <AnimatePresence>
                        {urlError === 'expired_link' && (
                            <motion.div
                                initial={{ opacity: 0, y: -12 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex gap-3"
                            >
                                <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-amber-800 text-sm font-black mb-1">Link expirado</p>
                                    <p className="text-amber-700 text-xs font-medium leading-relaxed">
                                        O link foi aberto pelo preview do WhatsApp e o token foi consumido.
                                        Digite o seu e-mail abaixo para receber um novo link de acesso.
                                    </p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* ── Mode Toggle ── */}
                    <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl mb-8">
                        <button
                            type="button"
                            onClick={() => setMode('password')}
                            className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${mode === 'password'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <Lock size={14} />
                            Com Senha
                        </button>
                        <button
                            type="button"
                            onClick={() => { setMode('magic'); setMagicSent(false) }}
                            className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${mode === 'magic'
                                ? 'bg-white text-emerald-600 shadow-sm'
                                : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <Sparkles size={14} />
                            Magic Link
                        </button>
                    </div>

                    <AnimatePresence mode="wait">
                        {mode === 'password' ? (
                            /* ──────────────── PASSWORD FORM ────────────────── */
                            <motion.div
                                key="password"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                                transition={{ duration: 0.2 }}
                            >
                                {/* Server action error */}
                                {passwordState?.error && (
                                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm font-bold text-center">
                                        {passwordState.error}
                                    </div>
                                )}

                                <form action={passwordAction} className="flex flex-col gap-6 w-full">
                                    <div className="flex flex-col gap-2 relative z-20">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                            E-mail Corporativo
                                        </label>
                                        <div className="relative group">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors pointer-events-none">
                                                <Mail size={18} strokeWidth={2.5} />
                                            </div>
                                            <input
                                                type="email"
                                                name="email"
                                                required
                                                placeholder="seu.nome@empresa.com"
                                                className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-bold text-slate-700 placeholder:text-slate-300 shadow-inner"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2 relative z-20">
                                        <div className="flex justify-between items-center px-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                Senha de Acesso
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
                                                placeholder="••••••••••••"
                                                className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-bold text-slate-700 placeholder:text-slate-300 shadow-inner"
                                            />
                                        </div>
                                    </div>

                                    <div className="pt-2">
                                        <PasswordSubmitButton />
                                    </div>
                                </form>

                                <p className="text-center text-xs font-medium text-slate-400 mt-6">
                                    É cliente e recebeu um link?{' '}
                                    <button
                                        onClick={() => setMode('magic')}
                                        className="text-emerald-600 font-black hover:underline"
                                    >
                                        Use o Magic Link
                                    </button>
                                </p>
                            </motion.div>
                        ) : (
                            /* ──────────────── MAGIC LINK FORM ────────────────── */
                            <motion.div
                                key="magic"
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                transition={{ duration: 0.2 }}
                            >
                                <AnimatePresence mode="wait">
                                    {magicSent ? (
                                        /* Success State */
                                        <motion.div
                                            key="sent"
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="text-center py-6 space-y-4"
                                        >
                                            <div className="text-5xl">📬</div>
                                            <h3 className="text-xl font-black text-slate-900">E-mail enviado!</h3>
                                            <p className="text-slate-500 text-sm font-medium leading-relaxed">
                                                Verifique a caixa de entrada de{' '}
                                                <span className="font-black text-slate-700">{magicEmail}</span>.
                                                Se não aparecer em 1 minuto, verifique o spam.
                                            </p>
                                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 font-bold flex items-start gap-2 text-left">
                                                <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-500" />
                                                Abra o link no seu navegador principal, não dentro do WhatsApp, para evitar que o token expire.
                                            </div>
                                            <button
                                                onClick={() => setMagicSent(false)}
                                                className="text-xs text-slate-400 hover:text-slate-600 font-bold underline pt-2"
                                            >
                                                Reenviar para outro e-mail
                                            </button>
                                        </motion.div>
                                    ) : (
                                        /* Input State */
                                        <motion.div key="input" className="space-y-5">
                                            <p className="text-sm text-slate-500 font-medium text-center leading-relaxed">
                                                Digite o seu e-mail e enviaremos um link seguro de acesso direto — sem senha.
                                            </p>

                                            <div className="flex flex-col gap-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                                    Seu E-mail
                                                </label>
                                                <div className="relative group">
                                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors pointer-events-none">
                                                        <Mail size={18} strokeWidth={2.5} />
                                                    </div>
                                                    <input
                                                        type="email"
                                                        value={magicEmail}
                                                        onChange={e => setMagicEmail(e.target.value)}
                                                        onKeyDown={e => e.key === 'Enter' && handleMagicLink()}
                                                        placeholder="seu@email.com"
                                                        className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-bold text-slate-700 placeholder:text-slate-300 shadow-inner"
                                                        autoFocus
                                                    />
                                                </div>
                                            </div>

                                            {magicError && (
                                                <p className="text-red-600 text-xs font-bold px-1">{magicError}</p>
                                            )}

                                            <button
                                                onClick={handleMagicLink}
                                                disabled={magicLoading || !magicEmail.trim()}
                                                className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black rounded-2xl transition-all shadow-[0_10px_20px_rgba(16,185,129,0.2)] flex items-center justify-center gap-3 active:scale-[0.98]"
                                            >
                                                {magicLoading ? (
                                                    <><Loader2 size={18} className="animate-spin" /> Enviando...</>
                                                ) : (
                                                    <><Send size={18} /> Enviar Link de Acesso</>
                                                )}
                                            </button>

                                            <p className="text-center text-xs font-medium text-slate-400 pt-2">
                                                É da equipe e tem senha?{' '}
                                                <button
                                                    onClick={() => setMode('password')}
                                                    className="text-slate-700 font-black hover:underline"
                                                >
                                                    Entrar com senha
                                                </button>
                                            </p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        )}
                    </AnimatePresence>

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
                            Fale com seu consultor
                        </a>
                    </p>
                </div>
            </motion.div>
        </div>
    )
}
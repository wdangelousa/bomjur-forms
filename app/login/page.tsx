'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { ShieldCheck, ArrowRight, Mail, Lock, CheckCircle2 } from 'lucide-react'
import { motion } from 'framer-motion'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)

        const { error: authErr } = await supabase.auth.signInWithPassword({ email, password })

        if (authErr) {
            alert('E-mail ou senha incorretos. Tente novamente.')
            setLoading(false)
            return
        }

        try {
            const res = await fetch('/api/auth/role')
            const data = await res.json()
            const role = data?.role

            if (role === 'super_admin') {
                router.push('/admin')
            } else if (role === 'team' || role === 'tenant_admin') {
                router.push('/team')
            } else if (role === 'client') {
                router.push('/dashboard')
            } else {
                router.push('/dashboard')
            }
        } catch {
            router.push('/dashboard') // Safety fallback - don't loop back to login
        }
    }

    return (
        <div className="flex flex-col flex-1 items-center justify-center min-h-[calc(100vh-80px)] w-full relative overflow-hidden bg-slate-50 py-16 px-4 font-sans">

            {/* Elementos Decorativos de Fundo */}
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
                {/* Status Bar Superior */}
                <div className="flex justify-center mb-8">
                    <div className="bg-white/80 backdrop-blur-md px-5 py-2 rounded-full border border-slate-200 shadow-sm flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Sistema Operacional Ativo</span>
                    </div>
                </div>

                {/* Card de Login Central */}
                <div className="bg-white rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-slate-100 p-8 md:p-12 relative overflow-hidden">

                    <div className="flex flex-col items-center mb-10 pb-2">
                        <div className="mb-6 flex justify-center w-full">
                            <img src="/proexpand-logo.png" alt="Proexpand" className="h-20 sm:h-24 w-auto mx-auto object-contain" />
                        </div>

                        <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2 text-center">Acesse sua conta</h1>
                        <p className="text-slate-400 text-sm font-medium text-center">Plataforma Legal Tech de Alta Performance</p>
                    </div>

                    <form onSubmit={handleLogin} className="flex flex-col gap-6 w-full">

                        <div className="flex flex-col gap-2 relative z-20">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">E-mail Corporativo</label>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center text-slate-300 group-focus-within:text-emerald-500 transition-colors pointer-events-none h-full">
                                    <Mail size={18} strokeWidth={2.5} />
                                </div>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="seu.nome@empresa.com"
                                    className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-bold text-slate-700 placeholder:text-slate-300 shadow-inner"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 relative z-20">
                            <div className="flex justify-between items-center px-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Senha de Acesso</label>
                                <button type="button" className="text-[10px] font-black text-emerald-600 hover:text-emerald-700 uppercase tracking-widest transition-colors">Esqueceu a senha?</button>
                            </div>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center text-slate-300 group-focus-within:text-emerald-500 transition-colors pointer-events-none h-full">
                                    <Lock size={18} strokeWidth={2.5} />
                                </div>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••••••"
                                    className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-bold text-slate-700 placeholder:text-slate-300 shadow-inner"
                                />
                            </div>
                        </div>

                        <div className="pt-4 relative z-20">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-4 bg-slate-900 hover:bg-black text-white font-black rounded-2xl transition-all shadow-[0_10px_20px_rgba(0,0,0,0.15)] flex items-center justify-center gap-3 active:scale-[0.98] disabled:bg-slate-300 disabled:shadow-none overflow-hidden relative group"
                            >
                                <span className="relative z-10">{loading ? 'Verificando Credenciais...' : 'Entrar na Plataforma'}</span>
                                {!loading && <ArrowRight size={20} strokeWidth={3} className="relative z-10 group-hover:translate-x-1 transition-transform" />}
                                <div className="absolute inset-0 bg-emerald-500 translate-y-full group-hover:translate-y-0 transition-transform duration-300 -z-10" />
                            </button>
                        </div>
                    </form>

                    <div className="mt-12 pt-8 border-t border-slate-100 flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-slate-300 relative z-10">
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

                <div className="mt-8 flex flex-col items-center gap-2">
                    <p className="text-xs font-bold text-slate-400">
                        Problemas com o acesso? <a href="#" className="text-slate-600 hover:text-emerald-600 underline underline-offset-4 decoration-slate-200 hover:decoration-emerald-200 transition-all">Fale com seu consultor</a>
                    </p>
                </div>
            </motion.div>
        </div>
    )
}
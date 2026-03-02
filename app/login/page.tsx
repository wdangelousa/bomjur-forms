'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { ShieldCheck, ArrowRight, Mail, Lock } from 'lucide-react'

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

            if (role === 'admin' || role === 'tenant_admin' || role === 'super_admin') {
                router.push('/admin')
            } else {
                router.push('/i485')
            }
        } catch {
            router.push('/admin')
        }
    }

    return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#fafafa] p-4 font-sans text-slate-900">

            {/* Logo e Título Superior */}
            <div className="flex flex-col items-center mb-8">
                <img src="/proexpand-logo.png" alt="Proexpand Brasil" className="h-12 w-auto mb-6" />
                <h1 className="text-2xl font-bold tracking-tight text-center">Acesse sua conta</h1>
                <p className="text-slate-500 text-sm mt-1">Plataforma de Tecnologia de Imigração</p>
            </div>

            {/* Cartão de Login */}
            <div className="w-full max-w-md bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-8 md:p-10">
                <form onSubmit={handleLogin} className="space-y-6">

                    {/* E-mail */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">
                            E-mail
                        </label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                            <input
                                type="email"
                                required
                                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-300"
                                placeholder="nome@exemplo.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Senha */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center px-1">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                Senha
                            </label>
                            <button type="button" className="text-xs font-bold text-emerald-600 hover:text-emerald-700">
                                Esqueceu?
                            </button>
                        </div>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                            <input
                                type="password"
                                required
                                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-300"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Botão de Entrar */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full group py-4 bg-slate-900 hover:bg-black text-white font-bold rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]"
                    >
                        {loading ? 'Verificando...' : 'Entrar na Plataforma'}
                        {!loading && <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />}
                    </button>
                </form>

                {/* Divisor */}
                <div className="relative my-8">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-100"></div>
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold">
                        <span className="bg-white px-4 text-slate-300">Ambiente Seguro</span>
                    </div>
                </div>

                {/* Badges de Segurança */}
                <div className="flex justify-between items-center opacity-40 grayscale hover:grayscale-0 transition-all">
                    <div className="flex flex-col items-center gap-1">
                        <ShieldCheck size={16} />
                        <span className="text-[8px] font-bold uppercase">USCIS Ready</span>
                    </div>
                    <div className="h-6 w-[1px] bg-slate-200"></div>
                    <div className="flex flex-col items-center gap-1">
                        <Lock size={16} />
                        <span className="text-[8px] font-bold uppercase">AES-256 Bit</span>
                    </div>
                    <div className="h-6 w-[1px] bg-slate-200"></div>
                    <div className="flex flex-col items-center gap-1">
                        <img src="/bomjur-logo.png" alt="Bomjur" className="h-3 w-auto" />
                        <span className="text-[8px] font-bold uppercase">Powered by</span>
                    </div>
                </div>
            </div>

            {/* Link para ajuda ou footer sutil */}
            <p className="mt-8 text-sm text-slate-400">
                Problemas com o acesso? <a href="#" className="text-slate-600 font-semibold hover:underline">Fale com seu consultor</a>
            </p>
        </div>
    )
}
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        // 1. Autentica com email/senha
        const { error: authErr } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (authErr) {
            setError('Email ou senha incorretos. Tente novamente.')
            setLoading(false)
            return
        }

        // 2. Busca o role via API segura (usa service role key, sem bloqueio de RLS)
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
            // Se a API falhar, tenta ir para admin e deixa o middleware decidir
            router.push('/admin')
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
            {/* Background elements for premium visual depth */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-100/40 blur-3xl"></div>
                <div className="absolute top-[60%] -right-[10%] w-[40%] h-[60%] rounded-full bg-slate-200/50 blur-3xl"></div>
            </div>

            <div className="w-full max-w-md bg-white/80 backdrop-blur-xl shadow-xl rounded-2xl p-10 border border-white/60 z-10">
                <div className="flex justify-center mb-8">
                    <img
                        src="/proexpandbrasil-logo.png"
                        alt="Proexpand Logo"
                        className="h-24 w-auto object-contain drop-shadow-sm"
                    />
                </div>

                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Entrar na plataforma</h2>
                    <p className="text-sm text-slate-500 mt-1">PROEX VENTURE LLC · Acesso seguro</p>
                </div>

                <form onSubmit={handleLogin} className="flex flex-col gap-5">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-slate-600">E-mail</label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="seu@email.com"
                            required
                            className="bg-white border border-slate-200 text-slate-800 text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-slate-600">Senha</label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            className="bg-white border border-slate-200 text-slate-800 text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                        />
                    </div>

                    {error && (
                        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">
                            ⚠️ {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="mt-2 w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[15px] rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {loading ? '⟳ Entrando...' : 'Entrar →'}
                    </button>
                </form>

                <p className="mt-8 text-xs text-slate-400 text-center">
                    Não tem acesso? Entre em contato com a equipe PROEX.
                </p>
            </div>

            {/* Bomjur Signature */}
            <div className="fixed bottom-4 right-4 flex items-center gap-2 z-50 bg-white/60 backdrop-blur-md px-3 py-2 rounded-full shadow-sm border border-slate-200/50 pointer-events-none">
                <span className="text-xs text-slate-400 font-medium">Powered by Bomjur Technology</span>
                <img src="/bomjur-logo.png" alt="Bomjur" className="h-6 w-auto object-contain opacity-80" />
            </div>
        </div>
    )
}

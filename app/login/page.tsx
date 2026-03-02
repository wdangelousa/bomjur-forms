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
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-200 relative overflow-hidden">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] p-8 sm:p-10 z-10">
                <img
                    src="/proexpandbrasil-logo.png"
                    alt="Proexpand"
                    className="h-16 sm:h-20 w-auto mx-auto mb-8 object-contain"
                />

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
                            className="bg-white border text-sm px-4 py-3 rounded-xl border-slate-200 focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all outline-none text-slate-800 placeholder:text-slate-400"
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
                            className="bg-white border text-sm px-4 py-3 rounded-xl border-slate-200 focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all outline-none text-slate-800 placeholder:text-slate-400"
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
                        className="mt-2 w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[15px] rounded-xl hover:-translate-y-0.5 shadow-md transition-all active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                    >
                        {loading ? '⟳ Entrando...' : 'Entrar →'}
                    </button>
                </form>

                <p className="mt-8 text-xs text-slate-400 text-center">
                    Não tem acesso? Entre em contato com a equipe PROEX.
                </p>
            </div>

            <div className="fixed bottom-6 right-6 flex items-center gap-3 opacity-60 hover:opacity-100 transition-opacity z-10">
                <span className="text-xs font-medium text-slate-600">Powered by Bomjur Technology</span>
                <img src="/bomjur-logo.png" alt="Bomjur" className="h-6 w-auto object-contain" />
            </div>
        </div>
    )
}

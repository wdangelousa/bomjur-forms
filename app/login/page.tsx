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
        <div style={S.page}>
            <div style={S.card}>
                <div style={S.logoArea}>
                    <span style={{ fontSize: 40 }}>⚖️</span>
                    <div>
                        <h1 style={S.logoTitle}>Bomjur</h1>
                        <p style={S.logoSub}>Plataforma de Imigração</p>
                    </div>
                </div>

                <h2 style={S.formTitle}>Entrar na plataforma</h2>
                <p style={S.formSub}>PROEX VENTURE LLC · Acesso seguro</p>

                <form onSubmit={handleLogin} style={S.form}>
                    <div style={S.fieldWrap}>
                        <label style={S.label}>E-mail</label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="seu@email.com"
                            required
                            style={S.input}
                        />
                    </div>

                    <div style={S.fieldWrap}>
                        <label style={S.label}>Senha</label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            style={S.input}
                        />
                    </div>

                    {error && <p style={S.errorMsg}>⚠️ {error}</p>}

                    <button
                        type="submit"
                        disabled={loading}
                        style={{ ...S.submitBtn, opacity: loading ? 0.7 : 1 }}
                    >
                        {loading ? '⟳ Entrando...' : 'Entrar →'}
                    </button>
                </form>

                <p style={S.footer}>
                    Não tem acesso? Entre em contato com a equipe PROEX.
                </p>
            </div>

            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input::placeholder { color: #475569; }
        input:focus { outline: none; border-color: #7c3aed !important; box-shadow: 0 0 0 3px rgba(124,58,237,0.15); }
      `}</style>
        </div>
    )
}

const S: Record<string, React.CSSProperties> = {
    page: {
        minHeight: '100vh',
        background: '#f8fafc',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Inter', system-ui, sans-serif", padding: 20,
    },
    card: {
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 20, padding: '44px 40px',
        width: '100%', maxWidth: 420,
        boxShadow: '0 10px 40px rgba(0,0,0,0.05)',
    },
    logoArea: {
        display: 'flex', gap: 14, alignItems: 'center',
        marginBottom: 32, justifyContent: 'center',
    },
    logoTitle: {
        fontSize: 24, fontWeight: 800,
        background: 'linear-gradient(90deg,#2563eb,#3b82f6)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
    },
    logoSub: { fontSize: 12, color: '#64748b' },
    formTitle: { fontSize: 20, fontWeight: 700, color: '#1e293b', textAlign: 'center', marginBottom: 4 },
    formSub: { fontSize: 12, color: '#64748b', textAlign: 'center', marginBottom: 28 },
    form: { display: 'flex', flexDirection: 'column', gap: 18 },
    fieldWrap: { display: 'flex', flexDirection: 'column', gap: 6 },
    label: { fontSize: 13, fontWeight: 600, color: '#475569' },
    input: {
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 10, padding: '12px 16px',
        color: '#0f172a', fontSize: 14, fontFamily: 'inherit',
        transition: 'all 0.2s',
    },
    errorMsg: {
        fontSize: 13, color: '#b91c1c',
        background: 'rgba(239,68,68,0.1)',
        border: '1px solid rgba(239,68,68,0.2)',
        borderRadius: 8, padding: '10px 14px',
    },
    submitBtn: {
        padding: '14px', marginTop: 4,
        background: 'linear-gradient(135deg,#3b82f6,#2563eb)',
        color: '#fff', fontWeight: 700, fontSize: 15,
        border: 'none', borderRadius: 12, cursor: 'pointer',
        boxShadow: '0 4px 14px rgba(37,99,235,0.2)',
        transition: 'all 0.2s',
    },
    footer: { marginTop: 24, fontSize: 12, color: '#64748b', textAlign: 'center' },
}

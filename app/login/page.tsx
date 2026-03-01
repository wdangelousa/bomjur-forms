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

        const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (authErr || !authData.user) {
            setError('Email ou senha incorretos. Tente novamente.')
            setLoading(false)
            return
        }

        const { data: profile } = await supabase
            .from('user_profiles')
            .select('role')
            .eq('id', authData.user.id)
            .single()

        const role = profile?.role

        // ✅ REGRAS DE REDIRECIONAMENTO CORRIGIDAS:
        // admin OU tenant_admin → vão para o painel de gestão (/admin)
        // client               → vai para o painel do imigrante (/i485)
        if (role === 'admin' || role === 'tenant_admin') {
            router.push('/admin')
        } else {
            router.push('/i485')
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
        background: 'linear-gradient(135deg,#0f0c29 0%,#302b63 50%,#24243e 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Inter', system-ui, sans-serif", padding: 20,
    },
    card: {
        background: 'rgba(255,255,255,0.05)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 20, padding: '44px 40px',
        width: '100%', maxWidth: 420,
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
    },
    logoArea: {
        display: 'flex', gap: 14, alignItems: 'center',
        marginBottom: 32, justifyContent: 'center',
    },
    logoTitle: {
        fontSize: 24, fontWeight: 800,
        background: 'linear-gradient(90deg,#a78bfa,#818cf8)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
    },
    logoSub: { fontSize: 12, color: '#94a3b8' },
    formTitle: { fontSize: 20, fontWeight: 700, color: '#f1f5f9', textAlign: 'center', marginBottom: 4 },
    formSub: { fontSize: 12, color: '#64748b', textAlign: 'center', marginBottom: 28 },
    form: { display: 'flex', flexDirection: 'column', gap: 18 },
    fieldWrap: { display: 'flex', flexDirection: 'column', gap: 6 },
    label: { fontSize: 13, fontWeight: 600, color: '#94a3b8' },
    input: {
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 10, padding: '12px 16px',
        color: '#f1f5f9', fontSize: 14, fontFamily: 'inherit',
        transition: 'all 0.2s',
    },
    errorMsg: {
        fontSize: 13, color: '#f87171',
        background: 'rgba(239,68,68,0.1)',
        border: '1px solid rgba(239,68,68,0.2)',
        borderRadius: 8, padding: '10px 14px',
    },
    submitBtn: {
        padding: '14px', marginTop: 4,
        background: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
        color: '#fff', fontWeight: 700, fontSize: 15,
        border: 'none', borderRadius: 12, cursor: 'pointer',
        boxShadow: '0 4px 20px rgba(124,58,237,0.4)',
        transition: 'all 0.2s',
    },
    footer: { marginTop: 24, fontSize: 12, color: '#475569', textAlign: 'center' },
}

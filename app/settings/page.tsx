'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, AlertCircle, Loader2, User, Phone, Mail, ShieldCheck } from 'lucide-react'

export default function SettingsPage() {
    const supabase = createClient()
    const [profile, setProfile] = useState<any>(null)
    const [pageLoading, setPageLoading] = useState(true)

    // User Requested States
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)

    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    useEffect(() => {
        async function loadProfile() {
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (user) {
                    const { data } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', user.id)
                        .single()
                    setProfile(data)
                }
            } catch (err) {
                console.error('Error loading settings profile:', err)
            } finally {
                setPageLoading(false)
            }
        }
        loadProfile()
    }, [])

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault()
        setMessage(null)

        // Validation
        if (newPassword.length < 6) {
            setMessage({ type: 'error', text: 'A senha deve ter pelo menos 6 caracteres.' })
            return
        }

        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'As senhas não coincidem.' })
            return
        }

        try {
            setLoading(true)
            const { error } = await supabase.auth.updateUser({ password: newPassword })

            if (error) throw error

            setMessage({ type: 'success', text: 'Senha atualizada com sucesso!' })
            setNewPassword('')
            setConfirmPassword('')
        } catch (err: any) {
            console.error('Error updating password:', err)
            setMessage({ type: 'error', text: err.message || 'Erro ao atualizar senha.' })
        } finally {
            setLoading(false)
        }
    }

    if (pageLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Carregando Configurações...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans text-slate-900 border-t border-slate-200/60">
            <div className="max-w-4xl mx-auto space-y-10">

                {/* ── Header ── */}
                <header>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 bg-sky-50 rounded-lg">
                            <ShieldCheck className="w-4 h-4 text-sky-600" />
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Centro de Segurança</span>
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Configurações da Conta</h1>
                    <p className="text-slate-500 font-medium mt-1">Gerencie suas informações e garanta a segurança da sua conta.</p>
                </header>

                <div className="grid grid-cols-1 gap-8">

                    {/* ── Perfil Section ── */}
                    <section className="bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.02)] border border-slate-200 overflow-hidden">
                        <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/30">
                            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                <User className="w-5 h-5 text-sky-500" />
                                Informações Pessoais
                            </h2>
                        </div>

                        <div className="p-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                        Nome Completo
                                    </label>
                                    <div className="relative group">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-sky-500 transition-colors" />
                                        <input
                                            type="text"
                                            readOnly
                                            value={profile?.full_name || ''}
                                            className="w-full bg-slate-50/50 border border-slate-200 px-11 py-3 rounded-2xl text-sm font-bold text-slate-600 outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                        Email Registrado
                                    </label>
                                    <div className="relative group">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 transition-colors" />
                                        <input
                                            type="email"
                                            readOnly
                                            value={profile?.email || ''}
                                            className="w-full bg-slate-50 border border-slate-200 px-11 py-3 rounded-2xl text-sm font-bold text-slate-400 cursor-not-allowed outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                        Telefone de Contato
                                    </label>
                                    <div className="relative group">
                                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 transition-colors" />
                                        <input
                                            type="tel"
                                            readOnly
                                            value={profile?.phone || 'Não informado'}
                                            className="w-full bg-slate-50/50 border border-slate-200 px-11 py-3 rounded-2xl text-sm font-bold text-slate-600 outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="md:col-span-2 p-4 bg-amber-50/50 border border-amber-100 rounded-2xl">
                                    <p className="text-[11px] text-amber-700 font-medium leading-relaxed">
                                        <strong>Nota:</strong> Para alterar seu nome ou telefone, entre em contato com o suporte da agência Proexpand. Seu email de acesso é único e intransferível.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* ── Senha Section ── */}
                    <section className="bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.02)] border border-slate-200 overflow-hidden">
                        <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/30">
                            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                                Atualizar Senha
                            </h2>
                        </div>

                        <form onSubmit={handleUpdatePassword} className="p-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                        Nova Senha
                                    </label>
                                    <input
                                        type="password"
                                        placeholder="Mínimo 6 caracteres"
                                        required
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        className="w-full bg-white border border-slate-200 px-5 py-3 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-sky-500/5 focus:border-sky-500 outline-none transition-all shadow-sm"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                        Confirmar Nova Senha
                                    </label>
                                    <input
                                        type="password"
                                        placeholder="Repita a nova senha"
                                        required
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        className="w-full bg-white border border-slate-200 px-5 py-3 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-sky-500/5 focus:border-sky-500 outline-none transition-all shadow-sm"
                                    />
                                </div>
                            </div>

                            {message && (
                                <div className={`flex items-center gap-3 p-4 rounded-2xl text-sm font-bold animate-in fade-in slide-in-from-top-2 duration-300 ${message.type === 'success'
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                        : 'bg-red-50 text-red-700 border border-red-100'
                                    }`}>
                                    {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                                    {message.text}
                                </div>
                            )}

                            <div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex items-center justify-center gap-2 px-8 py-3.5 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-900/10 hover:bg-sky-600 hover:scale-[1.02] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Salvando...
                                        </>
                                    ) : (
                                        'Salvar Nova Senha'
                                    )}
                                </button>
                            </div>
                        </form>
                    </section>

                </div>

                {/* ── Footer ── */}
                <footer className="pt-10 flex flex-col items-center gap-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                    <div className="w-12 h-1 bg-slate-200 rounded-full" />
                    <p>Proexpand LegalTech Brasil • Proteção de Dados Garantida por Criptografia AES-256</p>
                </footer>

            </div>
        </div>
    )
}

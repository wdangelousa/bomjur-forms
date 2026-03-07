'use client'

import React, { useState, useEffect } from 'react'

/**
 * Substitua todo o código por...
 * 
 * PROEXPAND - Self-Service Center (Configurações)
 * Design System: Light Mode Premium (Slate-50 + Sky-500)
 */
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

export default function SettingsPage() {
    const supabase = createClient()
    const [profile, setProfile] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [passwords, setPasswords] = useState({ new: '', confirm: '' })
    const [updatingPassword, setUpdatingPassword] = useState(false)
    const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    useEffect(() => {
        async function loadProfile() {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
                setProfile(data)
            }
            setLoading(false)
        }
        loadProfile()
    }, [])

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault()
        setMsg(null)

        if (passwords.new !== passwords.confirm) {
            setMsg({ type: 'error', text: 'As senhas não coincidem.' })
            return
        }

        if (passwords.new.length < 6) {
            setMsg({ type: 'error', text: 'A senha deve ter pelo menos 6 caracteres.' })
            return
        }

        try {
            setUpdatingPassword(true)
            const { error } = await supabase.auth.updateUser({ password: passwords.new })
            if (error) throw error
            setMsg({ type: 'success', text: 'Senha atualizada com sucesso!' })
            setPasswords({ new: '', confirm: '' })
        } catch (err: any) {
            console.error('Error updating password:', err)
            setMsg({ type: 'error', text: err.message || 'Erro ao atualizar senha.' })
        } finally {
            setUpdatingPassword(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50 p-6 md:p-8 font-sans">
            <div className="max-w-4xl mx-auto space-y-8">

                {/* ── Page Header ── */}
                <header>
                    <h1 className="text-2xl font-bold text-slate-900">Minha Conta</h1>
                    <p className="text-slate-500 mt-1">Gerencie suas informações pessoais e preferências de segurança abaixo.</p>
                </header>

                <div className="space-y-6">

                    {/* ── SEÇÃO 1: DADOS PESSOAIS ── */}
                    <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <h2 className="text-lg font-bold text-slate-900 mb-6">Informações Pessoais</h2>

                        <form className="grid grid-cols-1 md:grid-cols-2 gap-6" onSubmit={(e) => e.preventDefault()}>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">
                                    Nome Completo
                                </label>
                                <input
                                    type="text"
                                    placeholder="Seu nome completo"
                                    defaultValue={profile?.full_name || ''}
                                    className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all"
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">
                                    Email de Acesso
                                </label>
                                <input
                                    type="email"
                                    value={profile?.email || ''}
                                    disabled
                                    readOnly
                                    className="bg-slate-100 border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-500 cursor-not-allowed outline-none"
                                />
                                <p className="text-[10px] text-slate-400 italic ml-1">* O email não pode ser alterado por motivos de segurança.</p>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">
                                    Telefone / WhatsApp
                                </label>
                                <input
                                    type="tel"
                                    placeholder="+55 (11) 99999-9999"
                                    defaultValue={profile?.phone || ''}
                                    className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all"
                                />
                            </div>

                            <div className="md:col-span-2">
                                <button className="bg-sky-500 hover:bg-sky-600 text-white font-medium rounded-lg px-6 py-2 mt-2 transition-colors active:scale-95 shadow-sm">
                                    Salvar Alterações
                                </button>
                            </div>
                        </form>
                    </section>

                    {/* ── SEÇÃO 2: SEGURANÇA ── */}
                    <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <h2 className="text-lg font-bold text-slate-900 mb-6">Segurança e Senha</h2>

                        <form className="grid grid-cols-1 md:grid-cols-2 gap-6" onSubmit={handleUpdatePassword}>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">
                                    Nova Senha
                                </label>
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    required
                                    value={passwords.new}
                                    onChange={e => setPasswords(prev => ({ ...prev, new: e.target.value }))}
                                    className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all"
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">
                                    Confirmar Nova Senha
                                </label>
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    required
                                    value={passwords.confirm}
                                    onChange={e => setPasswords(prev => ({ ...prev, confirm: e.target.value }))}
                                    className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all"
                                />
                            </div>

                            {msg && (
                                <div className={`md:col-span-2 flex items-center gap-2 p-3 rounded-lg text-sm font-medium ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'
                                    }`}>
                                    {msg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                                    {msg.text}
                                </div>
                            )}

                            <div className="md:col-span-2">
                                <button
                                    type="submit"
                                    disabled={updatingPassword}
                                    className="bg-white border-2 border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 font-medium rounded-lg px-6 py-2 mt-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {updatingPassword ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            Atualizando...
                                        </>
                                    ) : 'Atualizar Senha'}
                                </button>
                            </div>
                        </form>
                    </section>

                </div>

                {/* ── Info Footer ── */}
                <footer className="text-center pt-8 border-t border-slate-200">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        Proexpand LegalTech Hub • Proteção de Dados Garantida
                    </p>
                </footer>

            </div>
        </div>
    )
}

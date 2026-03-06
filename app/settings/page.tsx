'use client'

import React, { useState } from 'react'
import {
    User,
    Lock,
    ShieldCheck,
    Smartphone,
    Mail,
    Check,
    Save,
    Eye,
    EyeOff,
    AlertCircle
} from 'lucide-react'
import { motion } from 'framer-motion'

// ============================================================
// SUPABASE INTEGRATION (PREPARATION)
// ============================================================
// import { createClient } from '@/lib/supabase/client'
// const supabase = createClient()
// ============================================================

export default function SettingsPage() {
    const [showPassword, setShowPassword] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    const handleSave = () => {
        setIsSaving(true)
        setTimeout(() => setIsSaving(false), 2000)
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
            {/* ── Page Header ── */}
            <div className="max-w-4xl mx-auto px-6 pt-12">
                <div className="mb-10">
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">Minha Conta</h1>
                    <p className="text-slate-500 font-medium mt-1">Gira os seus dados pessoais e preferências de segurança.</p>
                </div>

                <div className="grid grid-cols-1 gap-10">

                    {/* ── SEÇÃO 1: DADOS PESSOAIS ── */}
                    <motion.section
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white border border-slate-200 rounded-[2.5rem] p-8 md:p-10 shadow-sm"
                    >
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-10 h-10 bg-sky-50 text-sky-600 rounded-xl flex items-center justify-center">
                                <User className="w-5 h-5" />
                            </div>
                            <h2 className="text-xl font-black text-slate-900 tracking-tight">Dados Pessoais</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
                                <input
                                    type="text"
                                    defaultValue="Walter D'Angelo"
                                    className="w-full bg-slate-50 border border-slate-200 px-5 py-3.5 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 transition-all"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email de Acesso</label>
                                <div className="relative">
                                    <input
                                        type="email"
                                        value="wdangelo81@gmail.com"
                                        readOnly
                                        className="w-full bg-slate-100 border border-slate-200 px-5 py-3.5 rounded-2xl text-sm font-bold text-slate-400 cursor-not-allowed"
                                    />
                                    <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                </div>
                                <p className="text-[11px] text-slate-400 italic ml-1 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" /> Email não pode ser alterado manualmente.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Telefone / WhatsApp</label>
                                <input
                                    type="tel"
                                    placeholder="+55 (11) 99999-9999"
                                    className="w-full bg-slate-50 border border-slate-200 px-5 py-3.5 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 transition-all"
                                />
                            </div>
                        </div>

                        <div className="mt-10 flex justify-end">
                            <button
                                onClick={handleSave}
                                className="flex items-center gap-2 bg-slate-900 text-white px-8 py-3.5 rounded-2xl text-xs font-black uppercase tracking-[0.1em] shadow-xl shadow-slate-900/10 hover:bg-sky-500 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {isSaving ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                Salvar Alterações
                            </button>
                        </div>
                    </motion.section>

                    {/* ── SEÇÃO 2: SEGURANÇA ── */}
                    <motion.section
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-white border border-slate-200 rounded-[2.5rem] p-8 md:p-10 shadow-sm"
                    >
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                                <ShieldCheck className="w-5 h-5" />
                            </div>
                            <h2 className="text-xl font-black text-slate-900 tracking-tight">Alterar Senha</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nova Senha</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="••••••••"
                                        className="w-full bg-slate-50 border border-slate-200 px-5 py-3.5 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirmar Nova Senha</label>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    className="w-full bg-slate-50 border border-slate-200 px-5 py-3.5 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
                                />
                            </div>
                        </div>

                        <div className="mt-10 flex justify-end">
                            <button className="flex items-center gap-2 bg-white border-2 border-slate-900 text-slate-900 px-8 py-3.5 rounded-2xl text-xs font-black uppercase tracking-[0.1em] hover:bg-slate-900 hover:text-white transition-all active:scale-95">
                                <Check className="w-4 h-4" />
                                Atualizar Senha
                            </button>
                        </div>
                    </motion.section>

                </div>

                {/* ── Logout Button ── */}
                <div className="mt-12 pt-8 border-t border-slate-200 flex justify-center">
                    <button className="text-[11px] font-black text-red-400 uppercase tracking-[0.2em] hover:text-red-500 transition-colors flex items-center gap-2">
                        Desconectar desta sessão
                    </button>
                </div>
            </div>
        </div>
    )
}

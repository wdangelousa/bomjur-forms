'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FileText, UploadCloud } from 'lucide-react'
import { motion } from 'framer-motion'

export default function EmptyDashboardPage() {
    const [profile, setProfile] = useState<any>(null)
    const supabase = createClient()

    useEffect(() => {
        async function fetchUser() {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data } = await supabase.from('user_profiles').select('*').eq('id', user.id).single()
                setProfile(data)
            }
        }
        fetchUser()
    }, [])

    return (
        <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6">
            <header>
                <h1 className="text-2xl font-bold text-white">Olá, {profile?.full_name?.split(' ')[0] || 'Cliente'} 🚀</h1>
                <p className="text-bomjur-muted mt-1">Bem-vindo(a) ao seu dashboard da Proexpand.</p>
            </header>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-[#111827] border border-[#1E293B] rounded-[24px] p-12 text-center mt-8 shadow-xl">
                <div className="w-20 h-20 bg-[#1A2332] rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <UploadCloud className="w-10 h-10 text-bomjur-dim" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Tudo pronto para começar!</h3>
                <p className="text-bomjur-muted mb-8 max-w-md mx-auto leading-relaxed">
                    O seu perfil foi configurado com sucesso. A nossa equipa está agora a preparar a arquitetura de documentos e as diretrizes do seu processo de imigração.
                </p>
                <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-bomjur-lime/10 border border-bomjur-lime/20 text-bomjur-lime text-sm font-bold tracking-wide uppercase">
                    <div className="w-2 h-2 rounded-full bg-bomjur-lime animate-pulse" />
                    Aguardando configuração do caso
                </div>
            </motion.div>
        </div>
    )
}

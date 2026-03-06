'use client'

import React, { useState } from 'react'
import {
    Bell,
    Info,
    AlertCircle,
    MessageSquare,
    ChevronRight,
    Search,
    CheckCheck,
    MoreVertical
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// ============================================================
// SUPABASE INTEGRATION (PREPARATION)
// ============================================================
// import { createClient } from '@/lib/supabase/client'
// const supabase = createClient()
// ============================================================

// ============================================================
// TYPES & MOCK DATA
// ============================================================

interface Notification {
    id: string
    title: string
    message: string
    date: string
    type: 'success' | 'info' | 'warning'
    isRead: boolean
}

const MOCK_NOTIFICATIONS: Notification[] = [
    {
        id: '1',
        title: 'Bem-vindo à Proexpand!',
        message: 'A sua jornada de imigração começa aqui. Estamos felizes em ajudá-lo com o seu processo.',
        date: '2024-03-06T08:00:00Z',
        type: 'success',
        isRead: false
    },
    {
        id: '2',
        title: 'Dica: Digitalização de Passaporte',
        message: 'Para evitar atrasos, certifique-se de que a cópia do seu passaporte está colorida e legível em todos os cantos.',
        date: '2024-03-05T15:30:00Z',
        type: 'info',
        isRead: true
    },
    {
        id: '3',
        title: 'Aviso: I-140 Aprovado!',
        message: 'Boas notícias! O formulário I-140 do seu caso foi aprovado pelo USCIS. Verifique o seu Cofre de Documentos para ver o aviso oficial.',
        date: '2024-03-04T10:15:00Z',
        type: 'warning',
        isRead: false
    }
]

// ============================================================
// COMPONENTS
// ============================================================

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS)

    const getTypeStyles = (type: Notification['type']) => {
        switch (type) {
            case 'success': return 'bg-emerald-50 text-emerald-600 border-emerald-100'
            case 'info': return 'bg-blue-50 text-blue-600 border-blue-100'
            case 'warning': return 'bg-amber-50 text-amber-600 border-amber-100'
        }
    }

    const getIcon = (type: Notification['type']) => {
        switch (type) {
            case 'success': return <Bell className="w-5 h-5" />
            case 'info': return <Info className="w-5 h-5" />
            case 'warning': return <AlertCircle className="w-5 h-5" />
        }
    }

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
            {/* ── Page Header ── */}
            <div className="max-w-4xl mx-auto px-6 pt-12">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Central de Avisos</h1>
                        <p className="text-slate-500 font-medium mt-1">Acompanhe as atualizações e mensagens da nossa equipa.</p>
                    </div>

                    <button className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-900 rounded-2xl text-xs font-black uppercase tracking-widest shadow-sm hover:border-sky-500 hover:text-sky-600 transition-all active:scale-95">
                        <MessageSquare className="w-4 h-4" />
                        Falar com a Proexpand
                    </button>
                </div>

                {/* ── Controls ── */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                            {notifications.filter(n => !n.isRead).length} Mensagens Não Lidas
                        </span>
                    </div>
                    <button className="text-[11px] font-black text-sky-600 uppercase tracking-widest flex items-center gap-1.5 hover:opacity-80 transition-opacity">
                        <CheckCheck className="w-3.5 h-3.5" />
                        Marcar todas como lidas
                    </button>
                </div>

                {/* ── Notifications List ── */}
                <div className="space-y-4">
                    <AnimatePresence>
                        {notifications.map((notif, idx) => (
                            <motion.div
                                key={notif.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                className={`group bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all relative overflow-hidden`}
                            >
                                {/* Unread Indicator Bar */}
                                {!notif.isRead && (
                                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-sky-500" />
                                )}

                                <div className="flex items-start gap-4">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0 ${getTypeStyles(notif.type)}`}>
                                        {getIcon(notif.type)}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2">
                                                <h3 className={`text-base font-black tracking-tight ${notif.isRead ? 'text-slate-600' : 'text-slate-900'}`}>
                                                    {notif.title}
                                                </h3>
                                                {!notif.isRead && (
                                                    <div className="w-2 h-2 bg-sky-500 rounded-full" />
                                                )}
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
                                                {formatDate(notif.date)}
                                            </span>
                                        </div>
                                        <p className="text-sm font-medium text-slate-500 leading-relaxed max-w-2xl">
                                            {notif.message}
                                        </p>
                                    </div>

                                    <div className="hidden group-hover:block transition-all self-center ml-4">
                                        <button className="p-2 text-slate-300 hover:text-slate-900 transition-colors">
                                            <MoreVertical className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                {/* ── Empty State ── */}
                {notifications.length === 0 && (
                    <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2.5rem] py-20 text-center">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                            <Bell className="w-10 h-10" />
                        </div>
                        <h3 className="text-xl font-black text-slate-900">Nenhuma notificação por agora</h3>
                        <p className="text-slate-500 font-medium max-w-xs mx-auto mt-2">Fique descansado! Avisaremos assim que algo novo acontecer no seu processo.</p>
                    </div>
                )}
            </div>
        </div>
    )
}

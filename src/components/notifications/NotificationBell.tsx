'use client'

import React, { useState, useEffect } from 'react'
import { Bell, CheckCircle2, XCircle, Rocket, Info, Settings, MoreHorizontal } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import NotificationItem from './NotificationItem'
import { COLORS } from '@/lib/design-system'

export default function NotificationBell({ userId }: { userId: string }) {
    const supabase = createClient()
    const [notifications, setNotifications] = useState<any[]>([])
    const [isOpen, setIsOpen] = useState(false)
    const [unreadCount, setUnreadCount] = useState(0)

    const fetchNotifications = async () => {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(10)

        if (!error && data) {
            setNotifications(data)
            setUnreadCount(data.filter(n => !n.read).length)
        }
    }

    useEffect(() => {
        fetchNotifications()

        // Realtime Subscription
        const channel = supabase
            .channel(`notifications-${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`
                },
                (payload) => {
                    setNotifications(prev => [payload.new, ...prev].slice(0, 10))
                    setUnreadCount(prev => prev + 1)
                    // Play subtle sound if possible or trigger vibration
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [userId])

    const markAllAsRead = async () => {
        const { error } = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('user_id', userId)
            .eq('read', false)

        if (!error) {
            setNotifications(prev => prev.map(n => ({ ...n, read: true })))
            setUnreadCount(0)
        }
    }

    return (
        <div className="relative">
            {/* Bell Icon */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-white transition-all active:scale-95"
            >
                <Bell className="w-5 h-5" />
                <AnimatePresence>
                    {unreadCount > 0 && (
                        <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 rounded-full border-2 border-[#0A0E17] flex items-center justify-center text-[8px] font-black text-white"
                        >
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </motion.span>
                    )}
                </AnimatePresence>
            </button>

            {/* Dropdown Menu */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        <div
                            className="fixed inset-0 z-40"
                            onClick={() => setIsOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute right-0 mt-3 w-80 bg-[#111827] border border-white/10 rounded-[28px] shadow-2xl z-50 overflow-hidden"
                        >
                            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                                <h3 className="text-xs font-black uppercase tracking-widest text-white">Notificações</h3>
                                <button
                                    onClick={markAllAsRead}
                                    className="text-[10px] font-bold text-lime-500 hover:text-lime-400 transition-colors"
                                >
                                    Marcar todas como lidas
                                </button>
                            </div>

                            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                                {notifications.length > 0 ? (
                                    notifications.map((n) => (
                                        <NotificationItem key={n.id} notification={n} />
                                    ))
                                ) : (
                                    <div className="p-10 text-center">
                                        <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3">
                                            <Bell className="w-5 h-5 text-dim opacity-20" />
                                        </div>
                                        <p className="text-[10px] font-bold text-dim uppercase tracking-wider">Tudo em dia!</p>
                                    </div>
                                )}
                            </div>

                            <div className="p-4 border-t border-white/5 bg-white/[0.01] text-center">
                                <button className="text-[10px] font-black uppercase tracking-widest text-dim hover:text-white transition-colors flex items-center justify-center gap-2 mx-auto">
                                    Ver todas as atividades <MoreHorizontal className="w-3 h-3" />
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 10px;
                }
            `}</style>
        </div>
    )
}

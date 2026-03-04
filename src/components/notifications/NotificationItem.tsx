'use client'

import React from 'react'
import { CheckCircle2, XCircle, Rocket, Info, AlertTriangle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { motion } from 'framer-motion'

interface NotificationItemProps {
    notification: {
        id: string;
        title: string;
        body: string;
        type: string;
        read: boolean;
        created_at: string;
    }
}

const getIcon = (type: string) => {
    switch (type) {
        case 'approval':
            return <CheckCircle2 className="w-4 h-4 text-lime-500" />
        case 'rejection':
            return <XCircle className="w-4 h-4 text-red-500" />
        case 'achievement':
            return <Rocket className="w-4 h-4 text-purple-500" />
        case 'system':
            return <AlertTriangle className="w-4 h-4 text-amber-500" />
        default:
            return <Info className="w-4 h-4 text-blue-500" />
    }
}

export default function NotificationItem({ notification }: NotificationItemProps) {
    return (
        <motion.div
            whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.03)' }}
            className={`p-4 border-b border-white/[0.05] transition-colors relative flex gap-4 ${!notification.read ? 'bg-lime-500/[0.02]' : ''}`}
        >
            {!notification.read && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-lime-500" />
            )}

            <div className={`mt-1 w-9 h-9 shrink-0 rounded-xl flex items-center justify-center ${notification.read ? 'bg-white/5 text-dim' : 'bg-white/10 text-white'}`}>
                {getIcon(notification.type)}
            </div>

            <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                    <p className={`text-xs font-black truncate ${notification.read ? 'text-dim' : 'text-white'}`}>
                        {notification.title}
                    </p>
                    <span className="text-[9px] font-bold text-dim shrink-0">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                </div>
                <p className={`text-[11px] leading-relaxed line-clamp-2 ${notification.read ? 'text-dim/60' : 'text-white/60'}`}>
                    {notification.body}
                </p>
            </div>
        </motion.div>
    )
}

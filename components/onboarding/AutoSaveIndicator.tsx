'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, CheckCircle2, CloudOff, RefreshCw } from 'lucide-react'
import { COLORS } from '@/lib/design-system'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface AutoSaveIndicatorProps {
    status: SaveStatus
}

export default function AutoSaveIndicator({ status }: AutoSaveIndicatorProps) {
    const config = {
        idle: {
            icon: <RefreshCw className="w-3 h-3" />,
            text: 'Aguardando alterações',
            color: COLORS.textDim
        },
        saving: {
            icon: <Loader2 className="w-3 h-3 animate-spin" />,
            text: 'Salvando...',
            color: COLORS.blue
        },
        saved: {
            icon: <CheckCircle2 className="w-3 h-3" />,
            text: 'Alterações salvas',
            color: COLORS.success
        },
        error: {
            icon: <CloudOff className="w-3 h-3" />,
            text: 'Erro ao salvar',
            color: COLORS.danger
        }
    }

    const current = config[status]

    return (
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
            <AnimatePresence mode="wait">
                <motion.div
                    key={status}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-1.5"
                >
                    <span style={{ color: current.color }}>{current.icon}</span>
                    <span
                        className="text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: current.color }}
                    >
                        {current.text}
                    </span>
                </motion.div>
            </AnimatePresence>
        </div>
    )
}

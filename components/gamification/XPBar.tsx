'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { COLORS } from '@/lib/design-system'

interface XPBarProps {
    currentXP: number;
    level: number;
}

const XP_PER_LEVEL = 500;

export default function XPBar({ currentXP, level }: XPBarProps) {
    const xpInCurrentLevel = currentXP % XP_PER_LEVEL;
    const progressPercent = (xpInCurrentLevel / XP_PER_LEVEL) * 100;

    return (
        <div className="w-full space-y-3">
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <div className="absolute inset-0 bg-lime-500/40 rounded-full blur-md animate-pulse" />
                        <div
                            className="relative w-8 h-8 rounded-full border-2 border-lime-500 flex items-center justify-center bg-[#0D1117] z-10 shadow-[0_0_15px_rgba(132,204,22,0.3)]"
                        >
                            <span className="text-[10px] font-black text-lime-500">Lvl {level}</span>
                        </div>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#84CC16]">Imigrante Pro</span>
                </div>
                <span className="text-[10px] font-bold text-dim tabular-nums">
                    {xpInCurrentLevel}<span className="text-white/20">/</span>{XP_PER_LEVEL} XP
                </span>
            </div>

            <div className="h-2.5 w-full bg-white/5 rounded-full overflow-hidden p-[2px] border border-white/5 relative">
                {/* Vibrant Gradient Background Fill */}
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                    className="h-full rounded-full bg-gradient-to-r from-[#84CC16] via-[#A855F7] to-[#84CC16] bg-[length:200%_auto] animate-gradient-x"
                    style={{
                        boxShadow: '0 0 10px rgba(132, 204, 22, 0.3)'
                    }}
                />
            </div>

            <style jsx>{`
                @keyframes gradient-x {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
                .animate-gradient-x {
                    animation: gradient-x 3s ease infinite;
                }
            `}</style>
        </div>
    )
}

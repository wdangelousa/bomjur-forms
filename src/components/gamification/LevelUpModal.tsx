'use client'

import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, Star, X, Sparkles, PartyPopper } from 'lucide-react'
import { COLORS } from '@/lib/design-system'

interface LevelUpModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    message?: string;
    badgeName?: string;
    level?: number;
}

export default function LevelUpModal({
    isOpen,
    onClose,
    title = "Nível Concluído!",
    message = "Você está um passo mais perto do seu sonho!",
    badgeName,
    level
}: LevelUpModalProps) {
    const [showConfetti, setShowConfetti] = useState(false)

    useEffect(() => {
        if (isOpen) {
            setShowConfetti(true)
            const timer = setTimeout(() => setShowConfetti(false), 3000)
            return () => clearTimeout(timer)
        }
    }, [isOpen])

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[500] flex items-center justify-center p-6">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/90 backdrop-blur-md"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ scale: 0.5, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.5, opacity: 0, y: 20 }}
                        transition={{ type: 'spring', damping: 15, stiffness: 200 }}
                        className="relative w-full max-w-sm bg-[#111827] border border-white/10 rounded-[40px] p-8 text-center overflow-hidden shadow-[0_0_50px_rgba(132,204,22,0.15)]"
                    >
                        {/* Confetti simulation (Simplified) */}
                        {showConfetti && (
                            <div className="absolute inset-0 pointer-events-none">
                                {[...Array(20)].map((_, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{
                                            x: Math.random() * 300 - 150,
                                            y: -50,
                                            rotate: 0,
                                            scale: 1
                                        }}
                                        animate={{
                                            y: 400,
                                            rotate: 360,
                                            scale: 0.5,
                                            opacity: 0
                                        }}
                                        transition={{ duration: 2, ease: "easeOut", delay: Math.random() * 0.5 }}
                                        className="absolute w-2 h-2 rounded-sm"
                                        style={{
                                            background: i % 2 === 0 ? '#84CC16' : '#A855F7',
                                            left: '50%'
                                        }}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Top Decoration */}
                        <div className="relative mb-8">
                            <motion.div
                                animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
                                transition={{ repeat: Infinity, duration: 4 }}
                                className="w-24 h-24 rounded-full bg-gradient-to-br from-[#84CC16] to-[#A855F7] mx-auto flex items-center justify-center p-0.5 shadow-2xl relative z-10"
                            >
                                <div className="w-full h-full rounded-full bg-[#111827] flex items-center justify-center">
                                    {badgeName ? <Trophy className="w-10 h-10 text-lime-400" /> : <Star className="w-10 h-10 text-lime-400" />}
                                </div>
                            </motion.div>

                            <Sparkles className="absolute top-0 right-1/4 w-6 h-6 text-purple-400 animate-pulse" />
                            <PartyPopper className="absolute bottom-0 left-1/4 w-6 h-6 text-lime-400 animate-bounce" />
                        </div>

                        {/* Text Content */}
                        <div className="space-y-3 mb-8">
                            <h2 className="text-2xl font-black text-white leading-tight">
                                {level ? `Subiu para o Nível ${level}!` : title}
                            </h2>
                            <p className="text-sm font-medium text-dim leading-relaxed">
                                {badgeName ? `Parabéns! Você desbloqueou a conquista: ${badgeName}!` : message}
                            </p>
                        </div>

                        {/* Action Area */}
                        <div className="space-y-3">
                            <button
                                onClick={onClose}
                                className="w-full py-4 rounded-2xl bg-white text-black font-black text-sm uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                            >
                                Continuar Jornada
                            </button>
                            <button className="text-[10px] font-black uppercase tracking-widest text-dim hover:text-white transition-colors">
                                Ver minhas conquistas
                            </button>
                        </div>

                        {/* Close button */}
                        <button
                            onClick={onClose}
                            className="absolute top-6 right-6 p-2 text-dim hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}

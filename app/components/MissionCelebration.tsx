'use client'

import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

// ============================================================
// PUBLIC TYPES
// ============================================================
export type CelebrationVariant =
  | 'document_success'
  | 'milestone_reached'
  | 'empty_state_friendly'

export interface MissionCelebrationProps {
  /** Which visual + emotional variant to show */
  type: CelebrationVariant
  /** Controls mount/unmount with AnimatePresence */
  visible: boolean
  /** Override the default headline */
  title?: string
  /** Override the default body text */
  description?: string
  /** Override the CTA button label */
  ctaLabel?: string
  /** Called when CTA is clicked or backdrop is tapped */
  onContinue?: () => void
}

// ============================================================
// DESIGN TOKENS (Premium Silicon Valley Identity - Light Mode)
// ============================================================
const C = {
  backdrop: 'rgba(15, 23, 42, 0.3)', // Subtle dark blur for depth
  bgCard: '#ffffff',
  border: '#e2e8f0',
  borderSuccess: '#bbf7d0',
  borderGold: '#fde68a',
  borderAccent: '#ddd6fe',
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  primary: '#22c55e',
  primaryDark: '#16a34a',
  gold: '#f59e0b',
  blue: '#2563eb',
}
const F = "'Inter', system-ui, sans-serif"

// ============================================================
// VARIANT DEFAULTS
// ============================================================
interface VariantConfig {
  title: string
  description: string
  ctaLabel: string
  confettiColors: string[]
  cardBorder: string
  cardGlow: string
  gradientText: string
}

const VARIANT_CONFIG: Record<CelebrationVariant, VariantConfig> = {
  document_success: {
    title: 'Documento enviado! 🎉',
    description: 'Excelente trabalho. Cada evidência enviada nos aproxima da aprovação final. Nossa equipe jurídica iniciará a revisão imediatamente.',
    ctaLabel: 'Continuar Jornada →',
    confettiColors: ['#22c55e', '#34d399', '#6ee7b7', '#2563eb', '#ffffff'],
    cardBorder: C.borderSuccess,
    cardGlow: 'rgba(34,197,94,0.08)',
    gradientText: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
  },
  milestone_reached: {
    title: 'Marco Atingido! 🚀',
    description: 'Esta é uma vitória significativa no seu processo. O seu progresso é reflexo direto da dedicação à sua petição.',
    ctaLabel: 'Próximo Passo →',
    confettiColors: ['#f59e0b', '#fcd34d', '#2563eb', '#ffffff', '#ec4899'],
    cardBorder: C.borderGold,
    cardGlow: 'rgba(245,158,11,0.08)',
    gradientText: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
  },
  empty_state_friendly: {
    title: 'Nenhum documento ainda 📂',
    description: 'Para iniciarmos a análise do seu caso, precisamos dos arquivos necessários. O upload é rápido e seguro.',
    ctaLabel: 'Fazer Upload Agora',
    confettiColors: [],
    cardBorder: C.border,
    cardGlow: 'rgba(148,163,184,0.05)',
    gradientText: 'linear-gradient(135deg, #1e293b 0%, #475569 100%)',
  },
}

// ============================================================
// ANIMATIONS (Tailwind-compatible keyframes via style tag)
// ============================================================
const KEYFRAMES = `
  @keyframes ringPulse {
    0%   { transform: scale(1);    opacity: 0.5; }
    60%  { transform: scale(1.4); opacity: 0;   }
    100% { transform: scale(1.4); opacity: 0;   }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50%      { transform: translateY(-10px); }
  }
`

// ============================================================
// ICON COMPONENTS
// ============================================================
function IconWrapper({ children, color, bg, border, animation }: any) {
  return (
    <div className="relative w-24 h-24 mx-auto mb-6">
      <div style={{ borderColor: border, animation: 'ringPulse 2s ease-out infinite' }} className="absolute inset-[-8px] rounded-full border-2" />
      <div style={{ backgroundColor: bg, borderColor: border, animation }} className="w-full h-full rounded-full border-2 flex items-center justify-center text-4xl shadow-sm relative z-10">
        {children}
      </div>
    </div>
  )
}

function CtaButton({ label, variant, onClick }: { label: string; variant: CelebrationVariant; onClick?: () => void }) {
  const isMilestone = variant === 'milestone_reached'
  const isDocument = variant === 'document_success'

  return (
    <button
      onClick={onClick}
      className={`w-full py-4 px-8 rounded-2xl font-bold text-base transition-all transform active:scale-[0.98] shadow-lg
        ${isMilestone ? 'bg-slate-900 text-white hover:bg-black shadow-slate-900/10' :
          isDocument ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-500/20' :
            'bg-white border border-slate-200 text-slate-800 hover:bg-slate-50'}`}
    >
      {label}
    </button>
  )
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function MissionCelebration({
  type,
  visible,
  title,
  description,
  ctaLabel,
  onContinue,
}: MissionCelebrationProps) {
  const cfg = VARIANT_CONFIG[type]
  const resolvedTitle = title ?? cfg.title
  const resolvedDescription = description ?? cfg.description
  const resolvedCta = ctaLabel ?? cfg.ctaLabel

  useEffect(() => {
    if (!visible || type === 'empty_state_friendly') return

    import('canvas-confetti').then(({ default: confetti }) => {
      const colors = cfg.confettiColors
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 }, colors })
      if (type === 'milestone_reached') {
        setTimeout(() => confetti({ particleCount: 40, spread: 100, origin: { y: 0.4 }, colors, scalar: 0.8 }), 500)
      }
    })
  }, [visible, type, cfg.confettiColors])

  if (type === 'empty_state_friendly') {
    if (!visible) return null
    return (
      <div className="flex flex-col items-center justify-center py-16 px-8 text-center animate-in fade-in duration-700">
        <style>{KEYFRAMES}</style>
        <IconWrapper bg="bg-slate-50" border="rgba(148,163,184,0.2)" animation="float 3s ease-in-out infinite">📂</IconWrapper>
        <h3 className="text-xl font-black text-slate-900 mb-2">{resolvedTitle}</h3>
        <p className="text-sm text-slate-500 max-w-xs leading-relaxed mb-8">{resolvedDescription}</p>
        <div className="w-full max-w-xs">
          <CtaButton label={resolvedCta} variant={type} onClick={onContinue} />
        </div>
      </div>
    )
  }

  return (
    <>
      <style>{KEYFRAMES}</style>
      <AnimatePresence>
        {visible && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onContinue}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              onClick={e => e.stopPropagation()}
              className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden"
              style={{
                background: cfg.cardGlow
                  ? `radial-gradient(circle at top, ${cfg.cardGlow} 0%, transparent 70%), #ffffff`
                  : '#ffffff'
              }}
            >
              {/* Close Button */}
              <button
                onClick={onContinue}
                className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-all"
              >
                <X size={20} />
              </button>

              <div className="p-10 text-center">
                {/* Icon */}
                <div className="mb-6">
                  {type === 'document_success' && (
                    <IconWrapper bg="#dcfce7" border="#bbf7d0" animation="float 4s ease-in-out infinite">✅</IconWrapper>
                  )}
                  {type === 'milestone_reached' && (
                    <IconWrapper bg="#fef3c7" border="#fde68a" animation="float 4s ease-in-out infinite">🏆</IconWrapper>
                  )}
                </div>

                {/* Content */}
                <h2 style={{ backgroundImage: cfg.gradientText }} className="text-2xl font-black mb-4 bg-clip-text text-transparent">
                  {resolvedTitle}
                </h2>
                <p className="text-slate-500 text-sm leading-relaxed mb-10">
                  {resolvedDescription}
                </p>

                {/* CTA */}
                <CtaButton label={resolvedCta} variant={type} onClick={onContinue} />

                <button
                  onClick={onContinue}
                  className="mt-6 text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors"
                >
                  Pular agora
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}

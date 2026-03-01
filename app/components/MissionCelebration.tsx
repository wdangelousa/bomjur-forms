'use client'

import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

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
// DESIGN TOKENS  (mirrors project dark theme)
// ============================================================
const C = {
  backdrop:      'rgba(6, 4, 22, 0.84)',
  bgCard:        'linear-gradient(150deg, #1a1040 0%, #16213e 55%, #0d2137 100%)',
  border:        'rgba(255,255,255,0.09)',
  borderSuccess: 'rgba(34,197,94,0.38)',
  borderGold:    'rgba(245,158,11,0.38)',
  borderAccent:  'rgba(167,139,250,0.32)',
  textPrimary:   '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted:     '#64748b',
  accent:        '#a78bfa',
  accentDark:    '#7c3aed',
  success:       '#22c55e',
  gold:          '#f59e0b',
  goldLight:     '#fcd34d',
  emerald:       '#34d399',
}
const F = "'Inter', system-ui, sans-serif"

// ============================================================
// VARIANT DEFAULTS  (all overridable via props)
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
    title:           'Documento enviado com sucesso! 🎉',
    description:     'Incrível! Cada PDF que você envia nos deixa mais perto do sim. Nossa equipe já vai analisar tudo com carinho!',
    ctaLabel:        'Bora para o próximo passo! →',
    confettiColors:  ['#22c55e', '#34d399', '#6ee7b7', '#a78bfa', '#ffffff', '#86efac'],
    cardBorder:      C.borderSuccess,
    cardGlow:        'rgba(34,197,94,0.18)',
    gradientText:    'linear-gradient(135deg, #34d399 0%, #22c55e 50%, #16a34a 100%)',
  },
  milestone_reached: {
    title:           'Marco histórico atingido! Você é imparável! 🚀',
    description:     'Isso é ENORME. Cada etapa concluída é uma vitória real. Orgulho total do seu progresso, {name}!',
    ctaLabel:        'Continuar Missão →',
    confettiColors:  ['#f59e0b', '#fcd34d', '#a78bfa', '#7c3aed', '#ffffff', '#ec4899', '#f43f5e'],
    cardBorder:      C.borderGold,
    cardGlow:        'rgba(245,158,11,0.18)',
    gradientText:    'linear-gradient(135deg, #fcd34d 0%, #f59e0b 50%, #d97706 100%)',
  },
  empty_state_friendly: {
    title:           'Sua pasta está com fominha! 📂',
    description:     'Ainda não temos documentos por aqui. Faça o upload dos seus PDFs e vamos começar essa jornada juntos — cada arquivo nos aproxima do seu sonho!',
    ctaLabel:        'Fazer Upload Agora 📎',
    confettiColors:  [],
    cardBorder:      C.borderAccent,
    cardGlow:        'rgba(167,139,250,0.12)',
    gradientText:    'linear-gradient(135deg, #c4b5fd 0%, #a78bfa 50%, #7c3aed 100%)',
  },
}

// ============================================================
// ALL CSS KEYFRAMES
// ============================================================
const KEYFRAMES = `
  @keyframes ringPulse {
    0%   { transform: scale(1);    opacity: 0.7; }
    60%  { transform: scale(1.35); opacity: 0;   }
    100% { transform: scale(1.35); opacity: 0;   }
  }
  @keyframes stampDrop {
    0%   { transform: scale(2.4) rotate(-12deg); opacity: 0; }
    55%  { transform: scale(0.88) rotate(4deg);  opacity: 1; }
    78%  { transform: scale(1.06) rotate(-2deg);              }
    100% { transform: scale(1)    rotate(0deg);               }
  }
  @keyframes thumbsWiggle {
    0%   { transform: rotate(0deg);   }
    25%  { transform: rotate(-14deg); }
    50%  { transform: rotate(10deg);  }
    75%  { transform: rotate(-7deg);  }
    100% { transform: rotate(0deg);   }
  }
  @keyframes rocketLaunch {
    0%   { transform: translateY(32px) scale(0.6); opacity: 0; }
    60%  { transform: translateY(-12px) scale(1.1); opacity: 1; }
    80%  { transform: translateY(4px)  scale(0.97);             }
    100% { transform: translateY(0)    scale(1);                }
  }
  @keyframes rocketHover {
    0%, 100% { transform: translateY(0)    rotate(-2deg); }
    50%      { transform: translateY(-10px) rotate(2deg);  }
  }
  @keyframes starPop1 {
    0%   { transform: translate(0, 0)         scale(0); opacity: 0; }
    50%  { transform: translate(28px, -22px)  scale(1); opacity: 1; }
    100% { transform: translate(34px, -30px)  scale(0); opacity: 0; }
  }
  @keyframes starPop2 {
    0%   { transform: translate(0, 0)          scale(0); opacity: 0; }
    50%  { transform: translate(-26px, -20px)  scale(1); opacity: 1; }
    100% { transform: translate(-32px, -28px)  scale(0); opacity: 0; }
  }
  @keyframes starPop3 {
    0%   { transform: translate(0, 0)         scale(0); opacity: 0; }
    50%  { transform: translate(20px, -32px)  scale(1); opacity: 1; }
    100% { transform: translate(24px, -42px)  scale(0); opacity: 0; }
  }
  @keyframes starPop4 {
    0%   { transform: translate(0, 0)          scale(0); opacity: 0; }
    50%  { transform: translate(-18px, -28px)  scale(1); opacity: 1; }
    100% { transform: translate(-22px, -38px)  scale(0); opacity: 0; }
  }
  @keyframes floatUpDown {
    0%, 100% { transform: translateY(0);   }
    50%      { transform: translateY(-12px); }
  }
  @keyframes eyeBlink {
    0%, 92%, 100% { transform: scaleY(1);   }
    96%           { transform: scaleY(0.1); }
  }
  @keyframes dotBounce {
    0%, 80%, 100% { transform: translateY(0);    opacity: 0.5; }
    40%           { transform: translateY(-8px); opacity: 1;   }
  }
  @keyframes ctaGlow {
    0%, 100% { box-shadow: 0 4px 24px rgba(124,58,237,0.45); }
    50%      { box-shadow: 0 6px 36px rgba(124,58,237,0.75), 0 0 0 6px rgba(124,58,237,0.12); }
  }
  @keyframes ctaGlowSuccess {
    0%, 100% { box-shadow: 0 4px 24px rgba(34,197,94,0.4); }
    50%      { box-shadow: 0 6px 36px rgba(34,197,94,0.65), 0 0 0 6px rgba(34,197,94,0.1); }
  }
  @keyframes ctaGlowGold {
    0%, 100% { box-shadow: 0 4px 24px rgba(245,158,11,0.45); }
    50%      { box-shadow: 0 6px 36px rgba(245,158,11,0.7), 0 0 0 6px rgba(245,158,11,0.12); }
  }
`

// ============================================================
// ICON — document_success
// Animated approval stamp with a thumbs-up
// ============================================================
function IconDocumentSuccess() {
  return (
    <div style={{ position: 'relative', width: 100, height: 100, margin: '0 auto 4px' }}>
      {/* Outer ring */}
      <div style={{
        position: 'absolute',
        inset: -12,
        borderRadius: '50%',
        border: '2px solid rgba(34,197,94,0.4)',
        animation: 'ringPulse 2s ease-out infinite',
      }} />
      {/* Mid ring */}
      <div style={{
        position: 'absolute',
        inset: -4,
        borderRadius: '50%',
        border: '2px solid rgba(34,197,94,0.55)',
        animation: 'ringPulse 2s ease-out 0.35s infinite',
      }} />
      {/* Filled circle */}
      <div style={{
        width: 100,
        height: 100,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, rgba(34,197,94,0.22) 0%, rgba(16,185,129,0.12) 100%)',
        border: '2.5px solid rgba(34,197,94,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'stampDrop 0.65s cubic-bezier(0.175, 0.885, 0.32, 1.275) both',
        position: 'relative',
        zIndex: 1,
      }}>
        <span style={{
          fontSize: 52,
          lineHeight: 1,
          display: 'block',
          animation: 'thumbsWiggle 0.55s ease 0.65s both',
          transformOrigin: 'center bottom',
        }}>
          👍
        </span>
      </div>
    </div>
  )
}

// ============================================================
// ICON — milestone_reached
// Rocket launch with floating star particles
// ============================================================
function IconMilestoneReached() {
  const STARS = [
    { anim: 'starPop1', delay: '0.45s', emoji: '✨', size: 18 },
    { anim: 'starPop2', delay: '0.55s', emoji: '⭐', size: 16 },
    { anim: 'starPop3', delay: '0.60s', emoji: '💫', size: 14 },
    { anim: 'starPop4', delay: '0.70s', emoji: '🌟', size: 14 },
  ]
  return (
    <div style={{ position: 'relative', width: 100, height: 100, margin: '0 auto 4px' }}>
      {/* Star particles */}
      {STARS.map((s, i) => (
        <span key={i} style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          fontSize: s.size,
          lineHeight: 1,
          animation: `${s.anim} 1s ease-out ${s.delay} both`,
          pointerEvents: 'none',
          zIndex: 10,
        }}>
          {s.emoji}
        </span>
      ))}
      {/* Outer glow ring */}
      <div style={{
        position: 'absolute',
        inset: -8,
        borderRadius: '50%',
        border: '2px solid rgba(245,158,11,0.35)',
        animation: 'ringPulse 2.2s ease-out infinite',
      }} />
      {/* Main circle */}
      <div style={{
        width: 100,
        height: 100,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, rgba(245,158,11,0.2) 0%, rgba(124,58,237,0.15) 100%)',
        border: '2.5px solid rgba(245,158,11,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'rocketLaunch 0.7s cubic-bezier(0.175, 0.885, 0.32, 1.275) both',
        position: 'relative',
        zIndex: 1,
      }}>
        <span style={{
          fontSize: 54,
          lineHeight: 1,
          display: 'block',
          animation: 'rocketHover 3.5s ease-in-out 0.7s infinite',
        }}>
          🚀
        </span>
      </div>
    </div>
  )
}

// ============================================================
// ICON — empty_state_friendly
// Floating hungry folder with blinking eyes
// ============================================================
function IconEmptyState() {
  return (
    <div style={{
      position: 'relative',
      width: 120,
      height: 110,
      margin: '0 auto 4px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      animation: 'floatUpDown 3.2s ease-in-out infinite',
    }}>
      {/* Main folder */}
      <span style={{ fontSize: 80, lineHeight: 1, display: 'block', filter: 'drop-shadow(0 4px 16px rgba(167,139,250,0.35))' }}>
        📂
      </span>
      {/* Eyes */}
      <div style={{
        position: 'absolute',
        top: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 10,
      }}>
        <span style={{
          fontSize: 15,
          lineHeight: 1,
          animation: 'eyeBlink 4s ease-in-out 1s infinite',
          display: 'inline-block',
        }}>
          👁️
        </span>
        <span style={{
          fontSize: 15,
          lineHeight: 1,
          animation: 'eyeBlink 4s ease-in-out 1.15s infinite',
          display: 'inline-block',
        }}>
          👁️
        </span>
      </div>
      {/* Hunger bouncing dots */}
      <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: C.accent,
            animation: `dotBounce 1.3s ease-in-out ${i * 0.18}s infinite`,
          }} />
        ))}
      </div>
    </div>
  )
}

// ============================================================
// CTA BUTTON  (pulsing glow, color varies per variant)
// ============================================================
function CtaButton({
  label,
  variant,
  onClick,
}: {
  label: string
  variant: CelebrationVariant
  onClick?: () => void
}) {
  const styles: Record<CelebrationVariant, React.CSSProperties> = {
    document_success: {
      background: 'linear-gradient(135deg, #22c55e, #16a34a)',
      animation: 'ctaGlowSuccess 2.4s ease-in-out infinite',
    },
    milestone_reached: {
      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
      animation: 'ctaGlowGold 2.4s ease-in-out infinite',
    },
    empty_state_friendly: {
      background: `linear-gradient(135deg, ${C.accent}, ${C.accentDark})`,
      animation: 'ctaGlow 2.4s ease-in-out infinite',
    },
  }
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        padding: '15px 28px',
        borderRadius: 14,
        border: 'none',
        color: '#fff',
        fontFamily: F,
        fontSize: 16,
        fontWeight: 800,
        letterSpacing: 0.3,
        cursor: 'pointer',
        transition: 'transform 0.15s ease',
        ...styles[variant],
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.03)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'   }}
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
  const resolvedTitle       = title       ?? cfg.title
  const resolvedDescription = description ?? cfg.description
  const resolvedCta         = ctaLabel    ?? cfg.ctaLabel

  // ── Fire confetti on mount (only for the two celebration types) ──
  useEffect(() => {
    if (!visible || type === 'empty_state_friendly') return

    import('canvas-confetti').then(({ default: confetti }) => {
      const colors = cfg.confettiColors

      // Central burst
      confetti({ particleCount: 90, spread: 65, origin: { y: 0.55 }, colors, disableForReducedMotion: true })

      // Left side burst
      setTimeout(() => {
        confetti({ particleCount: 55, angle: 60, spread: 52, origin: { x: 0 }, colors, disableForReducedMotion: true })
      }, 180)

      // Right side burst
      setTimeout(() => {
        confetti({ particleCount: 55, angle: 120, spread: 52, origin: { x: 1 }, colors, disableForReducedMotion: true })
      }, 340)

      // Late sparkle shower (milestone only — extra dramatic)
      if (type === 'milestone_reached') {
        setTimeout(() => {
          confetti({ particleCount: 40, spread: 80, origin: { y: 0.3 }, colors, scalar: 0.8, disableForReducedMotion: true })
        }, 700)
      }
    })
  }, [visible, type]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Empty state is rendered inline (no backdrop/modal) ──────
  if (type === 'empty_state_friendly') {
    if (!visible) return null
    return (
      <>
        <style>{KEYFRAMES}</style>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '56px 32px',
          textAlign: 'center',
          fontFamily: F,
        }}>
          <IconEmptyState />
          <h3 style={{
            fontSize: 22,
            fontWeight: 800,
            margin: '20px 0 10px',
            backgroundImage: cfg.gradientText,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            {resolvedTitle}
          </h3>
          <p style={{
            fontSize: 15,
            color: C.textSecondary,
            maxWidth: 360,
            margin: '0 0 28px',
            lineHeight: 1.7,
          }}>
            {resolvedDescription}
          </p>
          <div style={{ width: '100%', maxWidth: 300 }}>
            <CtaButton label={resolvedCta} variant={type} onClick={onContinue} />
          </div>
        </div>
      </>
    )
  }

  // ── Modal overlay (document_success + milestone_reached) ────
  return (
    <>
      <style>{KEYFRAMES}</style>
      <AnimatePresence>
        {visible && (
          // Backdrop
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onContinue}
            style={{
              position: 'fixed',
              inset: 0,
              background: C.backdrop,
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9000,
              padding: '20px 16px',
              fontFamily: F,
            }}
          >
            {/* Card — stops event propagation so clicking inside doesn't close */}
            <motion.div
              key="card"
              initial={{ scale: 0.45, y: 80, opacity: 0 }}
              animate={{ scale: 1,    y: 0,  opacity: 1 }}
              exit={{   scale: 0.75,  y: 50, opacity: 0 }}
              transition={{
                type: 'spring',
                stiffness: 390,
                damping: 22,
                mass: 0.9,
              }}
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 480,
                background: cfg.cardGlow
                  ? `radial-gradient(ellipse at top, ${cfg.cardGlow} 0%, transparent 60%), ${C.bgCard}`
                  : C.bgCard,
                border: `1.5px solid ${cfg.cardBorder}`,
                borderRadius: 24,
                padding: '36px 32px 32px',
                boxShadow: `0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px ${cfg.cardBorder}`,
                textAlign: 'center',
                position: 'relative',
              }}
            >
              {/* Close (×) */}
              <button
                onClick={onContinue}
                aria-label="Fechar"
                style={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: C.textMuted,
                  fontSize: 18,
                  lineHeight: '30px',
                  cursor: 'pointer',
                  fontFamily: F,
                  padding: 0,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)' }}
              >
                ×
              </button>

              {/* Animated icon */}
              <div style={{ marginBottom: 20 }}>
                {type === 'document_success'  && <IconDocumentSuccess  />}
                {type === 'milestone_reached' && <IconMilestoneReached />}
              </div>

              {/* Gradient headline */}
              <h2 style={{
                fontSize: 22,
                fontWeight: 900,
                margin: '0 0 12px',
                lineHeight: 1.3,
                backgroundImage: cfg.gradientText,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                {resolvedTitle}
              </h2>

              {/* Body */}
              <p style={{
                fontSize: 15,
                color: C.textSecondary,
                margin: '0 0 28px',
                lineHeight: 1.7,
              }}>
                {resolvedDescription}
              </p>

              {/* CTA */}
              <CtaButton label={resolvedCta} variant={type} onClick={onContinue} />

              {/* Skip link */}
              <button
                onClick={onContinue}
                style={{
                  marginTop: 14,
                  background: 'none',
                  border: 'none',
                  color: C.textMuted,
                  fontFamily: F,
                  fontSize: 13,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  textDecorationColor: 'rgba(100,116,139,0.4)',
                  letterSpacing: 0.2,
                  padding: 0,
                  display: 'block',
                  width: '100%',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = C.textSecondary }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = C.textMuted    }}
              >
                Pular por agora
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

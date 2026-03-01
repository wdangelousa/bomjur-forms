'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  createI140Petition,
  type I140PetitionPayload,
} from '@/app/actions/i140Actions'

// ============================================================
// TYPES
// ============================================================
type Step = 1 | 2 | 3

type VisaCategory = 'EB-1A' | 'EB-1B' | 'EB-2 NIW' | 'EB-2' | 'EB-3' | 'EB-3 Other'

interface PetitionForm {
  category: VisaCategory | ''
  priorityDate: string
  notes: string
  fullName: string
  email: string
  phone: string
  birthCountry: string
  birthDate: string
}

type ToastVariant = 'success' | 'error' | 'info'

interface ToastState {
  visible: boolean
  variant: ToastVariant
  message: string
}

// ============================================================
// DESIGN TOKENS
// ============================================================
const C = {
  bgPage:        'linear-gradient(135deg, #0f0c29 0%, #302b63 60%, #24243e 100%)',
  bgCard:        'rgba(255,255,255,0.05)',
  bgInput:       'rgba(255,255,255,0.06)',
  bgInputFocus:  'rgba(255,255,255,0.09)',
  border:        'rgba(255,255,255,0.08)',
  borderAccent:  'rgba(167,139,250,0.4)',
  borderFocus:   'rgba(167,139,250,0.6)',
  textPrimary:   '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted:     '#64748b',
  accent:        '#a78bfa',
  accentDark:    '#7c3aed',
  success:       '#22c55e',
  gold:          '#f59e0b',
  error:         '#ef4444',
}

const F = "'Inter', system-ui, sans-serif"

// ============================================================
// VISA CATEGORY DATA
// ============================================================
interface CategoryInfo {
  id: VisaCategory
  label: string
  subtitle: string
  icon: string
  color: string
  colorBg: string
  colorBorder: string
  tag: string
}

const VISA_CATEGORIES: CategoryInfo[] = [
  { id: 'EB-1A',      label: 'EB-1A',      subtitle: 'Alien of Extraordinary Ability',       icon: '🏆', color: '#fbbf24', colorBg: 'rgba(251,191,36,0.08)',  colorBorder: 'rgba(251,191,36,0.3)',  tag: 'Sem Patrocinador'   },
  { id: 'EB-1B',      label: 'EB-1B',      subtitle: 'Outstanding Researcher or Professor',   icon: '🔬', color: '#60a5fa', colorBg: 'rgba(96,165,250,0.08)',   colorBorder: 'rgba(96,165,250,0.3)',  tag: 'Requer Patrocinador' },
  { id: 'EB-2 NIW',   label: 'EB-2 NIW',   subtitle: 'National Interest Waiver',              icon: '🌎', color: '#a78bfa', colorBg: 'rgba(167,139,250,0.08)', colorBorder: 'rgba(167,139,250,0.3)', tag: 'Sem Patrocinador'   },
  { id: 'EB-2',       label: 'EB-2',       subtitle: 'Advanced Degree Professionals',         icon: '🎓', color: '#34d399', colorBg: 'rgba(52,211,153,0.08)',   colorBorder: 'rgba(52,211,153,0.3)',  tag: 'Requer Patrocinador' },
  { id: 'EB-3',       label: 'EB-3',       subtitle: 'Skilled Workers & Professionals',       icon: '⚙️', color: '#f472b6', colorBg: 'rgba(244,114,182,0.08)', colorBorder: 'rgba(244,114,182,0.3)', tag: 'Requer Patrocinador' },
  { id: 'EB-3 Other', label: 'EB-3 Other', subtitle: 'Other Workers (unskilled)',             icon: '🛠️', color: '#fb923c', colorBg: 'rgba(251,146,60,0.08)',   colorBorder: 'rgba(251,146,60,0.3)',  tag: 'Requer Patrocinador' },
]

const COUNTRIES = [
  'Brasil', 'Argentina', 'México', 'Colômbia', 'Chile', 'Peru',
  'Venezuela', 'Equador', 'Bolívia', 'Uruguai', 'Paraguai',
  'Portugal', 'Espanha', 'França', 'Alemanha', 'Itália',
  'China', 'Índia', 'Coréia do Sul', 'Japão',
  'Canadá', 'Estados Unidos', 'Reino Unido', 'Austrália',
  'Outro',
]

// ── Country normalizer: English/raw → our COUNTRIES list ────────────────────
const COUNTRY_ALIASES: Record<string, string> = {
  'brazil': 'Brasil', 'india': 'Índia', 'china': 'China',
  'south korea': 'Coréia do Sul', 'korea': 'Coréia do Sul',
  'mexico': 'México', 'colombia': 'Colômbia',
  'united states': 'Estados Unidos', 'usa': 'Estados Unidos', 'u.s.a.': 'Estados Unidos',
  'canada': 'Canadá', 'united kingdom': 'Reino Unido', 'uk': 'Reino Unido',
  'australia': 'Austrália', 'france': 'França', 'germany': 'Alemanha',
  'italy': 'Itália', 'spain': 'Espanha', 'japan': 'Japão',
  'argentina': 'Argentina', 'chile': 'Chile', 'peru': 'Peru',
  'venezuela': 'Venezuela', 'ecuador': 'Equador', 'bolivia': 'Bolívia',
  'uruguay': 'Uruguai', 'paraguay': 'Paraguai', 'portugal': 'Portugal',
}

function matchCountry(raw: string): string {
  if (!raw) return ''
  const norm = raw.trim()
  const exact = COUNTRIES.find(c => c.toLowerCase() === norm.toLowerCase())
  if (exact) return exact
  const aliased = COUNTRY_ALIASES[norm.toLowerCase()]
  if (aliased && COUNTRIES.includes(aliased)) return aliased
  const partial = COUNTRIES.find(c =>
    norm.toLowerCase().includes(c.toLowerCase()) ||
    c.toLowerCase().includes(norm.toLowerCase()),
  )
  return partial ?? ''
}

// ============================================================
// STEPPER
// ============================================================
const STEPS = [
  { number: 1, label: 'Petição',      icon: '📋' },
  { number: 2, label: 'Beneficiário', icon: '👤' },
  { number: 3, label: 'Revisão',      icon: '✅' },
]

function Stepper({ current }: { current: Step }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 40 }}>
      {STEPS.map((step, idx) => {
        const isDone    = current > step.number
        const isActive  = current === step.number
        const isPending = current < step.number
        return (
          <React.Fragment key={step.number}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: isDone ? 20 : 15, fontWeight: 800,
                transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                background: isDone
                  ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                  : isActive
                    ? `linear-gradient(135deg, ${C.accent}, ${C.accentDark})`
                    : 'rgba(255,255,255,0.04)',
                border: isDone
                  ? '2px solid rgba(34,197,94,0.5)'
                  : isActive
                    ? '2px solid rgba(167,139,250,0.6)'
                    : `2px solid ${C.border}`,
                color: isPending ? C.textMuted : '#fff',
                boxShadow: isActive
                  ? '0 0 24px rgba(167,139,250,0.4)'
                  : isDone ? '0 0 16px rgba(34,197,94,0.3)' : 'none',
              }}>
                {isDone ? '✓' : isActive ? step.icon : step.number}
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: 11, fontWeight: isDone || isActive ? 700 : 500,
                  color: isDone ? C.success : isActive ? C.accent : C.textMuted,
                  letterSpacing: 0.3, whiteSpace: 'nowrap', transition: 'color 0.3s',
                }}>
                  {step.label}
                </div>
                <div style={{ fontSize: 10, color: C.textMuted, marginTop: 1 }}>Passo {step.number}</div>
              </div>
            </div>
            {idx < STEPS.length - 1 && (
              <div style={{
                width: 80, height: 2, marginBottom: 28, borderRadius: 99, flexShrink: 0,
                background: current > step.number
                  ? 'linear-gradient(90deg, #22c55e, rgba(34,197,94,0.3))'
                  : `linear-gradient(90deg, ${C.border}, ${C.border})`,
                transition: 'background 0.5s ease',
              }} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ============================================================
// TOAST
// ============================================================
function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  useEffect(() => {
    if (!toast.visible) return
    const t = setTimeout(onClose, 6000)
    return () => clearTimeout(t)
  }, [toast.visible, onClose])

  if (!toast.visible) return null

  const isSuccess = toast.variant === 'success'
  const isInfo    = toast.variant === 'info'
  const bg     = isSuccess ? 'linear-gradient(135deg, rgba(22,163,74,0.18), rgba(34,197,94,0.10))'
    : isInfo    ? 'linear-gradient(135deg, rgba(59,130,246,0.18), rgba(99,102,241,0.10))'
                : 'linear-gradient(135deg, rgba(185,28,28,0.18), rgba(239,68,68,0.10))'
  const bdr    = isSuccess ? 'rgba(34,197,94,0.4)'  : isInfo ? 'rgba(99,102,241,0.4)'  : 'rgba(239,68,68,0.4)'
  const shadow = isSuccess ? 'rgba(34,197,94,0.2)'  : isInfo ? 'rgba(99,102,241,0.2)'  : 'rgba(239,68,68,0.2)'
  const tColor = isSuccess ? '#4ade80'               : isInfo ? '#818cf8'               : '#f87171'
  const label  = isSuccess ? 'Sucesso!'              : isInfo ? 'Atenção'               : 'Erro'
  const icon   = isSuccess ? '✓'                     : isInfo ? 'ℹ'                     : '✕'

  return (
    <div style={{
      position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, minWidth: 320, maxWidth: 500,
      background: bg, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      border: `1.5px solid ${bdr}`, borderRadius: 16, padding: '14px 18px',
      boxShadow: `0 16px 48px ${shadow}, 0 4px 16px rgba(0,0,0,0.4)`,
      display: 'flex', alignItems: 'flex-start', gap: 12, fontFamily: F,
      animation: 'toastIn 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) both',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, background: `${tColor}22`,
        border: `1px solid ${tColor}44`, display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 18, flexShrink: 0, color: tColor,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: tColor, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.5, wordBreak: 'break-word' }}>
          {toast.message}
        </div>
      </div>
      <button onClick={onClose} style={{
        background: 'none', border: 'none', color: C.textMuted,
        fontSize: 18, cursor: 'pointer', padding: '2px 4px', lineHeight: 1, flexShrink: 0, marginTop: 1,
      }}>×</button>
    </div>
  )
}

// ============================================================
// FAST TRACK CARD — Upload real + chamada IA
// ============================================================
function FastTrackCard({
  onAutofill,
  onToast,
  onReadingChange,
}: {
  onAutofill: (partial: Partial<PetitionForm>) => void
  onToast: (variant: ToastVariant, message: string) => void
  onReadingChange: (reading: boolean) => void
}) {
  const [dragOver, setDragOver] = useState(false)
  const [reading,  setReading]  = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function setReadingState(v: boolean) {
    setReading(v)
    onReadingChange(v)
  }

  async function processFile(file: File) {
    setReadingState(true)
    try {
      const fd = new FormData()
      fd.append('file', file)

      const res  = await fetch('/api/fast-track', { method: 'POST', body: fd })
      const json = await res.json()

      if (!res.ok) throw new Error(json.error || 'Erro ao processar o documento.')

      // ── Mapeamento da resposta → campos do formulário ──────────────────────
      const patch: Partial<PetitionForm> = {}

      if (json.category && VISA_CATEGORIES.some(c => c.id === json.category)) {
        patch.category = json.category as VisaCategory
      }
      if (json.priorityDate)      patch.priorityDate = json.priorityDate
      if (json.fullName?.trim())  patch.fullName     = json.fullName.trim()
      if (json.birthDate)         patch.birthDate    = json.birthDate
      if (json.birthCountry) {
        const matched = matchCountry(json.birthCountry)
        if (matched) patch.birthCountry = matched
      }

      onAutofill(patch)

      const count = Object.keys(patch).length
      onToast(
        count > 0 ? 'success' : 'info',
        count > 0
          ? `Documento lido! ${count} campo${count > 1 ? 's preenchidos' : ' preenchido'} automaticamente. Revise os dados.`
          : 'Documento lido, mas não encontramos campos reconhecíveis. Preencha manualmente.',
      )
    } catch (e) {
      onToast('error', `Erro ao ler o documento: ${(e as Error).message}`)
    } finally {
      setReadingState(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file && !reading) processFile(file)
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); if (!reading) setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      style={{
        background: reading
          ? 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(167,139,250,0.10) 100%)'
          : 'linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(167,139,250,0.06) 100%)',
        border: `1.5px solid ${dragOver ? 'rgba(245,158,11,0.7)' : reading ? 'rgba(245,158,11,0.55)' : 'rgba(245,158,11,0.28)'}`,
        borderRadius: 18, padding: '22px 24px', marginBottom: 32,
        position: 'relative', overflow: 'hidden',
        transition: 'border-color 0.2s, background 0.3s, box-shadow 0.2s',
        boxShadow: reading
          ? '0 0 48px rgba(245,158,11,0.22), 0 4px 24px rgba(0,0,0,0.2)'
          : dragOver ? '0 0 32px rgba(245,158,11,0.18)' : '0 4px 24px rgba(0,0,0,0.2)',
        animation: reading ? 'cardPulse 2s ease-in-out infinite' : 'none',
      }}
    >
      {/* Decorative orb */}
      <div style={{
        position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%',
        background: reading
          ? 'radial-gradient(circle, rgba(245,158,11,0.22) 0%, transparent 70%)'
          : 'radial-gradient(circle, rgba(245,158,11,0.12) 0%, transparent 70%)',
        pointerEvents: 'none', transition: 'background 0.4s',
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, position: 'relative' }}>
        {/* Icon */}
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(251,146,60,0.15))',
          border: '1.5px solid rgba(245,158,11,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, flexShrink: 0, boxShadow: '0 4px 16px rgba(245,158,11,0.2)',
        }}>
          {reading ? '🤖' : '⚡'}
        </div>

        <div style={{ flex: 1 }}>
          {/* Badge */}
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '2px 10px', borderRadius: 20, marginBottom: 8,
            fontSize: 10, fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: 1.1,
            background: 'rgba(245,158,11,0.15)', color: C.gold, border: '1px solid rgba(245,158,11,0.3)',
          }}>
            <span style={{
              width: 5, height: 5, borderRadius: '50%', background: C.gold, display: 'inline-block',
              boxShadow: '0 0 6px rgba(245,158,11,0.8)', animation: 'dotPulse 1.8s ease-in-out infinite',
            }} />
            Fast Track com IA
          </span>

          <h3 style={{ fontSize: 16, fontWeight: 800, color: C.textPrimary, margin: '0 0 6px', lineHeight: 1.35 }}>
            {reading ? 'A IA está analisando seu documento…' : 'Já tem o I-797? Deixe a IA preencher por você'}
          </h3>
          <p style={{ fontSize: 13, color: C.textSecondary, margin: '0 0 16px', lineHeight: 1.65 }}>
            {reading
              ? 'Aguarde enquanto nossa IA extrai os dados do documento. Os campos serão preenchidos automaticamente.'
              : 'Faça o upload do seu I-797 ou documento similar. Nossa IA preencherá todos os campos em segundos.'}
          </p>

          {/* Hidden file input */}
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          {/* Upload button */}
          <button
            disabled={reading}
            onClick={() => inputRef.current?.click()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', borderRadius: 11, fontFamily: F,
              fontSize: 13, fontWeight: 700, cursor: reading ? 'not-allowed' : 'pointer',
              letterSpacing: 0.2, transition: 'all 0.2s',
              background: reading
                ? 'linear-gradient(135deg, rgba(245,158,11,0.28), rgba(251,146,60,0.20))'
                : 'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(251,146,60,0.12))',
              border: `1.5px solid ${reading ? 'rgba(245,158,11,0.65)' : 'rgba(245,158,11,0.4)'}`,
              color: C.gold,
              animation: reading ? 'buttonGlow 1.6s ease-in-out infinite' : 'none',
            }}
            onMouseEnter={e => {
              if (reading) return
              ;(e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg, rgba(245,158,11,0.25), rgba(251,146,60,0.18))'
              ;(e.currentTarget as HTMLButtonElement).style.boxShadow  = '0 4px 20px rgba(245,158,11,0.25)'
            }}
            onMouseLeave={e => {
              if (reading) return
              ;(e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(251,146,60,0.12))'
              ;(e.currentTarget as HTMLButtonElement).style.boxShadow  = 'none'
            }}
          >
            {reading ? (
              <>
                <span style={{
                  width: 14, height: 14, borderRadius: '50%', display: 'inline-block', flexShrink: 0,
                  border: '2px solid rgba(245,158,11,0.3)', borderTop: `2px solid ${C.gold}`,
                  animation: 'spin 0.75s linear infinite',
                }} />
                Lendo documento…
              </>
            ) : (
              <>
                <span style={{ fontSize: 16 }}>📎</span>
                Fazer Upload do I-797
                <span style={{
                  fontSize: 10, padding: '1px 7px', borderRadius: 6,
                  background: 'rgba(245,158,11,0.15)', letterSpacing: 0.5, fontWeight: 600,
                }}>
                  PDF ou Imagem
                </span>
              </>
            )}
          </button>

          {dragOver && !reading && (
            <p style={{ fontSize: 12, color: C.gold, margin: '10px 0 0', fontWeight: 600 }}>
              Solte o arquivo aqui ↓
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// CATEGORY CARD  (com suporte a disabled)
// ============================================================
function CategoryCard({
  cat, selected, onSelect, disabled = false,
}: {
  cat: CategoryInfo; selected: boolean; onSelect: () => void; disabled?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={() => { if (!disabled) onSelect() }}
      onMouseEnter={() => { if (!disabled) setHovered(true) }}
      onMouseLeave={() => setHovered(false)}
      style={{
        cursor: disabled ? 'not-allowed' : 'pointer',
        borderRadius: 14, padding: '16px 18px',
        border: selected
          ? `2px solid ${cat.color}`
          : `1.5px solid ${hovered ? cat.colorBorder : C.border}`,
        background: selected ? cat.colorBg : hovered ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
        transition: 'all 0.2s',
        transform: selected ? 'translateY(-2px)' : hovered ? 'translateY(-1px)' : 'none',
        boxShadow: selected ? `0 8px 28px ${cat.color}22` : hovered ? '0 4px 16px rgba(0,0,0,0.3)' : 'none',
        position: 'relative',
        opacity: disabled ? 0.45 : 1,
        userSelect: 'none' as const,
      }}
    >
      {selected && (
        <div style={{
          position: 'absolute', top: 10, right: 10,
          width: 20, height: 20, borderRadius: '50%',
          background: cat.color, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 11, color: '#fff', fontWeight: 800,
        }}>✓</div>
      )}
      <div style={{ fontSize: 30, marginBottom: 10, lineHeight: 1 }}>{cat.icon}</div>
      <div style={{ fontSize: 17, fontWeight: 800, color: selected ? cat.color : C.textPrimary, marginBottom: 4, letterSpacing: -0.3, transition: 'color 0.2s' }}>
        {cat.label}
      </div>
      <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 12, lineHeight: 1.5 }}>
        {cat.subtitle}
      </div>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '2px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700, letterSpacing: 0.4,
        background: `${cat.color}15`, color: cat.color, border: `1px solid ${cat.color}30`,
      }}>
        {cat.tag}
      </span>
    </div>
  )
}

// ============================================================
// FORM PRIMITIVES  (com suporte a disabled)
// ============================================================
function FormField({
  label, required, hint, children, disabled,
}: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode; disabled?: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, opacity: disabled ? 0.55 : 1, transition: 'opacity 0.3s' }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: C.textSecondary, letterSpacing: 0.2 }}>
        {label}
        {required && <span style={{ color: C.error, marginLeft: 4 }}>*</span>}
        {disabled && (
          <span style={{
            marginLeft: 8, fontSize: 10, color: C.textMuted, fontWeight: 500,
            background: 'rgba(255,255,255,0.05)', padding: '1px 7px', borderRadius: 6,
            border: `1px solid ${C.border}`,
          }}>
            bloqueado — IA lendo
          </span>
        )}
      </label>
      {children}
      {hint && <p style={{ fontSize: 11, color: C.textMuted, margin: 0, lineHeight: 1.5 }}>{hint}</p>}
    </div>
  )
}

function TextInput({
  value, onChange, placeholder, type = 'text', disabled = false,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; disabled?: boolean
}) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: '100%', padding: '13px 16px', borderRadius: 11,
        background: focused ? C.bgInputFocus : C.bgInput,
        border: `1.5px solid ${focused ? C.borderFocus : C.border}`,
        color: C.textPrimary, fontFamily: F, fontSize: 14, fontWeight: 500,
        outline: 'none', transition: 'all 0.2s',
        boxShadow: focused ? '0 0 0 3px rgba(167,139,250,0.1)' : 'none',
        cursor: disabled ? 'not-allowed' : 'text',
      }}
    />
  )
}

function SelectInput({
  value, onChange, options, placeholder, disabled = false,
}: {
  value: string; onChange: (v: string) => void; options: string[]; placeholder?: string; disabled?: boolean
}) {
  const [focused, setFocused] = useState(false)
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: '100%', padding: '13px 16px', borderRadius: 11,
        background: focused ? C.bgInputFocus : C.bgInput,
        border: `1.5px solid ${focused ? C.borderFocus : C.border}`,
        color: value ? C.textPrimary : C.textMuted,
        fontFamily: F, fontSize: 14, fontWeight: 500,
        outline: 'none', transition: 'all 0.2s',
        cursor: disabled ? 'not-allowed' : 'pointer',
        appearance: 'none', WebkitAppearance: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center', paddingRight: 40,
        boxShadow: focused ? '0 0 0 3px rgba(167,139,250,0.1)' : 'none',
      }}
    >
      {placeholder && <option value="" style={{ background: '#1a1040' }}>{placeholder}</option>}
      {options.map(opt => (
        <option key={opt} value={opt} style={{ background: '#1a1040', color: '#f1f5f9' }}>{opt}</option>
      ))}
    </select>
  )
}

function TextAreaInput({
  value, onChange, placeholder, rows = 3, disabled = false,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; disabled?: boolean
}) {
  const [focused, setFocused] = useState(false)
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: '100%', padding: '13px 16px', borderRadius: 11,
        background: focused ? C.bgInputFocus : C.bgInput,
        border: `1.5px solid ${focused ? C.borderFocus : C.border}`,
        color: C.textPrimary, fontFamily: F, fontSize: 14, fontWeight: 500,
        outline: 'none', resize: 'vertical', transition: 'all 0.2s',
        boxShadow: focused ? '0 0 0 3px rgba(167,139,250,0.1)' : 'none',
        lineHeight: 1.6, cursor: disabled ? 'not-allowed' : 'text',
      }}
    />
  )
}

// ============================================================
// REVIEW CARDS  (Step 3)
// ============================================================
function ReviewSection({
  title, icon, onEdit, children,
}: {
  title: string; icon: string; onEdit: () => void; children: React.ReactNode
}) {
  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '14px 20px', borderBottom: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.02)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>{icon}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>{title}</span>
        </div>
        <button onClick={onEdit} style={{
          padding: '5px 14px', borderRadius: 8,
          background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.25)',
          color: C.accent, fontFamily: F, fontSize: 12, fontWeight: 700, cursor: 'pointer', letterSpacing: 0.2,
        }}>Editar</button>
      </div>
      <div style={{ padding: '18px 20px' }}>{children}</div>
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', gap: 16,
    }}>
      <span style={{ fontSize: 13, color: C.textMuted, fontWeight: 500, flexShrink: 0 }}>{label}</span>
      <span style={{
        fontSize: 13, color: value ? C.textPrimary : C.textMuted,
        fontWeight: value ? 600 : 400, textAlign: 'right',
        fontStyle: value ? 'normal' : 'italic',
      }}>
        {value || '— não informado —'}
      </span>
    </div>
  )
}

// ============================================================
// STEP 1 — Informações da Petição
// ============================================================
function Step1({
  form, onChange, onAutofill, onToast, onReadingChange, reading,
}: {
  form: PetitionForm
  onChange: (partial: Partial<PetitionForm>) => void
  onAutofill: (partial: Partial<PetitionForm>) => void
  onToast: (variant: ToastVariant, message: string) => void
  onReadingChange: (reading: boolean) => void
  reading: boolean
}) {
  return (
    <div>
      <FastTrackCard
        onAutofill={onAutofill}
        onToast={onToast}
        onReadingChange={onReadingChange}
      />

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
        <div style={{ flex: 1, height: 1, background: C.border }} />
        <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 600, letterSpacing: 0.5 }}>
          ou preencha manualmente
        </span>
        <div style={{ flex: 1, height: 1, background: C.border }} />
      </div>

      {/* Category selector */}
      <div style={{ marginBottom: 28 }}>
        <div style={{
          fontSize: 14, fontWeight: 700, color: C.textSecondary, marginBottom: 16, letterSpacing: 0.2,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span>Categoria do Visto <span style={{ color: C.error }}>*</span></span>
          {reading && (
            <span style={{
              fontSize: 10, color: C.textMuted, fontWeight: 500,
              background: 'rgba(255,255,255,0.05)', padding: '1px 7px', borderRadius: 6,
              border: `1px solid ${C.border}`,
            }}>
              bloqueado — IA lendo
            </span>
          )}
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12,
          pointerEvents: reading ? 'none' : 'auto',
        }}>
          {VISA_CATEGORIES.map(cat => (
            <CategoryCard
              key={cat.id}
              cat={cat}
              selected={form.category === cat.id}
              onSelect={() => onChange({ category: cat.id })}
              disabled={reading}
            />
          ))}
        </div>
        {!form.category && !reading && (
          <p style={{ fontSize: 12, color: C.textMuted, marginTop: 12, marginBottom: 0 }}>
            Selecione a categoria que melhor se aplica ao beneficiário.
          </p>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <FormField label="Data de Prioridade" hint="Data de protocolo junto ao USCIS." disabled={reading}>
          <TextInput
            type="date" value={form.priorityDate}
            onChange={v => onChange({ priorityDate: v })} disabled={reading}
          />
        </FormField>
      </div>

      <FormField label="Observações Internas" hint="Visível apenas para a equipe de consultoria." disabled={reading}>
        <TextAreaInput
          value={form.notes}
          onChange={v => onChange({ notes: v })}
          placeholder="Ex: Cliente tem publicações em NeurIPS. Conferir carta de recomendação pendente."
          rows={4}
          disabled={reading}
        />
      </FormField>
    </div>
  )
}

// ============================================================
// STEP 2 — Dados do Beneficiário
// ============================================================
function Step2({
  form, onChange,
}: {
  form: PetitionForm
  onChange: (partial: Partial<PetitionForm>) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <FormField label="Nome Completo" required hint="Exatamente como aparece no passaporte.">
        <TextInput
          value={form.fullName}
          onChange={v => onChange({ fullName: v })}
          placeholder="Ex: Ana Beatriz Silva Rodrigues"
        />
      </FormField>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <FormField label="E-mail" required>
          <TextInput type="email" value={form.email} onChange={v => onChange({ email: v })} placeholder="email@exemplo.com" />
        </FormField>
        <FormField label="Telefone / WhatsApp" hint="Inclua código do país (+55)">
          <TextInput type="tel" value={form.phone} onChange={v => onChange({ phone: v })} placeholder="+55 11 99999-9999" />
        </FormField>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <FormField label="País de Nascimento" required>
          <SelectInput
            value={form.birthCountry}
            onChange={v => onChange({ birthCountry: v })}
            options={COUNTRIES}
            placeholder="Selecione o país..."
          />
        </FormField>
        <FormField label="Data de Nascimento" hint="Necessário para verificar retrogresso.">
          <TextInput type="date" value={form.birthDate} onChange={v => onChange({ birthDate: v })} />
        </FormField>
      </div>

      <div style={{
        background: 'rgba(167,139,250,0.05)', border: '1px solid rgba(167,139,250,0.18)',
        borderRadius: 12, padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'flex-start',
      }}>
        <span style={{ fontSize: 18, flexShrink: 0 }}>ℹ️</span>
        <p style={{ fontSize: 12, color: C.textSecondary, margin: 0, lineHeight: 1.7 }}>
          <strong style={{ color: C.accent }}>Por que pedimos esses dados?</strong>{' '}
          O país de nascimento determina a fila de retrogresso (Visa Bulletin). A data
          de nascimento é usada para verificar inconsistências nos documentos. Esses dados
          são armazenados com segurança e nunca compartilhados sem autorização.
        </p>
      </div>
    </div>
  )
}

// ============================================================
// STEP 3 — Revisão e Salvar
// ============================================================
function Step3({
  form, onGoToStep,
}: {
  form: PetitionForm
  onGoToStep: (s: Step) => void
}) {
  const catInfo = VISA_CATEGORIES.find(c => c.id === form.category)

  function formatDate(d: string) {
    if (!d) return ''
    return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  }

  return (
    <div>
      <div style={{
        textAlign: 'center', marginBottom: 28, padding: '20px 24px',
        background: 'rgba(167,139,250,0.05)', border: '1px solid rgba(167,139,250,0.15)', borderRadius: 16,
      }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>🔍</div>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: C.textPrimary, margin: '0 0 8px', letterSpacing: -0.3 }}>
          Revise os dados antes de criar
        </h3>
        <p style={{ fontSize: 13, color: C.textSecondary, margin: 0, lineHeight: 1.6 }}>
          Confirme se todas as informações estão corretas. Você poderá editar depois da criação.
        </p>
      </div>

      <ReviewSection title="Informações da Petição" icon="📋" onEdit={() => onGoToStep(1)}>
        <ReviewRow label="Categoria" value={catInfo ? `${catInfo.label} — ${catInfo.subtitle}` : form.category} />
        <ReviewRow label="Data de Prioridade" value={formatDate(form.priorityDate)} />
        <div style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <span style={{ fontSize: 13, color: C.textMuted, fontWeight: 500, display: 'block', marginBottom: 6 }}>
            Observações
          </span>
          <span style={{
            fontSize: 13, color: form.notes ? C.textPrimary : C.textMuted,
            fontStyle: form.notes ? 'normal' : 'italic', lineHeight: 1.6, display: 'block',
          }}>
            {form.notes || '— não informado —'}
          </span>
        </div>
      </ReviewSection>

      <ReviewSection title="Dados do Beneficiário" icon="👤" onEdit={() => onGoToStep(2)}>
        <ReviewRow label="Nome Completo"      value={form.fullName} />
        <ReviewRow label="E-mail"             value={form.email} />
        <ReviewRow label="Telefone"           value={form.phone} />
        <ReviewRow label="País de Nascimento" value={form.birthCountry} />
        <ReviewRow label="Data de Nascimento" value={formatDate(form.birthDate)} />
      </ReviewSection>

      {catInfo && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
          background: catInfo.colorBg, border: `1px solid ${catInfo.colorBorder}`,
          borderRadius: 12, marginTop: 4,
        }}>
          <span style={{ fontSize: 24 }}>{catInfo.icon}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: catInfo.color }}>
              {catInfo.label} — {catInfo.subtitle}
            </div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{catInfo.tag}</div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// NAVIGATION FOOTER
// ============================================================
function WizardFooter({
  step, canAdvance, creating, reading,
  onBack, onNext, onCreate,
}: {
  step: Step; canAdvance: boolean; creating: boolean; reading: boolean
  onBack: () => void; onNext: () => void; onCreate: () => void
}) {
  const blocked = creating || reading

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginTop: 40, paddingTop: 24, borderTop: `1px solid ${C.border}`,
      gap: 16, flexWrap: 'wrap' as const,
    }}>
      {/* Back */}
      <button
        onClick={onBack}
        disabled={blocked}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '12px 22px', borderRadius: 11,
          background: 'transparent', border: `1.5px solid ${C.border}`,
          color: C.textSecondary, fontFamily: F, fontSize: 14, fontWeight: 600,
          cursor: blocked ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s', letterSpacing: 0.1, opacity: blocked ? 0.5 : 1,
        }}
        onMouseEnter={e => {
          if (blocked) return
          ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.18)'
          ;(e.currentTarget as HTMLButtonElement).style.color = C.textPrimary
        }}
        onMouseLeave={e => {
          ;(e.currentTarget as HTMLButtonElement).style.borderColor = C.border
          ;(e.currentTarget as HTMLButtonElement).style.color = C.textSecondary
        }}
      >
        ← {step === 1 ? 'Dashboard' : 'Voltar'}
      </button>

      <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 500 }}>
        {reading ? '🤖 IA processando…' : `Passo ${step} de 3`}
      </span>

      {/* Advance / Create */}
      {step < 3 ? (
        <button
          onClick={onNext}
          disabled={!canAdvance || reading}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '12px 28px', borderRadius: 11,
            background: canAdvance && !reading
              ? `linear-gradient(135deg, ${C.accent}, ${C.accentDark})`
              : 'rgba(255,255,255,0.06)',
            border: 'none',
            color: canAdvance && !reading ? '#fff' : C.textMuted,
            fontFamily: F, fontSize: 14, fontWeight: 700,
            cursor: canAdvance && !reading ? 'pointer' : 'not-allowed',
            boxShadow: canAdvance && !reading ? '0 4px 20px rgba(124,58,237,0.4)' : 'none',
            letterSpacing: 0.2, transition: 'all 0.2s',
          }}
        >
          {reading ? (
            <>
              <span style={{
                width: 14, height: 14, borderRadius: '50%', display: 'inline-block', flexShrink: 0,
                border: '2px solid rgba(255,255,255,0.2)', borderTop: '2px solid rgba(255,255,255,0.6)',
                animation: 'spin 0.7s linear infinite',
              }} />
              Aguarde…
            </>
          ) : 'Avançar →'}
        </button>
      ) : (
        <button
          onClick={onCreate}
          disabled={creating}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '12px 28px', borderRadius: 11,
            background: creating ? 'rgba(34,197,94,0.5)' : 'linear-gradient(135deg, #22c55e, #16a34a)',
            border: 'none', color: '#fff',
            fontFamily: F, fontSize: 14, fontWeight: 700,
            cursor: creating ? 'not-allowed' : 'pointer',
            boxShadow: creating ? 'none' : '0 4px 20px rgba(34,197,94,0.4)',
            letterSpacing: 0.2, transition: 'all 0.2s', opacity: creating ? 0.85 : 1,
          }}
        >
          {creating ? (
            <>
              <span style={{
                width: 14, height: 14, borderRadius: '50%', display: 'inline-block', flexShrink: 0,
                border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff',
                animation: 'spin 0.7s linear infinite',
              }} />
              Salvando...
            </>
          ) : '✓ Criar Petição'}
        </button>
      )}
    </div>
  )
}

// ============================================================
// MAIN PAGE
// ============================================================
export default function NewI140Page() {
  const router = useRouter()

  const [step,     setStep]     = useState<Step>(1)
  const [creating, setCreating] = useState(false)
  const [reading,  setReading]  = useState(false)          // IA lendo documento
  const [toast,    setToast]    = useState<ToastState>({ visible: false, variant: 'success', message: '' })
  const [form, setForm] = useState<PetitionForm>({
    category: '', priorityDate: '', notes: '',
    fullName: '', email: '', phone: '', birthCountry: '', birthDate: '',
  })

  const updateForm = useCallback((partial: Partial<PetitionForm>) => {
    setForm(prev => ({ ...prev, ...partial }))
  }, [])

  const showToast = useCallback((variant: ToastVariant, message: string) => {
    setToast({ visible: true, variant, message })
  }, [])

  const closeToast = useCallback(() => {
    setToast(prev => ({ ...prev, visible: false }))
  }, [])

  // Validation: block also while reading
  const canAdvance =
    !reading && (
      step === 1 ? !!form.category :
      step === 2 ? !!(form.fullName.trim() && form.email.trim() && form.birthCountry) :
      true
    )

  const handleBack = () => {
    if (step === 1) router.push('/dashboard/i140')
    else setStep(prev => (prev - 1) as Step)
  }

  const handleNext = () => {
    if (!canAdvance) return
    setStep(prev => (prev + 1) as Step)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCreate = async () => {
    setCreating(true)
    const payload: I140PetitionPayload = {
      category: form.category, priorityDate: form.priorityDate, notes: form.notes,
      fullName: form.fullName, email: form.email, phone: form.phone,
      birthCountry: form.birthCountry, birthDate: form.birthDate,
    }
    const result = await createI140Petition(payload)
    if (result.success) {
      showToast('success', 'Petição criada com sucesso! Redirecionando...')
      setTimeout(() => router.push('/dashboard/i140'), 1600)
    } else {
      showToast('error', result.error)
      setCreating(false)
    }
  }

  const STEP_TITLES = ['Informações da Petição', 'Dados do Beneficiário', 'Revisão e Salvar']

  return (
    <div style={{ minHeight: '100vh', background: C.bgPage, fontFamily: F, color: C.textPrimary }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes dotPulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 6px rgba(245,158,11,0.8); }
          50%       { opacity: 0.6; box-shadow: 0 0 2px rgba(245,158,11,0.3); }
        }
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(-50%) translateY(20px) scale(0.95); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
        @keyframes cardPulse {
          0%, 100% { box-shadow: 0 0 48px rgba(245,158,11,0.15), 0 4px 24px rgba(0,0,0,0.2); }
          50%       { box-shadow: 0 0 72px rgba(245,158,11,0.32), 0 4px 24px rgba(0,0,0,0.2); }
        }
        @keyframes buttonGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0); border-color: rgba(245,158,11,0.5); }
          50%       { box-shadow: 0 0 0 5px rgba(245,158,11,0.15); border-color: rgba(245,158,11,0.85); }
        }
        * { box-sizing: border-box; }
        ::placeholder { color: #64748b; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
      `}</style>

      {/* ── Navbar ── */}
      <nav style={{
        height: 60, borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', padding: '0 32px', gap: 16,
        background: 'rgba(0,0,0,0.28)', backdropFilter: 'blur(18px)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <button
          onClick={() => router.push('/dashboard/i140')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 9,
            background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
            color: C.textSecondary, fontFamily: F, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLButtonElement).style.color = C.textPrimary
            ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.16)'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLButtonElement).style.color = C.textSecondary
            ;(e.currentTarget as HTMLButtonElement).style.borderColor = C.border
          }}
        >
          ← Dashboard
        </button>

        <span style={{ width: 1, height: 20, background: C.border, display: 'block' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>📋</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary, letterSpacing: -0.2 }}>
            Nova Petição I-140
          </span>
          <span style={{
            fontSize: 11, padding: '2px 9px', borderRadius: 20,
            background: reading
              ? 'rgba(245,158,11,0.15)' : 'rgba(167,139,250,0.12)',
            border: `1px solid ${reading ? 'rgba(245,158,11,0.35)' : 'rgba(167,139,250,0.25)'}`,
            color: reading ? C.gold : C.accent, fontWeight: 700, letterSpacing: 0.3,
            transition: 'all 0.3s',
          }}>
            {reading ? '🤖 IA lendo…' : STEP_TITLES[step - 1]}
          </span>
        </div>
      </nav>

      {/* ── Main ── */}
      <main style={{ maxWidth: 820, margin: '0 auto', padding: '48px 32px 80px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 style={{
            fontSize: 30, fontWeight: 900, margin: '0 0 8px', letterSpacing: -0.8,
            backgroundImage: `linear-gradient(135deg, ${C.textPrimary} 0%, ${C.accent} 100%)`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            Nova Petição I-140
          </h1>
          <p style={{ color: C.textSecondary, fontSize: 15, margin: 0 }}>
            Preencha as informações da petição em {STEPS.length} passos simples.
          </p>
        </div>

        <Stepper current={step} />

        <div style={{
          background: C.bgCard, border: `1px solid ${C.border}`,
          borderRadius: 22, padding: '32px 36px',
          boxShadow: '0 12px 48px rgba(0,0,0,0.3)',
        }}>
          {/* Step header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            marginBottom: 28, paddingBottom: 20, borderBottom: `1px solid ${C.border}`,
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: `linear-gradient(135deg, ${C.accent}22, ${C.accentDark}22)`,
              border: `1.5px solid ${C.borderAccent}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
            }}>
              {STEPS[step - 1].icon}
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: C.textPrimary, letterSpacing: -0.3 }}>
                {STEP_TITLES[step - 1]}
              </div>
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 1 }}>
                {step === 1 && 'Selecione a categoria e configure os detalhes da petição.'}
                {step === 2 && 'Informe os dados pessoais do beneficiário (imigrante).'}
                {step === 3 && 'Revise tudo antes de salvar. Você pode editar depois.'}
              </div>
            </div>
          </div>

          {/* Step content */}
          {step === 1 && (
            <Step1
              form={form}
              onChange={updateForm}
              onAutofill={updateForm}
              onToast={showToast}
              onReadingChange={setReading}
              reading={reading}
            />
          )}
          {step === 2 && <Step2 form={form} onChange={updateForm} />}
          {step === 3 && (
            <Step3
              form={form}
              onGoToStep={s => { setStep(s); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
            />
          )}

          <WizardFooter
            step={step}
            canAdvance={canAdvance}
            creating={creating}
            reading={reading}
            onBack={handleBack}
            onNext={handleNext}
            onCreate={handleCreate}
          />
        </div>
      </main>

      <Toast toast={toast} onClose={closeToast} />
    </div>
  )
}

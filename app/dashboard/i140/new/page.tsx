'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createI140Petition, type I140PetitionPayload } from '@/app/actions/i140Actions'

// ============================================================
// DESIGN TOKENS
// ============================================================
const C = {
  bgPage: '#f8fafc',
  bgCard: '#ffffff',
  border: '#e2e8f0',
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  accent: '#22c55e',
  accentDark: '#16a34a',
  error: '#ef4444',
}

// ============================================================
// STATIC DATA
// ============================================================
const VISA_CATEGORIES: { id: string; label: string; subtitle: string; icon: string }[] = [
  { id: 'EB-1A',      label: 'EB-1A',      subtitle: 'Extraordinary Ability',     icon: '🚀' },
  { id: 'EB-1B',      label: 'EB-1B',      subtitle: 'Outstanding Researcher',    icon: '🔬' },
  { id: 'EB-2 NIW',   label: 'EB-2 NIW',   subtitle: 'National Interest Waiver',  icon: '🌍' },
  { id: 'EB-2',       label: 'EB-2',       subtitle: 'Advanced Degree',           icon: '🎓' },
  { id: 'EB-3',       label: 'EB-3',       subtitle: 'Skilled Workers',           icon: '⚙️' },
  { id: 'EB-3 Other', label: 'EB-3 Other', subtitle: 'Other Workers',             icon: '🛠️' },
]

const COUNTRIES = ['Brasil', 'Estados Unidos', 'Portugal', 'Canadá', 'Outros']

const INITIAL_FORM: I140PetitionPayload = {
  category: '', priorityDate: '', notes: '',
  fullName: '', email: '', phone: '', birthCountry: '', birthDate: '',
}

// ============================================================
// HELPER — input style
// ============================================================
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 16px',
  background: '#f8fafc', border: `1px solid ${C.border}`,
  borderRadius: 12, fontSize: 14, color: C.textPrimary,
  outline: 'none', transition: 'border-color 0.2s',
}

// ============================================================
// PAGE
// ============================================================
export default function NewI140Page() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [form, setForm] = useState<I140PetitionPayload>(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const update = (partial: Partial<I140PetitionPayload>) =>
    setForm(prev => ({ ...prev, ...partial }))

  const handleNext = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!form.category) { setError('Selecione a categoria do visto.'); return }
    setError(null)
    setStep(2)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const result = await createI140Petition(form)

    if (result.success) {
      router.push(`/dashboard/i140/${result.petitionId}`)
    } else {
      setError(result.error)
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bgPage, fontFamily: 'Inter, sans-serif' }}>
      <main style={{ maxWidth: 680, margin: '0 auto', padding: '120px 20px 60px' }}>

        {/* ── PROGRESS BAR ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 40 }}>
          {['Categoria', 'Beneficiário'].map((label, i) => {
            const idx = i + 1
            const done = step > idx
            const active = step === idx
            return (
              <React.Fragment key={label}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
                    background: done || active ? C.accent : C.border,
                    color: done || active ? '#fff' : C.textMuted,
                    transition: 'all 0.3s',
                  }}>
                    {done ? '✓' : idx}
                  </div>
                  <span style={{
                    fontSize: 13, fontWeight: 600,
                    color: active ? C.textPrimary : C.textMuted,
                  }}>
                    {label}
                  </span>
                </div>
                {i < 1 && (
                  <div style={{
                    flex: 1, height: 2, borderRadius: 2,
                    background: step > 1 ? C.accent : C.border,
                    transition: 'background 0.3s',
                  }} />
                )}
              </React.Fragment>
            )
          })}
        </div>

        {/* ── STEP 1: CATEGORIA ── */}
        {step === 1 && (
          <form onSubmit={handleNext}>
            <div style={{ background: C.bgCard, borderRadius: 24, padding: 36, border: `1px solid ${C.border}` }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px', color: C.textPrimary }}>
                Categoria do Visto
              </h1>
              <p style={{ fontSize: 14, color: C.textSecondary, margin: '0 0 28px' }}>
                Selecione a categoria Employment-Based que se aplica ao caso.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                {VISA_CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => update({ category: cat.id })}
                    style={{
                      padding: '16px', borderRadius: 14, textAlign: 'left', cursor: 'pointer',
                      border: `2px solid ${form.category === cat.id ? C.accent : C.border}`,
                      background: form.category === cat.id ? `${C.accent}08` : C.bgCard,
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ fontSize: 22, marginBottom: 6 }}>{cat.icon}</div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.textPrimary }}>{cat.label}</div>
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{cat.subtitle}</div>
                  </button>
                ))}
              </div>

              {/* Priority date + notes */}
              <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                    Data de Prioridade
                  </label>
                  <input
                    type="date"
                    value={form.priorityDate}
                    onChange={e => update({ priorityDate: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                    Observações
                  </label>
                  <input
                    type="text"
                    value={form.notes}
                    onChange={e => update({ notes: e.target.value })}
                    placeholder="Opcional"
                    style={inputStyle}
                  />
                </div>
              </div>

              {error && (
                <div style={{ marginTop: 16, padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, fontSize: 13, color: C.error }}>
                  {error}
                </div>
              )}

              <div style={{ marginTop: 28, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  style={{
                    padding: '13px 28px', background: C.accent, color: '#fff',
                    fontWeight: 700, fontSize: 14, borderRadius: 12, border: 'none', cursor: 'pointer',
                    boxShadow: `0 4px 14px ${C.accent}40`,
                  }}
                >
                  Próximo: Beneficiário →
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ── STEP 2: BENEFICIÁRIO ── */}
        {step === 2 && (
          <form onSubmit={handleSubmit}>
            <div style={{ background: C.bgCard, borderRadius: 24, padding: 36, border: `1px solid ${C.border}` }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px', color: C.textPrimary }}>
                Dados do Beneficiário
              </h1>
              <p style={{ fontSize: 14, color: C.textSecondary, margin: '0 0 28px' }}>
                Preencha as informações do requerente principal.
              </p>

              <div style={{ display: 'grid', gap: 20 }}>

                {/* Full name */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.fullName}
                    onChange={e => update({ fullName: e.target.value })}
                    placeholder="Como consta no passaporte"
                    style={inputStyle}
                  />
                </div>

                {/* Email + Phone */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                      E-mail *
                    </label>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={e => update({ email: e.target.value })}
                      placeholder="beneficiario@email.com"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                      Telefone
                    </label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={e => update({ phone: e.target.value })}
                      placeholder="+55 11 9 0000-0000"
                      style={inputStyle}
                    />
                  </div>
                </div>

                {/* Country + Birth date */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                      País de Nascimento *
                    </label>
                    <select
                      required
                      value={form.birthCountry}
                      onChange={e => update({ birthCountry: e.target.value })}
                      style={{ ...inputStyle, appearance: 'none' as const }}
                    >
                      <option value="">Selecionar...</option>
                      {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                      Data de Nascimento
                    </label>
                    <input
                      type="date"
                      value={form.birthDate}
                      onChange={e => update({ birthDate: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div style={{ marginTop: 20, padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, fontSize: 13, color: C.error }}>
                  {error}
                </div>
              )}

              <div style={{ marginTop: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => { setStep(1); setError(null) }}
                  style={{
                    padding: '13px 20px', background: 'transparent', color: C.textSecondary,
                    fontWeight: 600, fontSize: 14, borderRadius: 12, border: `1px solid ${C.border}`, cursor: 'pointer',
                  }}
                >
                  ← Voltar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '13px 28px',
                    background: submitting ? C.textMuted : C.accent,
                    color: '#fff', fontWeight: 700, fontSize: 14,
                    borderRadius: 12, border: 'none',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    boxShadow: submitting ? 'none' : `0 4px 14px ${C.accent}40`,
                    transition: 'all 0.2s',
                  }}
                >
                  {submitting ? 'Criando petição...' : 'Criar Petição I-140'}
                </button>
              </div>
            </div>
          </form>
        )}

      </main>
    </div>
  )
}

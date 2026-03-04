'use client'

import { useState } from 'react'
import { X, Loader2, Copy, Check, Send } from 'lucide-react'

interface CreateCaseModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

type CaseType = 'I-485' | 'I-140'
type Language = 'pt' | 'en'

interface FormData {
  client_name: string
  client_email: string
  client_phone: string
  case_type: CaseType
  preferred_language: Language
}

const caseTypeInfo: Record<CaseType, { label: string; desc: string; docs: number }> = {
  'I-485': { label: 'I-485', desc: 'Adjustment of Status', docs: 8 },
  'I-140': { label: 'I-140', desc: 'Immigrant Petition', docs: 6 },
}

export default function CreateCaseModal({ open, onClose, onSuccess }: CreateCaseModalProps) {
  const [form, setForm] = useState<FormData>({
    client_name: '',
    client_email: '',
    client_phone: '',
    case_type: 'I-485',
    preferred_language: 'pt',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ magicLink: string | null; docsCount: number; emailSent: boolean } | null>(null)
  const [copied, setCopied] = useState(false)

  if (!open) return null

  const handleSubmit = async () => {
    if (!form.client_name.trim() || !form.client_email.trim()) {
      setError('Nome e email são obrigatórios')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/cases/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erro ao criar caso')
        setLoading(false)
        return
      }

      setResult({
        magicLink: data.magicLink,
        docsCount: data.documentsCreated,
        emailSent: data.emailSent || false,
      })
    } catch (err: any) {
      setError(err.message || 'Erro de conexão')
    }

    setLoading(false)
  }

  const handleCopy = async () => {
    if (result?.magicLink) {
      await navigator.clipboard.writeText(result.magicLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleClose = () => {
    if (result) onSuccess()
    setForm({ client_name: '', client_email: '', client_phone: '', case_type: 'I-485', preferred_language: 'pt' })
    setResult(null)
    setError('')
    setCopied(false)
    onClose()
  }

  const phoneFormat = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 10)
    if (digits.length >= 7) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
    if (digits.length >= 4) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    if (digits.length > 0) return `(${digits}`
    return ''
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[9998]" onClick={handleClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
        <div className="w-full sm:max-w-lg bg-bomjur-card border border-bomjur-border rounded-t-3xl sm:rounded-3xl max-h-[95vh] overflow-y-auto animate-slide-up pointer-events-auto shadow-2xl shadow-black/50">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-bomjur-border sticky top-0 bg-bomjur-card rounded-t-3xl z-10">
            <h2 className="text-xl font-black text-white">
              {result ? '✅ Caso Criado!' : '➕ Novo Caso'}
            </h2>
            <button
              onClick={handleClose}
              className="p-2.5 rounded-xl hover:bg-white/5 transition-all text-white/50 hover:text-white"
            >
              <X size={22} />
            </button>
          </div>

          <div className="px-6 py-6 pb-8">
            {!result ? (
              /* ── Form ── */
              <div className="space-y-6">
                {/* Client Name */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-dim uppercase tracking-[0.2em]">
                    Nome completo do cliente *
                  </label>
                  <input
                    type="text"
                    value={form.client_name}
                    onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
                    placeholder="Maria da Silva"
                    className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500/20 transition-all font-bold"
                  />
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-dim uppercase tracking-[0.2em]">
                    Email do cliente *
                  </label>
                  <input
                    type="email"
                    value={form.client_email}
                    onChange={e => setForm(f => ({ ...f, client_email: e.target.value }))}
                    placeholder="maria@email.com"
                    className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500/20 transition-all font-bold"
                  />
                </div>

                {/* Phone */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-dim uppercase tracking-[0.2em]">
                    Telefone <span className="text-white/20 font-medium">(opcional)</span>
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={form.client_phone}
                    onChange={e => setForm(f => ({ ...f, client_phone: phoneFormat(e.target.value) }))}
                    placeholder="(321) 555-0123"
                    className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500/20 transition-all font-bold"
                  />
                </div>

                {/* Case Type */}
                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-dim uppercase tracking-[0.2em]">
                    Tipo de caso *
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    {(['I-485', 'I-140'] as CaseType[]).map(type => {
                      const info = caseTypeInfo[type]
                      const selected = form.case_type === type
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, case_type: type }))}
                          className={`p-4 rounded-2xl border text-left transition-all ${selected
                            ? 'border-lime-500 bg-lime-500/10'
                            : 'border-white/10 bg-white/5 hover:border-white/20'
                            }`}
                        >
                          <div className={`text-lg font-black ${selected ? 'text-lime-500' : 'text-white'}`}>
                            {info.label}
                          </div>
                          <div className={`text-[10px] font-bold mt-0.5 ${selected ? 'text-lime-500/60' : 'text-dim'}`}>{info.desc}</div>
                          <div className={`text-[8px] font-black uppercase tracking-widest mt-2 px-1.5 py-0.5 rounded-md w-fit ${selected ? 'bg-lime-500/20 text-lime-500' : 'bg-white/5 text-dim'}`}>
                            {info.docs} Docs
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Language */}
                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-dim uppercase tracking-[0.2em]">
                    Idioma preferido
                  </label>
                  <div className="flex gap-4">
                    {([
                      { value: 'pt' as Language, label: '🇧🇷 Português' },
                      { value: 'en' as Language, label: '🇺🇸 English' },
                    ]).map(opt => {
                      const selected = form.preferred_language === opt.value
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, preferred_language: opt.value }))}
                          className={`flex-1 py-3.5 rounded-2xl border text-xs font-black tracking-widest uppercase transition-all ${selected
                            ? 'border-lime-500 bg-lime-500/10 text-lime-500'
                            : 'border-white/10 text-dim hover:text-white hover:border-white/20'
                            }`}
                        >
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Preview */}
                <div className="bg-white/5 rounded-2xl p-5 border border-white/10 space-y-3">
                  <p className="text-[9px] font-black text-dim uppercase tracking-[0.2em]">Fluxo Automatizado:</p>
                  <div className="space-y-2 text-[11px] font-bold text-white/60">
                    <div className="flex gap-3 items-center"><div className="w-1.5 h-1.5 rounded-full bg-lime-500" /> Criar o caso {form.case_type}</div>
                    <div className="flex gap-3 items-center"><div className="w-1.5 h-1.5 rounded-full bg-lime-500" /> Registrar {caseTypeInfo[form.case_type].docs} documentos vinculados</div>
                    <div className="flex gap-3 items-center"><div className="w-1.5 h-1.5 rounded-full bg-lime-500" /> Ativar Gamificação e XP do Cliente</div>
                    <div className="flex gap-3 items-center"><div className="w-1.5 h-1.5 rounded-full bg-lime-500" /> Blindar acesso via Magic Link</div>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-2xl px-5 py-4 text-red-400 text-xs font-bold flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                    {error}
                  </div>
                )}

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={loading || !form.client_name.trim() || !form.client_email.trim()}
                  className="w-full py-4 bg-lime-500 text-black font-black uppercase tracking-[0.2em] text-xs rounded-2xl hover:bg-lime-400 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-xl shadow-lime-500/20"
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Criando caso...
                    </>
                  ) : (
                    <>
                      <Send size={18} />
                      Ativar e Gerar Convite
                    </>
                  )}
                </button>
              </div>
            ) : (
              /* ── Success ── */
              <div className="space-y-6 animate-fade-in text-center py-4">
                <div className="relative inline-block">
                  <div className="text-6xl mb-4">✨</div>
                  <div className="absolute inset-0 bg-lime-500/20 blur-3xl rounded-full" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-black text-white">Missão Inicial Concluída!</h3>
                  <p className="text-dim text-sm font-medium">
                    {result.docsCount} requisitos de inteligência inicializados.
                  </p>
                </div>

                {result.emailSent ? (
                  <div className="py-3 px-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-[10px] font-black uppercase tracking-widest mx-auto w-fit">
                    ✅ Convite enviado com sucesso
                  </div>
                ) : (
                  <div className="py-3 px-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-[10px] font-black uppercase tracking-widest mx-auto w-fit">
                    ⚠️ Link gerado (enviar manual)
                  </div>
                )}

                {result.magicLink && (
                  <div className="space-y-3 pt-4">
                    <label className="block text-[8px] font-black text-dim uppercase tracking-[0.3em]">
                      Link Blindado de Acesso
                    </label>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={result.magicLink}
                        className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white/40 text-[10px] font-mono truncate"
                      />
                      <button
                        onClick={handleCopy}
                        className={`px-4 py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${copied
                          ? 'border-green-500/20 bg-green-500/10 text-green-400'
                          : 'border-white/10 bg-white/5 text-dim hover:text-white hover:border-white/20'
                          }`}
                      >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                        {copied ? 'Pronto!' : 'Copiar'}
                      </button>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleClose}
                  className="w-full py-4 mt-6 bg-white/5 border border-white/10 text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-white/10 transition-all shadow-xl"
                >
                  Finalizar e Sair
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

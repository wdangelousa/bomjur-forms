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
  const [result, setResult] = useState<{ magicLink: string | null; docsCount: number } | null>(null)
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
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={handleClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="w-full sm:max-w-lg bg-bomjur-card border border-bomjur-border rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto animate-slide-up">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-bomjur-border sticky top-0 bg-bomjur-card rounded-t-2xl z-10">
            <h2 className="text-lg font-bold text-bomjur-text">
              {result ? '✅ Caso Criado!' : '➕ Novo Caso'}
            </h2>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg hover:bg-bomjur-bg transition-colors text-bomjur-dim"
            >
              <X size={20} />
            </button>
          </div>

          <div className="px-5 py-5">
            {!result ? (
              /* ── Form ── */
              <div className="space-y-4">
                {/* Client Name */}
                <div>
                  <label className="block text-sm font-semibold text-bomjur-text mb-1.5">
                    Nome completo do cliente *
                  </label>
                  <input
                    type="text"
                    value={form.client_name}
                    onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
                    placeholder="Maria da Silva"
                    className="w-full px-4 py-3 bg-bomjur-bg border border-bomjur-border rounded-xl text-bomjur-text placeholder:text-bomjur-dim text-sm focus:outline-none focus:border-bomjur-lime focus:ring-1 focus:ring-bomjur-lime"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-semibold text-bomjur-text mb-1.5">
                    Email do cliente *
                  </label>
                  <input
                    type="email"
                    value={form.client_email}
                    onChange={e => setForm(f => ({ ...f, client_email: e.target.value }))}
                    placeholder="maria@email.com"
                    className="w-full px-4 py-3 bg-bomjur-bg border border-bomjur-border rounded-xl text-bomjur-text placeholder:text-bomjur-dim text-sm focus:outline-none focus:border-bomjur-lime focus:ring-1 focus:ring-bomjur-lime"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-semibold text-bomjur-text mb-1.5">
                    Telefone <span className="text-bomjur-dim font-normal">(opcional)</span>
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={form.client_phone}
                    onChange={e => setForm(f => ({ ...f, client_phone: phoneFormat(e.target.value) }))}
                    placeholder="(321) 555-0123"
                    className="w-full px-4 py-3 bg-bomjur-bg border border-bomjur-border rounded-xl text-bomjur-text placeholder:text-bomjur-dim text-sm focus:outline-none focus:border-bomjur-lime focus:ring-1 focus:ring-bomjur-lime"
                  />
                </div>

                {/* Case Type */}
                <div>
                  <label className="block text-sm font-semibold text-bomjur-text mb-2">
                    Tipo de caso *
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {(['I-485', 'I-140'] as CaseType[]).map(type => {
                      const info = caseTypeInfo[type]
                      const selected = form.case_type === type
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, case_type: type }))}
                          className={`p-3.5 rounded-xl border text-left transition-all ${selected
                              ? 'border-bomjur-lime bg-bomjur-lime/10'
                              : 'border-bomjur-border bg-bomjur-bg hover:border-bomjur-dim'
                            }`}
                        >
                          <div className={`text-base font-bold ${selected ? 'text-bomjur-lime' : 'text-bomjur-text'}`}>
                            {info.label}
                          </div>
                          <div className="text-xs text-bomjur-muted mt-0.5">{info.desc}</div>
                          <div className="text-[10px] text-bomjur-dim mt-1">{info.docs} documentos</div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Language */}
                <div>
                  <label className="block text-sm font-semibold text-bomjur-text mb-2">
                    Idioma preferido
                  </label>
                  <div className="flex gap-3">
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
                          className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${selected
                              ? 'border-bomjur-lime bg-bomjur-lime/10 text-bomjur-lime'
                              : 'border-bomjur-border text-bomjur-muted hover:border-bomjur-dim'
                            }`}
                        >
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Preview */}
                <div className="bg-bomjur-bg rounded-xl p-4 border border-bomjur-border">
                  <p className="text-xs font-semibold text-bomjur-dim mb-2">AO CRIAR, O SISTEMA VAI:</p>
                  <div className="space-y-1.5 text-xs text-bomjur-muted">
                    <div className="flex gap-2"><span className="text-bomjur-lime">✓</span> Criar o caso {form.case_type}</div>
                    <div className="flex gap-2"><span className="text-bomjur-lime">✓</span> Registrar {caseTypeInfo[form.case_type].docs} documentos necessários</div>
                    <div className="flex gap-2"><span className="text-bomjur-lime">✓</span> Inicializar gamificação (XP e badges)</div>
                    <div className="flex gap-2"><span className="text-bomjur-lime">✓</span> Gerar link de acesso para o cliente</div>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3 text-red-400 text-xs">
                    {error}
                  </div>
                )}

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={loading || !form.client_name.trim() || !form.client_email.trim()}
                  className="w-full py-3.5 bg-bomjur-lime text-bomjur-bg font-bold rounded-xl text-sm hover:bg-bomjur-lime-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Criando caso...
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      Criar Caso e Gerar Convite
                    </>
                  )}
                </button>
              </div>
            ) : (
              /* ── Success ── */
              <div className="space-y-4 animate-fade-in">
                <div className="text-center py-2">
                  <div className="text-4xl mb-3">🎉</div>
                  <p className="text-bomjur-text font-semibold">Caso criado com sucesso!</p>
                  <p className="text-bomjur-muted text-sm mt-1">
                    {result.docsCount} documentos inicializados
                  </p>
                </div>

                {result.magicLink && (
                  <div>
                    <label className="block text-xs font-semibold text-bomjur-dim mb-2">
                      LINK DE ACESSO DO CLIENTE
                    </label>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={result.magicLink}
                        className="flex-1 px-3 py-2.5 bg-bomjur-bg border border-bomjur-border rounded-lg text-bomjur-muted text-xs font-mono truncate"
                      />
                      <button
                        onClick={handleCopy}
                        className={`px-3 py-2.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all ${copied
                            ? 'border-green-400/20 bg-green-400/10 text-green-400'
                            : 'border-bomjur-border bg-bomjur-bg text-bomjur-muted hover:text-bomjur-text'
                          }`}
                      >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                        {copied ? 'Copiado!' : 'Copiar'}
                      </button>
                    </div>
                    <p className="text-[10px] text-bomjur-dim mt-2">
                      Este link será enviado por email no próximo passo. Você também pode copiar e enviar manualmente.
                    </p>
                  </div>
                )}

                <button
                  onClick={handleClose}
                  className="w-full py-3 bg-bomjur-lime text-bomjur-bg font-bold rounded-xl text-sm hover:bg-bomjur-lime-dark transition-colors"
                >
                  Fechar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

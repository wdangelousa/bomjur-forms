'use client'

import { useState, useRef } from 'react'
import { X, Loader2, Copy, Check, Send, Upload, FileText, Sparkles } from 'lucide-react'

interface CreateCaseModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

type CaseType = 'I-485' | 'I-140'
type Language = 'pt' | 'en'

interface FormState {
  client_name: string
  client_email: string
  client_phone: string
  case_type: CaseType
  preferred_language: Language
  import_i140: boolean
  i140_file: File | null
}

const caseTypeInfo: Record<CaseType, { label: string; desc: string; docs: number }> = {
  'I-485': { label: 'I-485', desc: 'Adjustment of Status', docs: 8 },
  'I-140': { label: 'I-140', desc: 'Immigrant Petition', docs: 6 },
}

export default function CreateCaseModal({ open, onClose, onSuccess }: CreateCaseModalProps) {
  const [form, setForm] = useState<FormState>({
    client_name: '',
    client_email: '',
    client_phone: '',
    case_type: 'I-485',
    preferred_language: 'pt',
    import_i140: false,
    i140_file: null,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{
    tempPassword?: string;
    loginLink?: string;
    docsCount: number;
    emailSent: boolean;
  } | null>(null)
  const [copied, setCopied] = useState<'link' | 'pass' | 'wa' | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  const handleSubmit = async () => {
    if (!form.client_name.trim() || !form.client_email.trim()) {
      setError('Nome e email são obrigatórios')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Build FormData for multipart/form-data (supports file upload)
      const formData = new FormData()
      formData.append('client_name', form.client_name.trim())
      formData.append('client_email', form.client_email.trim())
      formData.append('client_phone', form.client_phone.trim())
      formData.append('case_type', form.case_type)
      formData.append('preferred_language', form.preferred_language)

      if (form.import_i140 && form.i140_file) {
        formData.append('i140_file', form.i140_file)
      }

      const res = await fetch('/api/cases/create', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erro ao criar caso')
        setLoading(false)
        return
      }

      setResult({
        tempPassword: data.tempPassword,
        loginLink: data.loginLink,
        docsCount: data.documentsCreated,
        emailSent: data.emailSent || false,
      })
    } catch (err: any) {
      setError(err.message || 'Erro de conexão')
    }

    setLoading(false)
  }

  const copyToClipboard = async (text: string, type: 'link' | 'pass' | 'wa') => {
    await navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  const getAbsoluteLoginUrl = () => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://app.bomjur.com'
    return new URL('/login', baseUrl).toString()
  }

  const handleCopyWAMessage = () => {
    if (!result) return
    const loginUrl = getAbsoluteLoginUrl()
    const msg = `Olá! O seu processo com a equipe Proexpand foi iniciado.\nPara acessar o seu painel seguro e dar continuidade aos seus formulários, clique no link abaixo:\n\n🔗 ${loginUrl}\n\n🔑 *Seus dados de acesso:*\n*Login:* ${form.client_email}\n*Senha:* ${result.tempPassword}`
    copyToClipboard(msg, 'wa')
  }

  const handleClose = () => {
    if (result) onSuccess()
    setForm({ client_name: '', client_email: '', client_phone: '', case_type: 'I-485', preferred_language: 'pt', import_i140: false, i140_file: null })
    setResult(null)
    setError('')
    setCopied(null)
    onClose()
  }

  const phoneFormat = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 10)
    if (digits.length >= 7) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
    if (digits.length >= 4) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    if (digits.length > 0) return `(${digits}`
    return ''
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.type !== 'application/pdf') {
        setError('Apenas arquivos PDF são aceitos')
        return
      }
      if (file.size > 20 * 1024 * 1024) {
        setError('Arquivo deve ter no máximo 20MB')
        return
      }
      setForm(f => ({ ...f, i140_file: file }))
      setError('')
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[9998]" onClick={handleClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
        <div className="w-full sm:max-w-lg bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl max-h-[95vh] overflow-y-auto animate-slide-up pointer-events-auto shadow-2xl shadow-slate-900/10">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 sticky top-0 bg-white rounded-t-3xl z-10">
            <h2 className="text-xl font-black text-slate-900">
              {result ? '✅ Caso Criado!' : '➕ Novo Caso'}
            </h2>
            <button
              onClick={handleClose}
              className="p-2.5 rounded-xl hover:bg-slate-100 transition-all text-slate-400 hover:text-slate-900"
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
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-300 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 transition-all font-bold"
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
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-300 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 transition-all font-bold"
                  />
                </div>

                {/* Phone */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                    Telefone <span className="text-slate-300 font-medium">(opcional)</span>
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={form.client_phone}
                    onChange={e => setForm(f => ({ ...f, client_phone: phoneFormat(e.target.value) }))}
                    placeholder="(321) 555-0123"
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-300 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 transition-all font-bold"
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
                          onClick={() => setForm(f => ({ ...f, case_type: type, import_i140: false, i140_file: null }))}
                          className={`p-4 rounded-2xl border text-left transition-all ${selected
                            ? 'border-sky-500 bg-sky-50'
                            : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                            }`}
                        >
                          <div className={`text-lg font-black ${selected ? 'text-sky-600' : 'text-slate-900'}`}>
                            {info.label}
                          </div>
                          <div className={`text-[10px] font-bold mt-0.5 ${selected ? 'text-sky-500/70' : 'text-dim'}`}>{info.desc}</div>
                          <div className={`text-[8px] font-black uppercase tracking-widest mt-2 px-1.5 py-0.5 rounded-md w-fit ${selected ? 'bg-sky-100 text-sky-600' : 'bg-slate-100 text-dim'}`}>
                            {info.docs} Docs
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* I-140 Import Toggle — only visible for I-485 cases */}
                {form.case_type === 'I-485' && (
                  <div className="space-y-3">
                    <div
                      className={`flex items-center gap-4 p-4 rounded-2xl border cursor-pointer transition-all ${form.import_i140
                        ? 'border-sky-400/50 bg-sky-50'
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                        }`}
                      onClick={() => setForm(f => ({ ...f, import_i140: !f.import_i140, i140_file: f.import_i140 ? null : f.i140_file }))}
                    >
                      <div className={`w-10 h-6 rounded-full relative transition-all ${form.import_i140 ? 'bg-sky-500' : 'bg-slate-200'}`}>
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${form.import_i140 ? 'left-5' : 'left-1'}`} />
                      </div>
                      <div className="flex-1">
                        <div className={`text-xs font-black ${form.import_i140 ? 'text-sky-600' : 'text-slate-900'}`}>
                          <Sparkles size={12} className="inline mr-1.5 -mt-0.5" />
                          Importar dados de um I-140 anterior?
                        </div>
                        <div className="text-[10px] text-dim mt-0.5">
                          Envie o PDF para pré-preencher dados via IA
                        </div>
                      </div>
                    </div>

                    {/* File Upload Area */}
                    {form.import_i140 && (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className={`relative p-6 rounded-2xl border-2 border-dashed cursor-pointer text-center transition-all ${form.i140_file
                          ? 'border-sky-400/40 bg-sky-50'
                          : 'border-slate-200 bg-slate-50 hover:border-sky-300'
                          }`}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".pdf"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        {form.i140_file ? (
                          <div className="flex items-center justify-center gap-3">
                            <FileText size={20} className="text-sky-500" />
                            <div>
                              <p className="text-sm font-bold text-sky-600">{form.i140_file.name}</p>
                              <p className="text-[10px] text-dim mt-0.5">
                                {(form.i140_file.size / 1024 / 1024).toFixed(1)}MB • Clique para trocar
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <Upload size={24} className="mx-auto text-dim mb-2" />
                            <p className="text-xs font-bold text-slate-500">Clique ou arraste o PDF do I-140</p>
                            <p className="text-[10px] text-dim mt-1">PDF • máx 20MB</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

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
                            ? 'border-sky-500 bg-sky-50 text-sky-600'
                            : 'border-slate-200 text-dim hover:text-slate-900 hover:border-slate-300'
                            }`}
                        >
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Preview */}
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-3">
                  <p className="text-[9px] font-black text-dim uppercase tracking-[0.2em]">Fluxo Automatizado:</p>
                  <div className="space-y-2 text-[11px] font-bold text-slate-500">
                    <div className="flex gap-3 items-center"><div className="w-1.5 h-1.5 rounded-full bg-sky-500" /> Criar o caso {form.case_type}</div>
                    <div className="flex gap-3 items-center"><div className="w-1.5 h-1.5 rounded-full bg-sky-500" /> Registrar {caseTypeInfo[form.case_type].docs} documentos vinculados</div>
                    {form.import_i140 && form.i140_file && (
                      <div className="flex gap-3 items-center"><div className="w-1.5 h-1.5 rounded-full bg-sky-500" /> Extrair dados do I-140 via IA</div>
                    )}
                    <div className="flex gap-3 items-center"><div className="w-1.5 h-1.5 rounded-full bg-sky-500" /> Ativar Gamificação e XP do Cliente</div>
                    <div className="flex gap-3 items-center"><div className="w-1.5 h-1.5 rounded-full bg-sky-500" /> Gerar Senha de Embarque</div>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 text-red-600 text-xs font-bold flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                    {error}
                  </div>
                )}

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={loading || !form.client_name.trim() || !form.client_email.trim()}
                  className="w-full py-4 bg-sky-500 text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl hover:bg-sky-600 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-xl shadow-sky-500/20"
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
              <div className="space-y-6 animate-fade-in py-4">
                <div className="text-center relative">
                  <div className="text-6xl mb-4">✨</div>
                  <div className="absolute inset-0 bg-sky-100 blur-3xl rounded-full -z-10" />
                  <h3 className="text-xl font-black text-slate-900">Missão Inicial Concluída!</h3>
                  <p className="text-dim text-sm font-medium mt-1">
                    {result.docsCount} requisitos de inteligência inicializados.
                  </p>
                </div>

                <div className="space-y-4">
                  {result.emailSent ? (
                    <div className="py-3 px-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-600 text-[10px] font-black uppercase tracking-widest mx-auto w-fit">
                      ✅ Convite enviado por e-mail
                    </div>
                  ) : (
                    <div className="py-3 px-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-600 text-[10px] font-black uppercase tracking-widest mx-auto w-fit">
                      ⚠️ Enviar credenciais manualmente
                    </div>
                  )}

                  {/* WhatsApp Primary Action */}
                  <button
                    onClick={handleCopyWAMessage}
                    className={`w-full py-4 rounded-2xl border-2 font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 transition-all ${copied === 'wa'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-600'
                      : 'border-sky-300 bg-sky-50 text-sky-600 hover:bg-sky-100'
                      }`}
                  >
                    {copied === 'wa' ? <Check size={18} /> : <Send size={18} />}
                    {copied === 'wa' ? 'Copiado para o WhatsApp' : 'Copiar Convite p/ WhatsApp'}
                  </button>

                  <div className="grid grid-cols-1 gap-4 mt-6">
                    {/* Login Link */}
                    <div className="space-y-2">
                      <label className="block text-[8px] font-black text-dim uppercase tracking-[0.3em] ml-1">
                        Link de Acesso
                      </label>
                      <div className="flex gap-2">
                        <input
                          readOnly
                          value={getAbsoluteLoginUrl()}
                          className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-400 text-[10px] font-mono truncate"
                        />
                        <button
                          onClick={() => copyToClipboard(getAbsoluteLoginUrl(), 'link')}
                          className={`px-4 py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${copied === 'link'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                            : 'border-slate-200 bg-slate-50 text-dim hover:text-slate-900 hover:border-slate-300'
                            }`}
                        >
                          {copied === 'link' ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>

                    {/* Password */}
                    <div className="space-y-2">
                      <label className="block text-[8px] font-black text-dim uppercase tracking-[0.3em] ml-1">
                        Senha de Embarque
                      </label>
                      <div className="flex gap-2">
                        <input
                          readOnly
                          value={result.tempPassword}
                          className="flex-1 px-4 py-3 bg-sky-50 border border-sky-200 rounded-xl text-sky-600 text-sm font-mono font-bold tracking-widest"
                        />
                        <button
                          onClick={() => copyToClipboard(result.tempPassword || '', 'pass')}
                          className={`px-4 py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${copied === 'pass'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                            : 'border-slate-200 bg-slate-50 text-dim hover:text-slate-900 hover:border-slate-300'
                            }`}
                        >
                          {copied === 'pass' ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleClose}
                  className="w-full py-4 mt-4 bg-slate-100 border border-slate-200 text-slate-900 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-slate-200 transition-all"
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

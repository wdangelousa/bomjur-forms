'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createI140Petition, type I140PetitionPayload } from '@/app/actions/i140Actions'
import { ChevronLeft, ChevronRight, Rocket, Microscope, Globe, GraduationCap, Settings, Wrench, User, Mail, Phone, Calendar, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react'

// ============================================================
// DESIGN TOKENS
// ============================================================
const C = {
  primary: '#22c55e', // Emerald 500
  primaryDark: '#16a34a',
  blue: '#2563eb',
  gold: '#f59e0b',
}

// ============================================================
// STATIC DATA
// ============================================================
const VISA_CATEGORIES = [
  { id: 'EB-1A', label: 'EB-1A', subtitle: 'Extraordinary Ability', icon: Rocket, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-200' },
  { id: 'EB-1B', label: 'EB-1B', subtitle: 'Outstanding Researcher', icon: Microscope, color: 'text-violet-500', bg: 'bg-violet-50', border: 'border-violet-200' },
  { id: 'EB-2 NIW', label: 'EB-2 NIW', subtitle: 'National Interest Waiver', icon: Globe, color: 'text-sky-500', bg: 'bg-sky-50', border: 'border-sky-200' },
  { id: 'EB-2', label: 'EB-2', subtitle: 'Advanced Degree', icon: GraduationCap, color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  { id: 'EB-3', label: 'EB-3', subtitle: 'Skilled Workers', icon: Settings, color: 'text-pink-500', bg: 'bg-pink-50', border: 'border-pink-200' },
  { id: 'EB-3 Other', label: 'EB-3 Other', subtitle: 'Other Workers', icon: Wrench, color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-200' },
]

const COUNTRIES = [
  'Afeganistão', 'África do Sul', 'Albânia', 'Alemanha', 'Andorra', 'Angola', 'Antígua e Barbuda', 'Arábia Saudita', 'Argélia', 'Argentina', 'Armênia', 'Austrália', 'Áustria', 'Azerbaijão', 'Bahamas', 'Bangladesh', 'Barbados', 'Bahrein', 'Bélgica', 'Belize', 'Benim', 'Bielorrússia', 'Bolívia', 'Bósnia e Herzegovina', 'Botsuana', 'Brasil', 'Brunei', 'Bulgária', 'Burkina Faso', 'Burundi', 'Butão', 'Cabo Verde', 'Camarões', 'Camboja', 'Canadá', 'Catar', 'Cazaquistão', 'Chade', 'Chile', 'China', 'Chipre', 'Colômbia', 'Comores', 'Coreia do Norte', 'Coreia do Sul', 'Costa do Marfim', 'Costa Rica', 'Croácia', 'Cuba', 'Dinamarca', 'Djibouti', 'Dominica', 'Egito', 'El Salvador', 'Emirados Árabes Unidos', 'Equador', 'Eritreia', 'Eslováquia', 'Eslovênia', 'Espanha', 'Estados Unidos', 'Estônia', 'Eswatini', 'Etiópia', 'Fiji', 'Filipinas', 'Finlândia', 'França', 'Gabão', 'Gâmbia', 'Gana', 'Geórgia', 'Granada', 'Grécia', 'Guatemala', 'Guiana', 'Guiné', 'Guiné Equatorial', 'Guiné-Bissau', 'Haiti', 'Honduras', 'Hungria', 'Iêmen', 'Ilhas Marshall', 'Índia', 'Indonésia', 'Irã', 'Iraque', 'Irlanda', 'Islândia', 'Israel', 'Itália', 'Jamaica', 'Japão', 'Jordânia', 'Kiribati', 'Kuwait', 'Laos', 'Lesoto', 'Letônia', 'Líbano', 'Libéria', 'Líbia', 'Liechtenstein', 'Lituânia', 'Luxemburgo', 'Macedônia do Norte', 'Madagascar', 'Malásia', 'Malaui', 'Maldivas', 'Mali', 'Malta', 'Marrocos', 'Maurício', 'Mauritânia', 'México', 'Micronésia', 'Moçambique', 'Moldávia', 'Mônaco', 'Mongólia', 'Montenegro', 'Mianmar', 'Namíbia', 'Nauru', 'Nepal', 'Nicarágua', 'Níger', 'Nigéria', 'Noruega', 'Nova Zelândia', 'Omã', 'Países Baixos', 'Palau', 'Panamá', 'Papua Nova Guiné', 'Paquistão', 'Paraguai', 'Peru', 'Polônia', 'Portugal', 'Quênia', 'Quirguistão', 'Reino Unido', 'República Centro-Africana', 'República Democrática do Congo', 'República do Congo', 'República Dominicana', 'Romênia', 'Ruanda', 'Rússia', 'Samoa', 'San Marino', 'Santa Lúcia', 'São Cristóvão e Neves', 'São Tomé e Príncipe', 'São Vicente e Granadinas', 'Seicheles', 'Senegal', 'Serra Leoa', 'Sérvia', 'Singapura', 'Síria', 'Somália', 'Sri Lanka', 'Sudão', 'Sudão do Sul', 'Suécia', 'Suíça', 'Suriname', 'Tajiquistão', 'Tailândia', 'Tanzânia', 'Tchequia', 'Timor-Leste', 'Togo', 'Tonga', 'Trinidad e Tobago', 'Tunísia', 'Turcomenistão', 'Turquia', 'Tuvalu', 'Ucrânia', 'Uganda', 'Uruguai', 'Uzbequistão', 'Vanuatu', 'Vaticano', 'Venezuela', 'Vietnã', 'Zâmbia', 'Zimbábue'
]

const INITIAL_FORM: I140PetitionPayload = {
  category: '', priorityDate: '', notes: '',
  fullName: '', email: '', phone: '', birthCountry: '', birthDate: '',
}

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
    if (!form.category) {
      setError('Por favor, selecione uma categoria de visto válida para prosseguir.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setError(null)
    setStep(2)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    // Validations
    if (!form.fullName.trim() || !form.email.trim() || !form.birthCountry) {
      setError('Preencha os campos obrigatórios (Nome, E-mail e País de Origem).')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const result = await createI140Petition(form)

      if (result.success) {
        // Optimistic UI navigation, assuming success
        router.push(`/dashboard/i140/${result.petitionId}`)
      } else {
        setError(result.error || 'Erro ao processar a petição.')
        setSubmitting(false)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    } catch (err: any) {
      setError(err.message || 'Erro inesperado de comunicação.')
      setSubmitting(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">

      {/* Navbar Premium */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200 px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard/i140')} className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all">
            <ChevronLeft size={20} />
          </button>
          <div className="h-5 w-[1px] bg-slate-200" />
          <h1 className="font-bold text-sm tracking-tight">Nova Petição I-140</h1>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 mt-12">

        {/* PROGRESS INDICATOR */}
        <div className="flex items-center justify-center mb-12">
          <div className="flex items-center w-full max-w-sm">
            <div className={`flex flex-col flex-1 items-center relative ${step >= 1 ? 'text-emerald-600' : 'text-slate-400'}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-4 border-white shadow-sm transition-all duration-300 z-10 ${step >= 1 ? 'bg-emerald-500 text-white' : 'bg-slate-200'} ${step === 1 ? 'ring-4 ring-emerald-50' : ''}`}>
                {step > 1 ? <CheckCircle2 size={18} /> : '1'}
              </div>
              <span className={`text-xs font-bold mt-2 uppercase tracking-widest ${step >= 1 ? 'text-slate-800' : 'text-slate-400'}`}>Categoria</span>
            </div>

            <div className={`h-1 flex-1 -mx-8 bg-slate-200 rounded-full overflow-hidden`}>
              <div className={`h-full bg-emerald-500 transition-all duration-500 ${step > 1 ? 'w-full' : 'w-0'}`} />
            </div>

            <div className={`flex flex-col flex-1 items-center relative ${step >= 2 ? 'text-blue-600' : 'text-slate-400'}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-4 border-white shadow-sm transition-all duration-300 z-10 ${step >= 2 ? 'bg-emerald-500 text-white' : 'bg-slate-200'} ${step === 2 ? 'ring-4 ring-emerald-50' : ''}`}>
                2
              </div>
              <span className={`text-xs font-bold mt-2 uppercase tracking-widest ${step >= 2 ? 'text-slate-800' : 'text-slate-400'}`}>Beneficiário</span>
            </div>
          </div>
        </div>

        {/* ERROR BOUNDARY ALERT */}
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-2xl flex gap-3 text-red-700 items-start shadow-sm animate-in fade-in slide-in-from-top-4">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-sm font-medium">{error}</div>
          </div>
        )}

        {/* STEP 1: CATEGORY SELECTION */}
        {step === 1 && (
          <form className="animate-in fade-in slide-in-from-bottom-4 duration-500" onSubmit={handleNext}>
            <div className="bg-white rounded-[2rem] p-8 md:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">

              <div className="mb-10 text-center">
                <h2 className="text-2xl font-black text-slate-900 mb-2">Categoria do Visto</h2>
                <p className="text-slate-500 text-sm">Selecione a categoria Employment-Based que se aplica ao perfil do seu cliente.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
                {VISA_CATEGORIES.map(cat => {
                  const isSelected = form.category === cat.id
                  const Icon = cat.icon
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => update({ category: cat.id })}
                      className={`relative flex items-center p-5 rounded-2xl border-2 transition-all duration-200 text-left cursor-pointer group outline-none
                        ${isSelected ? 'border-emerald-500 bg-emerald-50/50 shadow-sm' : 'border-slate-100 bg-white hover:border-emerald-200 hover:bg-slate-50'}`}
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mr-4 shrink-0 transition-colors ${isSelected ? 'bg-emerald-500 text-white' : `${cat.bg} ${cat.color}`}`}>
                        <Icon size={24} strokeWidth={isSelected ? 2.5 : 2} />
                      </div>
                      <div className="flex-1">
                        <div className={`font-bold text-lg leading-tight mb-1 ${isSelected ? 'text-emerald-900' : 'text-slate-800'}`}>{cat.label}</div>
                        <div className={`text-xs font-medium ${isSelected ? 'text-emerald-700' : 'text-slate-500'}`}>{cat.subtitle}</div>
                      </div>

                      {/* Check indicator */}
                      <div className={`absolute top-4 right-4 transition-all duration-200 ${isSelected ? 'opacity-100 scale-100 text-emerald-500' : 'opacity-0 scale-50'}`}>
                        <CheckCircle2 size={20} className="fill-emerald-100" />
                      </div>
                    </button>
                  )
                })}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <div>
                  <label className="flex items-center text-xs font-bold text-slate-500 uppercase tracking-widest mb-2"><Calendar className="w-4 h-4 mr-2" /> Data de Prioridade</label>
                  <input
                    type="date"
                    value={form.priorityDate}
                    onChange={e => update({ priorityDate: e.target.value })}
                    className="w-full bg-white border border-slate-200 text-slate-900 text-sm rounded-xl px-4 py-3 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 transition-all font-medium"
                  />
                  <p className="text-[10px] text-slate-400 mt-1.5 font-medium ml-1">Opcional. Data do LCA ou recebimento.</p>
                </div>
                <div>
                  <label className="flex items-center text-xs font-bold text-slate-500 uppercase tracking-widest mb-2"><Wrench className="w-4 h-4 mr-2" /> Notas Internas</label>
                  <input
                    type="text"
                    value={form.notes}
                    onChange={e => update({ notes: e.target.value })}
                    placeholder="Estratégia, observações..."
                    className="w-full bg-white border border-slate-200 text-slate-900 text-sm rounded-xl px-4 py-3 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 transition-all font-medium placeholder:text-slate-400"
                  />
                  <p className="text-[10px] text-slate-400 mt-1.5 font-medium ml-1">Opcional. Visível apenas para a equipe.</p>
                </div>
              </div>

              <div className="mt-10 flex justify-end">
                <button
                  type="submit"
                  className="flex items-center px-8 py-3.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-bold rounded-xl shadow-[0_4px_14px_rgba(34,197,94,0.3)] transition-all transform hover:-translate-y-0.5"
                >
                  Continuar para Beneficiário <ChevronRight className="ml-2 w-5 h-5 shrink-0" />
                </button>
              </div>
            </div>
          </form>
        )}

        {/* STEP 2: BENEFICIARY DETAILS */}
        {step === 2 && (
          <form className="animate-in fade-in slide-in-from-right-8 duration-500" onSubmit={handleSubmit}>
            <div className="bg-white rounded-[2rem] p-8 md:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">

              <div className="mb-10 text-center">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <User size={32} />
                </div>
                <h2 className="text-2xl font-black text-slate-900 mb-2">Dados do Beneficiário</h2>
                <p className="text-slate-500 text-sm">Preencha as informações do requerente principal. Os dados devem corresponder ao passaporte.</p>
              </div>

              <div className="space-y-6">

                {/* Full name */}
                <div>
                  <label className="flex items-center text-xs font-bold text-slate-500 uppercase tracking-widest mb-2"><User className="w-4 h-4 mr-2" /> Nome Completo <span className="text-red-500 ml-1">*</span></label>
                  <input
                    type="text"
                    required
                    value={form.fullName}
                    onChange={e => update({ fullName: e.target.value })}
                    placeholder="Ex: Carlos Eduardo Silva"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl px-4 py-3 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all font-medium placeholder:text-slate-400"
                  />
                </div>

                {/* Contact grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="flex items-center text-xs font-bold text-slate-500 uppercase tracking-widest mb-2"><Mail className="w-4 h-4 mr-2" /> E-mail Principal <span className="text-red-500 ml-1">*</span></label>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={e => update({ email: e.target.value })}
                      placeholder="carlos@email.com"
                      className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl px-4 py-3 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all font-medium placeholder:text-slate-400"
                    />
                  </div>
                  <div>
                    <label className="flex items-center text-xs font-bold text-slate-500 uppercase tracking-widest mb-2"><Phone className="w-4 h-4 mr-2" /> Telefone <span className="opacity-70 lowercase text-[10px] ml-1">(WhatsApp)</span></label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={e => update({ phone: e.target.value })}
                      placeholder="+55 11 90000-0000"
                      className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl px-4 py-3 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all font-medium placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* Country + Birth */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                  <div>
                    <label className="flex items-center text-xs font-bold text-slate-500 uppercase tracking-widest mb-2"><Globe className="w-4 h-4 mr-2" /> País de Origem <span className="text-red-500 ml-1">*</span></label>
                    <div className="relative">
                      <select
                        required
                        value={form.birthCountry}
                        onChange={e => update({ birthCountry: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl px-4 py-3 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all font-medium appearance-none pr-10"
                      >
                        <option value="" disabled>Selecione um país...</option>
                        {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                        <ChevronLeft className="w-4 h-4 -rotate-90" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="flex items-center text-xs font-bold text-slate-500 uppercase tracking-widest mb-2"><Calendar className="w-4 h-4 mr-2" /> Data de Nascimento</label>
                    <input
                      type="date"
                      value={form.birthDate}
                      onChange={e => update({ birthDate: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl px-4 py-3 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all font-medium"
                    />
                  </div>
                </div>

              </div>

              <div className="mt-12 flex flex-col-reverse sm:flex-row justify-between items-center gap-4">
                <button
                  type="button"
                  onClick={() => { setStep(1); setError(null); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                  className="w-full sm:w-auto px-6 py-3.5 text-slate-500 font-bold hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto flex items-center justify-center px-8 py-3.5 bg-slate-900 hover:bg-black active:scale-[0.98] disabled:bg-slate-300 disabled:scale-100 text-white font-bold rounded-xl shadow-lg shadow-slate-900/10 transition-all"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Processando...
                    </>
                  ) : (
                    <>
                      Registrar Petição <Rocket className="ml-2 w-5 h-5" />
                    </>
                  )}
                </button>
              </div>

            </div>
          </form>
        )}
      </main>
    </div>
  )
}

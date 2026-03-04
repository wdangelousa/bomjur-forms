'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useForm } from 'react-hook-form'
import I485WaiverModal from '@/components/I485WaiverModal'

const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Tipos ────────────────────────────────────────────────────────────────────
type PageState = 'loading' | 'no_session' | 'no_application' | 'waiver_pending' | 'ready'
type I140Scenario = 'loading' | 'has_i140' | 'no_i140'
type UploadStatus = 'idle' | 'uploading' | 'done' | 'error'

interface SessionData {
    applicationId: string
    clientName: string
    userId: string
    waiverAcceptedAt: string | null
    i140PetitionId: string | null
}

interface TriagemState {
    isMarried: boolean
    hasChildren: boolean
    childrenCount: number
    hasPreviousMarriages: boolean
}

interface DocUpload {
    status: UploadStatus
    fileName?: string
}

interface I485Form {
    p1_first_name: string
    p1_middle_name: string
    p1_last_name: string
    p1_date_of_birth: string
    p1_sex: string
    p1_city_of_birth: string
    p1_country_of_birth: string
    p1_country_of_citizenship: string
    p1_alien_number: string
    p1_passport_number: string
    p1_i94_number: string
    p1_current_status: string
    p2_application_type: string
    p2_receipt_number: string
    p2_priority_date: string
    p2_employment_category: string
}

// ─── Funções utilitárias (fora do componente) ─────────────────────────────────
const DOC_LABELS: Record<string, string> = {
    passaporte: '🛂 Passaporte',
    visto_atual: '📋 Visto Atual',
    i94: '🗂️ Formulário I-94',
    certidao_nascimento_titular: '📜 Certidão de Nascimento (Titular)',
    certidao_casamento: '💍 Certidão de Casamento',
    averbacao_divorcio: '📋 Averbação de Divórcio / Certidão de Óbito',
}

function getDocLabel(key: string): string {
    const childMatch = key.match(/^certidao_nascimento_filho_(\d+)$/)
    if (childMatch) return `👶 Certidão de Nascimento — Filho ${childMatch[1]}`
    return DOC_LABELS[key] || key
}

function getChecklistDocs(t: TriagemState): string[] {
    const docs = ['passaporte', 'visto_atual', 'i94', 'certidao_nascimento_titular']
    if (t.isMarried) docs.push('certidao_casamento')
    const n = t.hasChildren ? Math.max(1, t.childrenCount || 1) : 0
    for (let i = 1; i <= n; i++) docs.push(`certidao_nascimento_filho_${i}`)
    if (t.hasPreviousMarriages) docs.push('averbacao_divorcio')
    return docs
}

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function I485StartPage() {
    const [pageState, setPageState] = useState<PageState>('loading')
    const [session, setSession] = useState<SessionData | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [currentStep, setCurrentStep] = useState(1)
    const [toastMsg, setToastMsg] = useState<string | null>(null)

    // ── Estado do Passo 2 — Triagem ──────────────────────────────────────────
    const [i140Scenario, setI140Scenario] = useState<I140Scenario>('loading')
    const [i140UploadState, setI140UploadState] = useState<
        'idle' | 'uploading' | 'extracting' | 'done' | 'error'
    >('idle')
    const [triage, setTriage] = useState<TriagemState>({
        isMarried: false,
        hasChildren: false,
        childrenCount: 1,
        hasPreviousMarriages: false,
    })
    const [docUploads, setDocUploads] = useState<Record<string, DocUpload>>({})

    // ── React Hook Form ──────────────────────────────────────────────────────
    const { register, handleSubmit, watch, reset } = useForm<I485Form>({ mode: 'onChange' })
    const watchAllFields = watch()

    // Gamificação de progresso (Steps 3 e 4)
    const totalFields = 16
    const filledFields = Object.values(watchAllFields).filter(
        v => v && String(v).trim() !== ''
    ).length
    const progressPercent = Math.round((filledFields / totalFields) * 100) || 0
    const progressMessages = [
        { threshold: 0, text: 'Vamos começar! Preencha seus dados.' },
        { threshold: 25, text: 'Belo início! Continue assim.' },
        { threshold: 50, text: 'Excelente progresso! Falta pouco.' },
        { threshold: 75, text: 'Quase lá! Você está um passo mais perto do Green Card.' },
        { threshold: 100, text: 'Incrível! Todos os campos preenchidos impecavelmente ✅' },
    ]
    const currentProgressMsg =
        progressMessages
            .slice()
            .reverse()
            .find(m => progressPercent >= m.threshold)?.text ?? 'Vamos lá!'

    const [isFetchingData, setIsFetchingData] = useState(false)
    const [creationData, setCreationData] = useState<{
        userId: string
        tenantId: string | null
        clientName: string
    } | null>(null)
    const [creating, setCreating] = useState(false)
    const [savingDraft, setSavingDraft] = useState(false)

    // ── Inicialização ────────────────────────────────────────────────────────
    useEffect(() => {
        const init = async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser()
            if (!user) {
                setPageState('no_session')
                return
            }

            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name, tenant_id')
                .eq('id', user.id)
                .single()

            const clientName = profile?.full_name ?? user.email ?? 'Cliente'

            const { data: application, error: appErr } = await supabase
                .from('i485_applications')
                .select('*')
                .eq('client_id', user.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single()

            if (appErr || !application) {
                setCreationData({
                    userId: user.id,
                    tenantId: profile?.tenant_id ?? null,
                    clientName,
                })
                setPageState('no_application')
                return
            }

            setSession({
                applicationId: application.id,
                clientName,
                userId: user.id,
                waiverAcceptedAt: application.i485_waiver_accepted_at,
                i140PetitionId: application.i140_petition_id,
            })

            // Determinar o cenário do I-140
            setI140Scenario(application.i140_petition_id ? 'has_i140' : 'no_i140')

            await fetchFormData(application)
            setPageState(application.i485_waiver_accepted_at ? 'ready' : 'waiver_pending')
        }

        init()
    }, [])

    // ── Buscar e pré-preencher dados do formulário ───────────────────────────
    const fetchFormData = async (application: any) => {
        setIsFetchingData(true)
        try {
            const draftData: I485Form = {
                p1_first_name: application.p1_first_name || '',
                p1_middle_name: application.p1_middle_name || '',
                p1_last_name: application.p1_last_name || '',
                p1_date_of_birth: application.p1_date_of_birth || '',
                p1_sex: application.p1_sex || '',
                p1_city_of_birth: application.p1_city_of_birth || '',
                p1_country_of_birth: application.p1_country_of_birth || '',
                p1_country_of_citizenship: application.p1_country_of_citizenship || '',
                p1_alien_number: application.p1_alien_number || '',
                p1_passport_number: application.p1_passport_number || '',
                p1_i94_number: application.p1_i94_number || '',
                p1_current_status: application.p1_current_status || '',
                p2_application_type: application.p2_application_type || '',
                p2_receipt_number: application.p2_receipt_number || '',
                p2_priority_date: application.p2_priority_date || '',
                p2_employment_category: application.p2_employment_category || '',
            }

            if (application.i140_petition_id) {
                const { data: i140 } = await supabase
                    .from('i140_petitions')
                    .select('beneficiary_name, priority_date, category')
                    .eq('id', application.i140_petition_id)
                    .single()

                if (i140) {
                    if (!draftData.p1_first_name && !draftData.p1_last_name && i140.beneficiary_name) {
                        const names = i140.beneficiary_name.split(' ')
                        draftData.p1_first_name = names[0] || ''
                        draftData.p1_last_name = names.length > 1 ? names[names.length - 1] : ''
                        if (names.length > 2) draftData.p1_middle_name = names.slice(1, -1).join(' ')
                    }
                    if (!draftData.p2_application_type) draftData.p2_application_type = 'Principal'
                    if (!draftData.p2_priority_date && i140.priority_date)
                        draftData.p2_priority_date = i140.priority_date
                    if (!draftData.p2_employment_category && i140.category)
                        draftData.p2_employment_category = i140.category
                }

                const { data: extracted } = await supabase
                    .from('extracted_fields')
                    .select('field_id, extracted_value')
                    .eq('i140_petition_id', application.i140_petition_id)

                if (extracted?.length) {
                    extracted.forEach(f => {
                        const k = f.field_id.toLowerCase()
                        if (
                            !draftData.p1_date_of_birth &&
                            (k.includes('dob') || k.includes('date_of_birth'))
                        )
                            draftData.p1_date_of_birth = f.extracted_value
                        if (!draftData.p1_city_of_birth && k.includes('city_of_birth'))
                            draftData.p1_city_of_birth = f.extracted_value
                        if (!draftData.p1_country_of_birth && k.includes('country_of_birth'))
                            draftData.p1_country_of_birth = f.extracted_value
                        if (
                            !draftData.p2_receipt_number &&
                            (k.includes('receipt') ||
                                k.includes('wac') ||
                                k.includes('lin') ||
                                k.includes('eac'))
                        )
                            draftData.p2_receipt_number = f.extracted_value
                    })
                }
            }

            reset(draftData)
        } catch (e) {
            console.error(e)
        } finally {
            setIsFetchingData(false)
        }
    }

    // ── Handlers do Passo 2 — Triagem ────────────────────────────────────────
    const setTriageField = (field: keyof TriagemState, value: boolean | number) => {
        setTriage(prev => ({ ...prev, [field]: value }))
    }

    const canAdvanceStep2 = (): boolean => {
        if (i140Scenario === 'loading') return false
        const checklistDone = getChecklistDocs(triage).every(
            d => docUploads[d]?.status === 'done'
        )
        const i140Ok =
            i140Scenario === 'has_i140' || docUploads['i140']?.status === 'done'
        return checklistDone && i140Ok
    }

    const uploadDoc = async (docKey: string, file: File) => {
        if (!session?.userId) return
        setDocUploads(prev => ({ ...prev, [docKey]: { status: 'uploading', fileName: file.name } }))
        try {
            const ext = file.name.split('.').pop() || 'pdf'
            const path = `${session.userId}/i485-docs/${docKey}/${Date.now()}.${ext}`
            const { error: upErr } = await supabase.storage
                .from('bomjur-documents')
                .upload(path, file, { upsert: true })
            if (upErr) throw upErr
            setDocUploads(prev => ({
                ...prev,
                [docKey]: { status: 'done', fileName: file.name },
            }))
        } catch (e: any) {
            setDocUploads(prev => ({
                ...prev,
                [docKey]: { status: 'error', fileName: file.name },
            }))
            showToast('⚠️ Erro ao enviar ' + file.name + '. Tente novamente.')
        }
    }

    const handleI140Upload = async (file: File) => {
        if (!session) return
        setI140UploadState('uploading')
        try {
            await new Promise(r => setTimeout(r, 500))
            setI140UploadState('extracting')

            const fd = new FormData()
            fd.append('file', file)
            fd.append('applicationId', session.applicationId)
            fd.append('clientId', session.userId)

            const res = await fetch('/api/i485/upload-i140', { method: 'POST', body: fd })

            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err.error || 'Erro ao processar I-140')
            }

            setI140UploadState('done')
            setDocUploads(prev => ({ ...prev, i140: { status: 'done', fileName: file.name } }))
            setI140Scenario('has_i140')
            showToast('🪄 I-140 extraído! Seus dados foram pré-preenchidos automaticamente.')

            // Recarregar formulário com dados extraídos
            const { data: updatedApp } = await supabase
                .from('i485_applications')
                .select('*')
                .eq('id', session.applicationId)
                .single()
            if (updatedApp) await fetchFormData(updatedApp)
        } catch (e: any) {
            setI140UploadState('error')
            showToast('⚠️ Erro: ' + e.message)
        }
    }

    // ── Handlers Comuns ──────────────────────────────────────────────────────
    const handleWaiverAccepted = () => {
        setSession(prev =>
            prev ? { ...prev, waiverAcceptedAt: new Date().toISOString() } : null
        )
        setPageState('ready')
    }

    const showToast = (msg: string) => {
        setToastMsg(msg)
        setTimeout(() => setToastMsg(null), 3500)
    }

    const saveDraft = async (data: I485Form, showSuccessToast = true) => {
        if (!session?.applicationId) return
        setSavingDraft(true)
        try {
            const { error: saveErr } = await supabase
                .from('i485_applications')
                .update({
                    p1_first_name: data.p1_first_name,
                    p1_middle_name: data.p1_middle_name,
                    p1_last_name: data.p1_last_name,
                    p1_date_of_birth: data.p1_date_of_birth || null,
                    p1_sex: data.p1_sex,
                    p1_city_of_birth: data.p1_city_of_birth,
                    p1_country_of_birth: data.p1_country_of_birth,
                    p1_country_of_citizenship: data.p1_country_of_citizenship,
                    p1_alien_number: data.p1_alien_number,
                    p1_passport_number: data.p1_passport_number,
                    p1_i94_number: data.p1_i94_number,
                    p1_current_status: data.p1_current_status,
                    p2_application_type: data.p2_application_type,
                    p2_receipt_number: data.p2_receipt_number,
                    p2_priority_date: data.p2_priority_date || null,
                    p2_employment_category: data.p2_employment_category,
                })
                .eq('id', session.applicationId)
            if (saveErr) throw new Error(saveErr.message)
            if (showSuccessToast) showToast('☁️ Progresso salvo com sucesso! Seus dados estão seguros.')
            return true
        } catch (e: any) {
            alert('Erro ao salvar rascunho: ' + e.message)
            return false
        } finally {
            setSavingDraft(false)
        }
    }

    const onSubmit = async (data: I485Form) => {
        const saved = await saveDraft(data, false)
        if (saved) {
            if (currentStep === 3) {
                showToast('✅ Excelente! Parte 1 concluída com sucesso.')
                setCurrentStep(4)
            } else if (currentStep === 4) {
                showToast('🎉 Fantástico! Part 2 registrada com sucesso.')
                setCurrentStep(5)
            }
        }
    }

    const handleStartApplication = async () => {
        if (!creationData) return
        setCreating(true)
        setError(null)
        try {
            const params = new URLSearchParams(window.location.search)
            const i140Id = params.get('i140_id')
            const insertPayload: any = {
                client_id: creationData.userId,
                tenant_id: creationData.tenantId,
                status: 'draft',
            }
            if (i140Id) insertPayload.i140_petition_id = i140Id

            const { data: newApp, error: insertErr } = await supabase
                .from('i485_applications')
                .insert([insertPayload])
                .select('id')
                .single()

            if (insertErr) {
                if (insertErr.message.includes('enum application_status'))
                    throw new Error(
                        "O servidor ainda não reconhece o status 'draft'. Execute o SQL de migração."
                    )
                throw new Error(insertErr.message)
            }

            setSession({
                applicationId: newApp.id,
                clientName: creationData.clientName,
                userId: creationData.userId,
                waiverAcceptedAt: null,
                i140PetitionId: i140Id,
            })
            setI140Scenario(i140Id ? 'has_i140' : 'no_i140')
            setPageState('waiver_pending')
        } catch (err: any) {
            setError(err.message || 'Erro ao criar aplicação. Tente novamente.')
        } finally {
            setCreating(false)
        }
    }

    // ── Renderer de campo do formulário (Steps 3 e 4) ────────────────────────
    const renderInput = (
        name: keyof I485Form,
        label: string,
        type = 'text',
        placeholder = ''
    ) => {
        const val = watchAllFields[name]
        const isFilled = val && String(val).trim() !== ''

        let InputComponent
        if (type === 'select') {
            InputComponent = (
                <select
                    {...register(name)}
                    style={{ ...S.input, borderColor: isFilled ? '#22c55e' : '#cbd5e1' }}
                >
                    <option value="">Selecione...</option>
                    <option value="Male">Masculino (M)</option>
                    <option value="Female">Feminino (F)</option>
                </select>
            )
        } else if (type === 'select_app_type') {
            InputComponent = (
                <select
                    {...register(name)}
                    style={{ ...S.input, borderColor: isFilled ? '#22c55e' : '#cbd5e1' }}
                >
                    <option value="">Selecione o tipo...</option>
                    <option value="Principal">Principal Applicant</option>
                    <option value="Derivative">Derivative Applicant (Cônjuge/Filho)</option>
                </select>
            )
        } else if (type === 'select_category') {
            InputComponent = (
                <select
                    {...register(name)}
                    style={{ ...S.input, borderColor: isFilled ? '#22c55e' : '#cbd5e1' }}
                >
                    <option value="">Selecione a categoria...</option>
                    <option value="EB-1A">Alien of Extraordinary Ability (EB-1A)</option>
                    <option value="EB-1B">Outstanding Professor or Researcher (EB-1B)</option>
                    <option value="EB-1C">Multinational Executive or Manager (EB-1C)</option>
                    <option value="EB-2 NIW">Advanced Degree / National Interest Waiver (EB-2 NIW)</option>
                    <option value="EB-2">Advanced Degree Professional (EB-2)</option>
                    <option value="EB-3">Skilled Worker or Professional (EB-3)</option>
                    <option value="EB-3 Other">Other Worker (EB-3)</option>
                </select>
            )
        } else {
            InputComponent = (
                <input
                    type={type}
                    placeholder={placeholder}
                    {...register(name)}
                    style={{ ...S.input, borderColor: isFilled ? '#22c55e' : '#cbd5e1' }}
                />
            )
        }

        return (
            <div style={S.formGroup}>
                <label style={S.label}>{label}</label>
                <div style={S.inputWrapper}>
                    {InputComponent}
                    {isFilled && <span style={S.checkIcon}>✅</span>}
                </div>
            </div>
        )
    }

    // ── Estados de página (antes do wizard) ──────────────────────────────────
    if (pageState === 'loading') return <FullscreenMsg icon="⟳" text="Verificando sua sessão..." spin />

    if (pageState === 'no_session')
        return (
            <FullscreenMsg icon="🔒" text="Você precisa estar logado para acessar o I-485.">
                <a href="/login" style={S.linkBtn}>
                    Fazer login →
                </a>
            </FullscreenMsg>
        )

    if (pageState === 'no_application')
        return (
            <FullscreenMsg icon="📜" text="Tudo pronto para iniciarmos a próxima fase do seu Green Card!">
                <div
                    style={{
                        textAlign: 'center',
                        maxWidth: 480,
                        margin: '0 auto',
                        animation: 'fadeIn 0.5s ease both',
                    }}
                >
                    <p
                        style={{
                            fontSize: 14,
                            color: '#475569',
                            marginTop: 12,
                            marginBottom: 28,
                            lineHeight: 1.6,
                        }}
                    >
                        Para darmos início ao preenchimento do seu relatório de Ajuste de Status
                        (I-485), clique no botão abaixo para criar a sua aplicação.
                    </p>
                    {error && (
                        <div
                            style={{
                                margin: '0 0 20px',
                                padding: '12px',
                                background: 'rgba(239,68,68,0.1)',
                                color: '#ef4444',
                                borderRadius: 8,
                                fontSize: 13,
                                border: '1px solid rgba(239,68,68,0.3)',
                            }}
                        >
                            ⚠️ {error}
                        </div>
                    )}
                    <button
                        onClick={handleStartApplication}
                        disabled={creating}
                        style={{
                            ...S.startBtn,
                            opacity: creating ? 0.6 : 1,
                            cursor: creating ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {creating ? 'Criando sua petição...' : 'Iniciar Aplicação do I-485 →'}
                    </button>
                </div>
                <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }`}</style>
            </FullscreenMsg>
        )

    const showModal = pageState === 'waiver_pending' && session

    // Valores computados para o Step 2
    const checklistDocs = getChecklistDocs(triage)
    const doneCount = checklistDocs.filter(d => docUploads[d]?.status === 'done').length
    const totalChecklistDocs = checklistDocs.length
    const checklistProgress =
        totalChecklistDocs > 0 ? Math.round((doneCount / totalChecklistDocs) * 100) : 0
    const firstName = session?.clientName?.split(' ')[0] ?? 'Cliente'

    // ── Render Principal ─────────────────────────────────────────────────────
    return (
        <div style={S.page}>
            {toastMsg && <div style={S.toast}>{toastMsg}</div>}

            {showModal && (
                <I485WaiverModal
                    applicationId={session!.applicationId}
                    clientName={session!.clientName}
                    onAccepted={handleWaiverAccepted}
                />
            )}

            {/* ── Header ── */}
            <header style={S.header}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <img
                        src="/proexpandbrasil-logo.png"
                        alt="Proexpand Brasil"
                        style={{ height: 42, width: 'auto' }}
                    />
                    <div style={{ width: 1, height: 24, background: '#e2e8f0' }} />
                    <img
                        src="/bomjur-logo.png"
                        alt="Bomjur Platform"
                        style={{ height: 24, width: 'auto', opacity: 0.8 }}
                    />
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    <h1 style={{ ...S.logoTitle, fontSize: 16, marginBottom: 2 }}>Ajuste de Status I-485</h1>
                    <p style={S.logoSub}>Bem-vindo, {session?.clientName}!</p>
                </div>
            </header>

            <main style={S.main}>
                {/* ════════════════ PASSO 1 — Aditivo ════════════════ */}
                {pageState === 'ready' && currentStep === 1 && (
                    <div style={S.card}>
                        <div style={S.cardIcon}>🚀</div>
                        <h2 style={S.cardTitle}>Missão 1 — Aditivo de Escopo</h2>
                        <p style={S.cardDesc}>
                            Sua declaração foi registrada com sucesso em{' '}
                            <strong style={{ color: '#22c55e' }}>
                                {session?.waiverAcceptedAt
                                    ? new Date(session.waiverAcceptedAt).toLocaleString('pt-BR')
                                    : '—'}
                                .
                            </strong>{' '}
                            Vamos começar o preenchimento do I-485 com seus dados.
                        </p>
                        <div style={S.badge}>✅ Aditivo aceito e registrado</div>
                        <div style={{ marginTop: 32 }}>
                            <button onClick={() => setCurrentStep(2)} style={S.startBtn}>
                                Começar Preenchimento →
                            </button>
                        </div>
                    </div>
                )}

                {/* ════════════════ PASSO 2 — TRIAGEM INTELIGENTE ════════════════ */}
                {pageState === 'ready' && currentStep === 2 && (
                    <div
                        style={{
                            width: '100%',
                            maxWidth: 820,
                            animation: 'fadeIn 0.5s ease both',
                        }}
                    >
                        {/* Indicador de passo */}
                        <div style={{ textAlign: 'center', marginBottom: 28 }}>
                            <span style={S.stepPill}>Passo 2 de 5</span>
                            <h2 style={S.stepBigTitle}>
                                Triagem Inteligente · Seus Documentos
                            </h2>
                            <p style={S.stepSubtitle}>
                                Responda às perguntas abaixo e montamos a lista de documentos
                                personalizada para o seu caso.
                            </p>
                        </div>

                        <div style={S.wizardCard}>
                            <button
                                type="button"
                                onClick={() => setCurrentStep(1)}
                                style={{ ...S.backBtnStep, marginBottom: 32 }}
                            >
                                ← Voltar
                            </button>

                            {/* ── BANNER VIP (Cenários A e C — tem I-140) ── */}
                            {i140Scenario === 'has_i140' && (
                                <div style={S.vipBanner}>
                                    <div style={S.vipGlow} />
                                    <div style={{ position: 'relative', zIndex: 1 }}>
                                        <div style={S.vipBadge}>
                                            ✨ CLIENTE VIP · ECOSSISTEMA INTEGRADO
                                        </div>
                                        <h3 style={S.vipTitle}>
                                            🎉 Olá, {firstName}! Como você já tem um I-140 no
                                            nosso sistema, adiantamos a maior parte do seu I-485!
                                        </h3>
                                        <p style={S.vipDesc}>
                                            Responda às perguntas abaixo apenas para gerarmos a
                                            lista dos seus documentos complementares.
                                        </p>
                                        <div
                                            style={{
                                                display: 'flex',
                                                gap: 10,
                                                flexWrap: 'wrap',
                                                marginTop: 16,
                                            }}
                                        >
                                            <span style={S.vipChip}>⚡ Dados pré-preenchidos</span>
                                            <span style={S.vipChip}>🔗 I-140 vinculado</span>
                                            <span style={S.vipChip}>🤖 IA ativa</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── DROPZONE I-140 (Cenário B — sem I-140) ── */}
                            {i140Scenario === 'no_i140' && (
                                <div style={S.dropzoneSection}>
                                    <div style={S.dropzoneBadge}>
                                        📄 DOCUMENTO BASE NECESSÁRIO
                                    </div>
                                    <h3 style={S.dropzoneTitle}>
                                        Petição I-140 (Formulário ou Recibo)
                                    </h3>
                                    <p style={S.dropzoneDesc}>
                                        Faça o upload do seu I-140 aqui e nossa IA fará a mágica
                                        de preencher seu I-485 automaticamente! 🪄
                                    </p>

                                    {i140UploadState === 'idle' && (
                                        <label style={S.dropzoneBox}>
                                            <input
                                                type="file"
                                                accept=".pdf,.jpg,.jpeg,.png"
                                                style={{ display: 'none' }}
                                                onChange={e => {
                                                    const f = e.target.files?.[0]
                                                    if (f) handleI140Upload(f)
                                                    e.target.value = ''
                                                }}
                                            />
                                            <span
                                                style={{
                                                    fontSize: 44,
                                                    marginBottom: 10,
                                                    display: 'block',
                                                }}
                                            >
                                                📁
                                            </span>
                                            <span
                                                style={{
                                                    fontSize: 15,
                                                    fontWeight: 700,
                                                    color: '#1e293b',
                                                    display: 'block',
                                                }}
                                            >
                                                Clique para selecionar o arquivo
                                            </span>
                                            <span
                                                style={{
                                                    fontSize: 13,
                                                    color: '#64748b',
                                                    marginTop: 6,
                                                    display: 'block',
                                                }}
                                            >
                                                PDF, JPG ou PNG · Máx. 10 MB
                                            </span>
                                        </label>
                                    )}

                                    {(i140UploadState === 'uploading' ||
                                        i140UploadState === 'extracting') && (
                                            <div style={S.extractingBox}>
                                                <div className="i485-spinner" />
                                                <div>
                                                    <p
                                                        style={{
                                                            fontSize: 16,
                                                            fontWeight: 700,
                                                            color: '#a78bfa',
                                                            margin: 0,
                                                        }}
                                                    >
                                                        {i140UploadState === 'uploading'
                                                            ? 'Enviando arquivo...'
                                                            : 'Extraindo dados com IA... ✨'}
                                                    </p>
                                                    {i140UploadState === 'extracting' && (
                                                        <p
                                                            style={{
                                                                fontSize: 13,
                                                                color: '#64748b',
                                                                margin: '4px 0 0',
                                                            }}
                                                        >
                                                            Claude Vision está analisando seu I-140.
                                                            Isso leva alguns segundos.
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                    {i140UploadState === 'done' && (
                                        <div
                                            style={{
                                                ...S.extractingBox,
                                                borderColor: 'rgba(34,197,94,0.4)',
                                                background: 'rgba(34,197,94,0.07)',
                                            }}
                                        >
                                            <span style={{ fontSize: 28 }}>✅</span>
                                            <p
                                                style={{
                                                    fontSize: 15,
                                                    fontWeight: 700,
                                                    color: '#22c55e',
                                                    margin: 0,
                                                }}
                                            >
                                                I-140 processado com sucesso!
                                            </p>
                                        </div>
                                    )}

                                    {i140UploadState === 'error' && (
                                        <div
                                            style={{
                                                ...S.extractingBox,
                                                borderColor: 'rgba(239,68,68,0.4)',
                                                background: 'rgba(239,68,68,0.07)',
                                            }}
                                        >
                                            <span style={{ fontSize: 28 }}>⚠️</span>
                                            <div>
                                                <p
                                                    style={{
                                                        fontSize: 15,
                                                        fontWeight: 700,
                                                        color: '#ef4444',
                                                        margin: 0,
                                                    }}
                                                >
                                                    Falha no processamento
                                                </p>
                                                <button
                                                    onClick={() => setI140UploadState('idle')}
                                                    style={{
                                                        ...S.backBtnStep,
                                                        marginTop: 8,
                                                        fontSize: 12,
                                                        padding: '6px 12px',
                                                    }}
                                                >
                                                    Tentar novamente
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {i140Scenario === 'loading' && (
                                <div
                                    style={{ textAlign: 'center', padding: '32px 0', color: '#475569' }}
                                >
                                    <span
                                        style={{
                                            fontSize: 28,
                                            display: 'inline-block',
                                            animation: 'spin 1s linear infinite',
                                        }}
                                    >
                                        ⟳
                                    </span>
                                    <p style={{ marginTop: 10, fontSize: 14 }}>
                                        Verificando seus dados...
                                    </p>
                                </div>
                            )}

                            {/* ── QUESTIONÁRIO DE TRIAGEM ── */}
                            <div style={{ marginTop: 40 }}>
                                <div style={S.sectionHeader}>
                                    <span style={S.sectionIconLg}>🔍</span>
                                    <div>
                                        <h3 style={S.sectionTitle2}>Questionário de Triagem</h3>
                                        <p style={S.sectionSubtitle2}>
                                            Suas respostas determinam quais documentos você
                                            precisará enviar.
                                        </p>
                                    </div>
                                </div>

                                <div
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 12,
                                        marginTop: 20,
                                    }}
                                >
                                    <ToggleRow
                                        checked={triage.isMarried}
                                        onChange={v => setTriageField('isMarried', v)}
                                        label="Você é casado(a) atualmente?"
                                        icon="💍"
                                    />

                                    <ToggleRow
                                        checked={triage.hasChildren}
                                        onChange={v => setTriageField('hasChildren', v)}
                                        label="Você tem filhos que aplicarão junto com você?"
                                        icon="👨‍👩‍👧‍👦"
                                    />

                                    {triage.hasChildren && (
                                        <div
                                            style={{
                                                animation: 'fadeIn 0.3s ease both',
                                                marginLeft: 20,
                                                padding: '16px 20px',
                                                background: 'rgba(167,139,250,0.07)',
                                                border: '1px solid rgba(167,139,250,0.2)',
                                                borderRadius: 12,
                                            }}
                                        >
                                            <p
                                                style={{
                                                    fontSize: 14,
                                                    fontWeight: 600,
                                                    color: '#a78bfa',
                                                    marginBottom: 12,
                                                }}
                                            >
                                                Quantos filhos aplicarão junto?
                                            </p>
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 16,
                                                }}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setTriageField(
                                                            'childrenCount',
                                                            Math.max(1, triage.childrenCount - 1)
                                                        )
                                                    }
                                                    style={S.counterBtn}
                                                >
                                                    −
                                                </button>
                                                <span
                                                    style={{
                                                        fontSize: 26,
                                                        fontWeight: 800,
                                                        color: '#0f172a',
                                                        minWidth: 36,
                                                        textAlign: 'center',
                                                    }}
                                                >
                                                    {triage.childrenCount}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setTriageField(
                                                            'childrenCount',
                                                            Math.min(10, triage.childrenCount + 1)
                                                        )
                                                    }
                                                    style={S.counterBtn}
                                                >
                                                    +
                                                </button>
                                                <span style={{ fontSize: 13, color: '#475569' }}>
                                                    {triage.childrenCount === 1
                                                        ? 'filho(a)'
                                                        : 'filhos(as)'}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    <ToggleRow
                                        checked={triage.hasPreviousMarriages}
                                        onChange={v => setTriageField('hasPreviousMarriages', v)}
                                        label="Você ou seu cônjuge possuem casamentos anteriores?"
                                        icon="📋"
                                    />
                                </div>
                            </div>

                            {/* ── CHECKLIST DE DOCUMENTOS ── */}
                            <div style={{ marginTop: 40 }}>
                                <div style={{ ...S.sectionHeader, alignItems: 'flex-start' }}>
                                    <span style={S.sectionIconLg}>📎</span>
                                    <div style={{ flex: 1 }}>
                                        <div
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'flex-start',
                                            }}
                                        >
                                            <div>
                                                <h3 style={S.sectionTitle2}>
                                                    Seus Documentos Complementares
                                                </h3>
                                                <p style={S.sectionSubtitle2}>
                                                    Faça o upload de cada documento abaixo.
                                                </p>
                                            </div>
                                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                <span
                                                    style={{
                                                        fontSize: 22,
                                                        fontWeight: 800,
                                                        color:
                                                            checklistProgress === 100
                                                                ? '#22c55e'
                                                                : '#a78bfa',
                                                    }}
                                                >
                                                    {doneCount}/{totalChecklistDocs}
                                                </span>
                                                <p
                                                    style={{
                                                        fontSize: 11,
                                                        color: '#64748b',
                                                        margin: '2px 0 0',
                                                    }}
                                                >
                                                    enviados
                                                </p>
                                            </div>
                                        </div>
                                        {/* Mini progress bar */}
                                        <div
                                            style={{
                                                marginTop: 10,
                                                height: 4,
                                                background: '#f1f5f9',
                                                borderRadius: 999,
                                                overflow: 'hidden',
                                            }}
                                        >
                                            <div
                                                style={{
                                                    height: '100%',
                                                    width: `${checklistProgress}%`,
                                                    background:
                                                        'linear-gradient(90deg, #8b5cf6, #22c55e)',
                                                    transition: 'width 0.5s ease',
                                                    borderRadius: 999,
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Hidden file inputs para cada slot do checklist */}
                                {checklistDocs.map(docKey => (
                                    <input
                                        key={`fi-${docKey}`}
                                        id={`file-input-${docKey}`}
                                        type="file"
                                        accept=".pdf,.jpg,.jpeg,.png"
                                        style={{ display: 'none' }}
                                        onChange={e => {
                                            const f = e.target.files?.[0]
                                            if (f) uploadDoc(docKey, f)
                                            e.target.value = ''
                                        }}
                                    />
                                ))}

                                <div
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 10,
                                        marginTop: 20,
                                    }}
                                >
                                    {checklistDocs.map(docKey => {
                                        const upload = docUploads[docKey]
                                        const isDone = upload?.status === 'done'
                                        const isUploading = upload?.status === 'uploading'
                                        const hasError = upload?.status === 'error'

                                        return (
                                            <div
                                                key={docKey}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    gap: 16,
                                                    padding: '14px 20px',
                                                    background: isDone
                                                        ? 'rgba(34,197,94,0.06)'
                                                        : hasError
                                                            ? 'rgba(239,68,68,0.06)'
                                                            : '#f8fafc',
                                                    border: `1px solid ${isDone
                                                        ? 'rgba(34,197,94,0.3)'
                                                        : hasError
                                                            ? 'rgba(239,68,68,0.3)'
                                                            : '#f1f5f9'
                                                        }`,
                                                    borderRadius: 12,
                                                    transition: 'all 0.3s ease',
                                                    animation: 'fadeIn 0.3s ease both',
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 12,
                                                        flex: 1,
                                                        minWidth: 0,
                                                    }}
                                                >
                                                    <span style={{ fontSize: 18, flexShrink: 0 }}>
                                                        {isDone
                                                            ? '✅'
                                                            : hasError
                                                                ? '❌'
                                                                : '📄'}
                                                    </span>
                                                    <div style={{ minWidth: 0 }}>
                                                        <p
                                                            style={{
                                                                fontSize: 14,
                                                                fontWeight: 600,
                                                                color: isDone
                                                                    ? '#22c55e'
                                                                    : hasError
                                                                        ? '#ef4444'
                                                                        : '#e2e8f0',
                                                                margin: 0,
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                whiteSpace: 'nowrap',
                                                            }}
                                                        >
                                                            {getDocLabel(docKey)}
                                                        </p>
                                                        {upload?.fileName && (
                                                            <p
                                                                style={{
                                                                    fontSize: 11,
                                                                    color: '#64748b',
                                                                    margin: '2px 0 0',
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis',
                                                                    whiteSpace: 'nowrap',
                                                                }}
                                                            >
                                                                {upload.fileName}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    disabled={isUploading}
                                                    onClick={() =>
                                                        document
                                                            .getElementById(
                                                                `file-input-${docKey}`
                                                            )
                                                            ?.click()
                                                    }
                                                    style={{
                                                        padding: '8px 18px',
                                                        borderRadius: 8,
                                                        fontSize: 13,
                                                        fontWeight: 600,
                                                        border: `1px solid ${isDone
                                                            ? 'rgba(34,197,94,0.3)'
                                                            : 'rgba(99,102,241,0.4)'
                                                            } `,
                                                        background: isDone
                                                            ? 'rgba(34,197,94,0.1)'
                                                            : 'rgba(99,102,241,0.15)',
                                                        color: isDone ? '#22c55e' : '#a78bfa',
                                                        cursor: isUploading
                                                            ? 'not-allowed'
                                                            : 'pointer',
                                                        whiteSpace: 'nowrap',
                                                        flexShrink: 0,
                                                        transition: 'all 0.2s ease',
                                                        opacity: isUploading ? 0.6 : 1,
                                                        fontFamily:
                                                            "'Inter', system-ui, sans-serif",
                                                    }}
                                                >
                                                    {isUploading
                                                        ? '⟳ Enviando...'
                                                        : isDone
                                                            ? '✓ Enviado'
                                                            : 'Anexar →'}
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>

                                {checklistProgress === 100 && doneCount > 0 && (
                                    <div
                                        style={{
                                            marginTop: 16,
                                            padding: '12px 20px',
                                            background: 'rgba(34,197,94,0.08)',
                                            border: '1px solid rgba(34,197,94,0.3)',
                                            borderRadius: 10,
                                            display: 'flex',
                                            gap: 10,
                                            alignItems: 'center',
                                            animation: 'fadeIn 0.4s ease both',
                                        }}
                                    >
                                        <span style={{ fontSize: 20 }}>🎉</span>
                                        <p
                                            style={{
                                                fontSize: 14,
                                                fontWeight: 600,
                                                color: '#22c55e',
                                                margin: 0,
                                            }}
                                        >
                                            Todos os documentos enviados! Você pode avançar.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* ── BOTÃO AVANÇAR ── */}
                            <div style={{ ...S.actionRow, marginTop: 40 }}>
                                <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
                                    {canAdvanceStep2()
                                        ? '✅ Tudo pronto! Clique em Avançar.'
                                        : '⏳ Envie todos os documentos listados para prosseguir.'}
                                </p>
                                <button
                                    type="button"
                                    disabled={!canAdvanceStep2()}
                                    onClick={() => {
                                        showToast('✅ Triagem concluída! Vamos preencher seus dados.')
                                        setCurrentStep(3)
                                    }}
                                    style={{
                                        ...S.submitBtn,
                                        opacity: canAdvanceStep2() ? 1 : 0.35,
                                        cursor: canAdvanceStep2() ? 'pointer' : 'not-allowed',
                                        boxShadow: canAdvanceStep2()
                                            ? '0 10px 25px rgba(16,185,129,0.3)'
                                            : 'none',
                                    }}
                                >
                                    Avançar →
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ════════════════ PASSOS 3 e 4 — Formulários ════════════════ */}
                {pageState === 'ready' && (currentStep === 3 || currentStep === 4) && (
                    <div style={S.wizardContainer}>
                        {/* Barra de Progresso Emocional */}
                        <div style={S.progressWrapper}>
                            <div style={S.progressHeader}>
                                <span style={S.progressText}>{currentProgressMsg}</span>
                                <span style={S.progressPercent}>{progressPercent}%</span>
                            </div>
                            <div style={S.progressBarBg}>
                                <div
                                    style={{ ...S.progressBarFill, width: `${progressPercent}% ` }}
                                />
                            </div>
                        </div>

                        <div style={S.wizardCard}>
                            {isFetchingData ? (
                                <div
                                    style={{ textAlign: 'center', padding: 40, color: '#475569' }}
                                >
                                    <span
                                        style={{
                                            fontSize: 24,
                                            animation: 'spin 1s linear infinite',
                                            display: 'inline-block',
                                        }}
                                    >
                                        ⟳
                                    </span>
                                    <p style={{ marginTop: 12 }}>
                                        Buscando e formatando seus dados prévios...
                                    </p>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit(onSubmit)}>
                                    {/* ── PASSO 3 — Part 1 ── */}
                                    {currentStep === 3 && (
                                        <div style={{ animation: 'fadeIn 0.5s ease both' }}>
                                            <div style={S.stepHeader}>
                                                <button
                                                    type="button"
                                                    onClick={() => setCurrentStep(2)}
                                                    style={S.backBtnStep}
                                                >
                                                    ← Voltar
                                                </button>
                                                <h2 style={S.wizardTitle}>
                                                    Passo 3: Informações Pessoais{' '}
                                                    <span
                                                        style={{
                                                            fontSize: 14,
                                                            color: '#475569',
                                                            fontWeight: 400,
                                                        }}
                                                    >
                                                        (Part 1)
                                                    </span>
                                                </h2>
                                            </div>
                                            <div style={S.formGrid}>
                                                <div style={S.formSection}>
                                                    <h3 style={S.sectionTitle}>
                                                        Seu Nome Legal Atual
                                                    </h3>
                                                    <div style={S.row}>
                                                        {renderInput(
                                                            'p1_first_name',
                                                            'Given Name (First Name)'
                                                        )}
                                                        {renderInput(
                                                            'p1_middle_name',
                                                            'Middle Name'
                                                        )}
                                                        {renderInput(
                                                            'p1_last_name',
                                                            'Family Name (Last Name)'
                                                        )}
                                                    </div>
                                                </div>
                                                <div style={S.formSection}>
                                                    <h3 style={S.sectionTitle}>
                                                        Informações de Nascimento
                                                    </h3>
                                                    <div style={S.row}>
                                                        {renderInput(
                                                            'p1_date_of_birth',
                                                            'Date of Birth (mm/dd/yyyy)',
                                                            'date'
                                                        )}
                                                        {renderInput('p1_sex', 'Sex', 'select')}
                                                        {renderInput(
                                                            'p1_city_of_birth',
                                                            'City/Town/Village of Birth'
                                                        )}
                                                        {renderInput(
                                                            'p1_country_of_birth',
                                                            'Country of Birth'
                                                        )}
                                                    </div>
                                                </div>
                                                <div style={S.formSection}>
                                                    <h3 style={S.sectionTitle}>
                                                        Identificação Legal
                                                    </h3>
                                                    <div style={S.row}>
                                                        {renderInput(
                                                            'p1_country_of_citizenship',
                                                            'Country of Citizenship/Nationality'
                                                        )}
                                                        {renderInput(
                                                            'p1_alien_number',
                                                            'Alien Registration Number (A-Number)'
                                                        )}
                                                    </div>
                                                </div>
                                                <div style={S.formSection}>
                                                    <h3 style={S.sectionTitle}>
                                                        Histórico de Chegada e Status
                                                    </h3>
                                                    <div style={S.row}>
                                                        {renderInput(
                                                            'p1_passport_number',
                                                            'Passport Number'
                                                        )}
                                                        {renderInput(
                                                            'p1_i94_number',
                                                            'Form I-94 Arrival-Departure Record Number'
                                                        )}
                                                        {renderInput(
                                                            'p1_current_status',
                                                            'Current Immigration Status'
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* ── PASSO 4 — Part 2 ── */}
                                    {currentStep === 4 && (
                                        <div style={{ animation: 'fadeIn 0.5s ease both' }}>
                                            <div style={S.stepHeader}>
                                                <button
                                                    type="button"
                                                    onClick={() => setCurrentStep(3)}
                                                    style={S.backBtnStep}
                                                >
                                                    ← Voltar
                                                </button>
                                                <h2 style={S.wizardTitle}>
                                                    Passo 4: Tipo de Aplicação{' '}
                                                    <span
                                                        style={{
                                                            fontSize: 14,
                                                            color: '#475569',
                                                            fontWeight: 400,
                                                        }}
                                                    >
                                                        (Part 2)
                                                    </span>
                                                </h2>
                                            </div>
                                            <div style={S.formGrid}>
                                                <div style={S.formSection}>
                                                    <h3 style={S.sectionTitle}>
                                                        1. Você é o Beneficiário Principal?
                                                    </h3>
                                                    <div style={S.row}>
                                                        {renderInput(
                                                            'p2_application_type',
                                                            'Application Type',
                                                            'select_app_type'
                                                        )}
                                                    </div>
                                                </div>
                                                <div style={S.formSection}>
                                                    <h3 style={S.sectionTitle}>
                                                        2. Informações da Petição Base (I-140)
                                                    </h3>
                                                    <div style={S.row}>
                                                        {renderInput(
                                                            'p2_receipt_number',
                                                            'Receipt Number of Underlying Petition'
                                                        )}
                                                        {renderInput(
                                                            'p2_priority_date',
                                                            'Priority Date (mm/dd/yyyy)',
                                                            'date'
                                                        )}
                                                    </div>
                                                </div>
                                                <div style={S.formSection}>
                                                    <h3 style={S.sectionTitle}>
                                                        3. Categoria (Employment-Based)
                                                    </h3>
                                                    <div style={S.row}>
                                                        {renderInput(
                                                            'p2_employment_category',
                                                            'Filing Category',
                                                            'select_category'
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Action Buttons Compartilhados */}
                                    <div style={S.actionRow}>
                                        <button
                                            type="button"
                                            style={S.draftBtn}
                                            onClick={() => saveDraft(watchAllFields)}
                                            disabled={savingDraft}
                                        >
                                            {savingDraft ? 'Salvando...' : '☁️ Guardar Rascunho'}
                                        </button>
                                        <button type="submit" style={S.submitBtn}>
                                            Salvar e Avançar →
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                )}

                {/* ════════════════ PASSO 5 — Conclusão ════════════════ */}
                {pageState === 'ready' && currentStep === 5 && (
                    <div style={S.card}>
                        <div style={S.cardIcon}>🛡️</div>
                        <h2 style={S.cardTitle}>Você concluiu a Parte 2!</h2>
                        <p style={S.cardDesc}>
                            O Passo 5 "Part 3. Additional Info" entrará em breve na fase de
                            modelagem de dados.
                        </p>
                        <button onClick={() => setCurrentStep(4)} style={S.backBtnStep}>
                            ← Voltar para revisão
                        </button>
                    </div>
                )}
            </main>

            <style>{`
                                        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
                * { box- sizing: border-box; margin: 0; padding: 0; }
                                    @keyframes spin {to {transform: rotate(360deg); } }
                                    @keyframes fadeIn {from {opacity: 0; transform: translateY(10px); } to {opacity: 1; transform: translateY(0); } }
                                    @keyframes dropIn {from {opacity: 0; transform: translate(-50%, -20px); } to {opacity: 1; transform: translate(-50%, 0); } }
                                    @keyframes vipPulse {0 %, 100 % { opacity: 0.6; } 50% {opacity: 1; } }
                                    .i485-spinner {
                                        width: 34px;
                                    height: 34px;
                                    border: 3px solid rgba(167,139,250,0.25);
                                    border-top-color: #a78bfa;
                                    border-radius: 50%;
                                    animation: spin 0.8s linear infinite;
                                    flex-shrink: 0;
                }
            `}</style>
        </div>
    )
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────
function FullscreenMsg({
    icon,
    text,
    spin,
    children,
}: {
    icon: string
    text: string
    spin?: boolean
    children?: React.ReactNode
}) {
    return (
        <div
            style={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg,#0f0c29,#302b63,#24243e)',
                fontFamily: "'Inter', system-ui, sans-serif",
                color: '#1e293b',
                gap: 12,
            }}
        >
            <span
                style={{
                    fontSize: 40,
                    animation: spin ? 'spin 1s linear infinite' : 'none',
                }}
            >
                {icon}
            </span>
            <p style={{ fontSize: 16, color: '#475569' }}>{text}</p>
            {children}
        </div>
    )
}

function ToggleRow({
    checked,
    onChange,
    label,
    icon,
}: {
    checked: boolean
    onChange: (v: boolean) => void
    label: string
    icon: string
}) {
    return (
        <div
            onClick={() => onChange(!checked)}
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderRadius: 14,
                cursor: 'pointer',
                background: checked ? 'rgba(34,197,94,0.07)' : '#f8fafc',
                border: `1px solid ${checked ? 'rgba(34,197,94,0.35)' : '#f1f5f9'
                    }`,
                transition: 'all 0.25s ease',
                userSelect: 'none',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 20 }}>{icon}</span>
                <span
                    style={{
                        fontSize: 15,
                        fontWeight: 500,
                        color: checked ? '#e2e8f0' : '#94a3b8',
                    }}
                >
                    {label}
                </span>
            </div>
            {/* Toggle Switch */}
            <div
                style={{
                    position: 'relative',
                    width: 52,
                    height: 28,
                    flexShrink: 0,
                    background: checked
                        ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                        : '#cbd5e1',
                    borderRadius: 999,
                    transition: 'background 0.25s ease',
                    boxShadow: checked ? '0 0 14px rgba(34,197,94,0.45)' : 'none',
                }}
            >
                <div
                    style={{
                        position: 'absolute',
                        top: 3,
                        left: checked ? 26 : 3,
                        width: 22,
                        height: 22,
                        background: '#fff',
                        borderRadius: 999,
                        transition: 'left 0.25s ease',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
                    }}
                />
            </div>
        </div>
    )
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
    page: {
        minHeight: '100vh',
        background: '#f8fafc',
        fontFamily: "'Inter', system-ui, sans-serif",
        color: '#1e293b',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '20px 32px',
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #e2e8f0',
        position: 'sticky',
        top: 0,
        zIndex: 100,
    },
    logoIcon: { fontSize: 28 },
    logoTitle: {
        fontSize: 18,
        fontWeight: 800,
        color: '#0f172a',
    },
    logoSub: { fontSize: 13, color: '#64748b', fontWeight: 500 },
    main: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        minHeight: 'calc(100vh - 80px)',
    },

    // ── Card simples (Step 1, 5) ──
    card: {
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 32,
        padding: '48px 40px',
        maxWidth: 520,
        textAlign: 'center',
        boxShadow: '0 20px 50px rgba(0,0,0,0.05)',
        animation: 'fadeIn 0.5s ease both',
    },
    cardIcon: { fontSize: 48, marginBottom: 20 },
    cardTitle: { fontSize: 24, fontWeight: 800, color: '#0f172a', marginBottom: 16 },
    cardDesc: { fontSize: 15, color: '#475569', lineHeight: 1.7, marginBottom: 24 },
    badge: {
        display: 'inline-block',
        padding: '8px 20px',
        background: '#f0fdf4',
        border: '1px solid #bbf7d0',
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 700,
        color: '#16a34a',
    },
    linkBtn: {
        display: 'inline-block',
        marginTop: 16,
        padding: '12px 28px',
        background: '#0f172a',
        color: '#ffffff',
        fontWeight: 700,
        fontSize: 14,
        borderRadius: 14,
        textDecoration: 'none',
        boxShadow: '0 8px 20px rgba(15,23,42,0.15)',
    },
    startBtn: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px 36px',
        borderRadius: 16,
        background: '#0f172a',
        border: 'none',
        color: '#ffffff',
        fontFamily: "'Inter', system-ui, sans-serif",
        fontSize: 15,
        fontWeight: 800,
        boxShadow: '0 10px 25px rgba(15,23,42,0.15)',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
    },

    // ── Step 2 — Indicador ──
    stepPill: {
        display: 'inline-block',
        padding: '6px 16px',
        background: '#f1f5f9',
        border: '1px solid #e2e8f0',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        color: '#64748b',
        letterSpacing: 0.5,
        marginBottom: 16,
        textTransform: 'uppercase' as const,
    },
    stepBigTitle: {
        fontSize: 32,
        fontWeight: 900,
        color: '#0f172a',
        marginBottom: 12,
        letterSpacing: '-0.5px',
    },
    stepSubtitle: {
        fontSize: 15,
        color: '#475569',
        lineHeight: 1.6,
        maxWidth: 520,
        margin: '0 auto',
    },

    // ── Banner VIP ──
    vipBanner: {
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 24,
        padding: '32px',
        background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)',
        border: '1px solid #bbf7d0',
        marginBottom: 8,
    },
    vipGlow: {
        position: 'absolute',
        top: -60,
        right: -60,
        width: 200,
        height: 200,
        background: 'radial-gradient(circle, rgba(34,197,94,0.15) 0%, transparent 70%)',
        animation: 'vipPulse 3s ease-in-out infinite',
        pointerEvents: 'none',
    },
    vipBadge: {
        display: 'inline-block',
        padding: '6px 16px',
        background: '#22c55e',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 800,
        color: '#ffffff',
        letterSpacing: 1.2,
        marginBottom: 16,
        textTransform: 'uppercase' as const,
        boxShadow: '0 4px 12px rgba(34,197,94,0.25)',
    },
    vipTitle: {
        fontSize: 20,
        fontWeight: 800,
        color: '#0f172a',
        lineHeight: 1.4,
        marginBottom: 12,
    },
    vipDesc: {
        fontSize: 15,
        color: '#475569',
        lineHeight: 1.6,
        marginBottom: 20,
    },
    vipChip: {
        display: 'inline-block',
        padding: '6px 14px',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 700,
        color: '#334155',
        boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
    },

    // ── Dropzone I-140 (Cenário B) ──
    dropzoneSection: {
        padding: '32px',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 24,
        marginBottom: 8,
    },
    dropzoneBadge: {
        display: 'inline-block',
        padding: '6px 14px',
        background: '#eff6ff',
        border: '1px solid #bfdbfe',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 800,
        color: '#2563eb',
        letterSpacing: 0.8,
        marginBottom: 16,
        textTransform: 'uppercase' as const,
    },
    dropzoneTitle: {
        fontSize: 20,
        fontWeight: 800,
        color: '#0f172a',
        marginBottom: 10,
    },
    dropzoneDesc: {
        fontSize: 15,
        color: '#475569',
        lineHeight: 1.6,
        marginBottom: 24,
    },
    dropzoneBox: {
        display: 'block',
        padding: '40px 24px',
        background: '#ffffff',
        border: '2px dashed #cbd5e1',
        borderRadius: 20,
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'all 0.25s ease',
    },
    extractingBox: {
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '24px',
        background: '#eff6ff',
        border: '1px solid #bfdbfe',
        borderRadius: 16,
    },

    // ── Seção headers (Step 2) ──
    sectionHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        marginBottom: 8,
    },
    sectionIconLg: { fontSize: 28, flexShrink: 0 },
    sectionTitle2: { fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 4 },
    sectionSubtitle2: { fontSize: 14, color: '#64748b' },

    // ── Counter Btn ──
    counterBtn: {
        width: 44,
        height: 44,
        borderRadius: 14,
        background: '#f1f5f9',
        border: '1px solid #e2e8f0',
        color: '#334155',
        fontSize: 22,
        fontWeight: 700,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s ease',
        fontFamily: "'Inter', system-ui, sans-serif",
    },

    // ── Wizard container (Steps 3 e 4) ──
    wizardContainer: {
        width: '100%',
        maxWidth: 900,
        animation: 'fadeIn 0.5s ease both',
    },
    progressWrapper: {
        background: '#ffffff',
        borderRadius: 20,
        padding: '20px 28px',
        marginBottom: 32,
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
    },
    progressHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: 14 },
    progressText: { fontSize: 15, fontWeight: 700, color: '#475569' },
    progressPercent: { fontSize: 15, fontWeight: 800, color: '#22c55e' },
    progressBarBg: {
        height: 10,
        background: '#f1f5f9',
        borderRadius: 999,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        background: 'linear-gradient(90deg, #3b82f6, #22c55e)',
        transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
        borderRadius: 999,
    },
    wizardCard: {
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 32,
        padding: 48,
        boxShadow: '0 20px 50px rgba(0,0,0,0.05)',
    },
    stepHeader: { display: 'flex', alignItems: 'center', gap: 24, marginBottom: 32 },
    backBtnStep: {
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        color: '#475569',
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: 700,
        padding: '10px 20px',
        borderRadius: 12,
        transition: 'all 0.2s ease',
        fontFamily: "'Inter', system-ui, sans-serif",
    },
    wizardTitle: { fontSize: 28, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px' },
    formGrid: { display: 'flex', flexDirection: 'column', gap: 36 },
    formSection: {
        background: '#f8fafc',
        padding: 32,
        borderRadius: 24,
        border: '1px solid #e2e8f0',
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 800,
        color: '#0f172a',
        marginBottom: 20,
        textTransform: 'uppercase',
        letterSpacing: 1.2,
    },
    row: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 24,
    },
    formGroup: { display: 'flex', flexDirection: 'column', gap: 10 },
    label: { fontSize: 13, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' },
    inputWrapper: { position: 'relative', display: 'flex', alignItems: 'center' },
    input: {
        width: '100%',
        padding: '14px 44px 14px 18px',
        borderRadius: 14,
        background: '#ffffff',
        border: '1px solid #cbd5e1',
        color: '#0f172a',
        fontSize: 15,
        fontWeight: 500,
        outline: 'none',
        transition: 'all 0.2s ease',
        fontFamily: "'Inter', system-ui, sans-serif",
        boxShadow: '0 2px 4px rgba(0,0,0,0.01)',
    },
    checkIcon: { position: 'absolute', right: 14, fontSize: 16, animation: 'fadeIn 0.3s ease' },
    actionRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 48,
        paddingTop: 36,
        borderTop: '1px solid #e2e8f0',
    },
    draftBtn: {
        padding: '16px 28px',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        color: '#475569',
        fontSize: 15,
        fontWeight: 700,
        borderRadius: 14,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        fontFamily: "'Inter', system-ui, sans-serif",
    },
    submitBtn: {
        padding: '16px 36px',
        background: '#0f172a',
        border: 'none',
        color: '#ffffff',
        fontSize: 15,
        fontWeight: 800,
        borderRadius: 14,
        cursor: 'pointer',
        boxShadow: '0 10px 25px rgba(15,23,42,0.15)',
        transition: 'all 0.2s ease',
        fontFamily: "'Inter', system-ui, sans-serif",
    },
    toast: {
        position: 'fixed',
        top: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#ffffff',
        border: '1px solid #bbf7d0',
        borderRadius: 999,
        padding: '14px 28px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        color: '#16a34a',
        fontSize: 14,
        fontWeight: 700,
        zIndex: 9999,
        boxShadow: '0 10px 40px rgba(34,197,94,0.15)',
        animation: 'dropIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        whiteSpace: 'nowrap',
    },
}

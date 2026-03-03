'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

// ============================================================
// TYPES
// ============================================================
type AiStatus = 'idle' | 'processing' | 'completed' | 'error'
type BlockStatus = 'pending' | 'review' | 'extracted'
type PackageStatus = 'draft' | 'approved' | 'printing' | 'sent'

interface Dependent {
    id: string
    name: string
    relationship: 'Cônjuge' | 'Filho(a)'
    dob: string
}

interface ClientData {
    id: string
    full_name: string
    email: string
    caseId: string
    dependents: Dependent[]
    fillProgress: number
    aiStatus: AiStatus
    aiProcessingStep: string
    lastDocumentProcessed: string
    applicationId: string
}

interface FormBlock {
    id: string
    title: string
    emoji: string
    status: BlockStatus
    fieldsTotal: number
    fieldsExtracted: number
    lastUpdated?: string
}

interface PackageFile {
    id: string
    label: string  // e.g. "Eduardo Santos", "Ana Clara Santos"
    fileName: string
    attached: boolean
    url?: string
}

interface AssemblyItem {
    id: string
    order: number
    emoji: string
    title: string
    description: string
    checked: boolean
    files: PackageFile[]
    supportsMultiple: boolean
    required: boolean
}

// ============================================================
// MOCK DATA
// Substitua cada const abaixo por queries reais do Supabase.
// Padrão sugerido: API Route /api/admin/clients/[id] com
// service role key para bypassar RLS.
// ============================================================
const MOCK_CLIENT: ClientData = {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    full_name: 'Eduardo Ferreira Santos',
    email: 'eduardo.santos@techcorp.com',
    caseId: 'PRX-2024-I485-00042',
    dependents: [
        { id: 'dep-1', name: 'Mariana Santos', relationship: 'Cônjuge', dob: '1989-06-15' },
        { id: 'dep-2', name: 'Ana Clara Santos', relationship: 'Filho(a)', dob: '2015-03-12' },
        { id: 'dep-3', name: 'Lucas Santos', relationship: 'Filho(a)', dob: '2018-07-22' },
    ],
    fillProgress: 68,
    aiStatus: 'processing',
    aiProcessingStep: 'Extraindo Part 9 — Perguntas de Segurança (Segurança Nacional)...',
    lastDocumentProcessed: 'Passaporte Brasileiro (Eduardo Ferreira Santos)',
    applicationId: 'app-0042',
}

const MOCK_FORM_BLOCKS: FormBlock[] = [
    {
        id: 'personal',
        title: 'Dados Pessoais (Part 1–3)',
        emoji: '👤',
        status: 'extracted',
        fieldsTotal: 24,
        fieldsExtracted: 24,
        lastUpdated: '28/02/2025',
    },
    {
        id: 'address',
        title: 'Histórico de Endereços — 5 anos',
        emoji: '🏠',
        status: 'review',
        fieldsTotal: 18,
        fieldsExtracted: 12,
        lastUpdated: '01/03/2025',
    },
    {
        id: 'employment',
        title: 'Histórico de Emprego — 5 anos',
        emoji: '💼',
        status: 'review',
        fieldsTotal: 15,
        fieldsExtracted: 9,
        lastUpdated: '01/03/2025',
    },
    {
        id: 'security',
        title: 'Perguntas de Segurança (Part 9)',
        emoji: '🔒',
        status: 'pending',
        fieldsTotal: 32,
        fieldsExtracted: 0,
    },
]

// Esteira de Montagem — ordem inegociável USCIS
// Atualizar `checked` e `files[n].attached` com dados reais de:
//   supabase.from('package_checklist').select('*').eq('application_id', applicationId)
function buildInitialAssemblyItems(): AssemblyItem[] {
    return [
        {
            id: 'fee',
            order: 1,
            emoji: '💵',
            title: 'Taxa de Protocolo',
            description: 'Cheque ou Form G-1450 (pagamento eletrônico)',
            checked: true,
            supportsMultiple: false,
            required: true,
            files: [
                { id: 'fee-1', label: 'G-1450', fileName: 'G-1450 Preenchido.pdf', attached: true },
            ],
        },
        {
            id: 'g1145',
            order: 2,
            emoji: '✉️',
            title: 'Form G-1145',
            description: 'e-Notification of Application/Petition Acceptance',
            checked: true,
            supportsMultiple: false,
            required: true,
            files: [
                { id: 'g1145-1', label: 'G-1145', fileName: 'G-1145 Assinado.pdf', attached: true },
            ],
        },
        {
            id: 'cover',
            order: 3,
            emoji: '📎',
            title: 'Cover Letter',
            description: 'Carta de apresentação da Proexpand',
            checked: false,
            supportsMultiple: false,
            required: true,
            files: [
                { id: 'cover-1', label: 'Carta Proexpand', fileName: 'Cover Letter - Eduardo Santos.pdf', attached: false },
            ],
        },
        {
            id: 'photos',
            order: 4,
            emoji: '📸',
            title: 'Fotos Estilo Passaporte',
            description: '2×2 polegadas · Requerente e todos os dependentes',
            checked: false,
            supportsMultiple: true,
            required: true,
            files: [
                { id: 'photo-req', label: 'Eduardo Santos', fileName: 'Foto Eduardo Santos.jpg', attached: true },
                { id: 'photo-dep1', label: 'Mariana Santos', fileName: 'Foto Mariana Santos.jpg', attached: true },
                { id: 'photo-dep2', label: 'Ana Clara Santos', fileName: 'Foto Ana Clara Santos.jpg', attached: false },
                { id: 'photo-dep3', label: 'Lucas Santos', fileName: 'Foto Lucas Santos.jpg', attached: false },
            ],
        },
        {
            id: 'i485',
            order: 5,
            emoji: '📄',
            title: 'Form I-485',
            description: 'Application to Register Permanent Residence — Assinado pelo beneficiário',
            checked: false,
            supportsMultiple: false,
            required: true,
            files: [
                { id: 'i485-main', label: 'Eduardo Santos (Principal)', fileName: 'I-485 Eduardo Santos ASSINADO.pdf', attached: true },
                { id: 'i485-dep1', label: 'Mariana Santos (Dependente)', fileName: 'I-485 Mariana Santos ASSINADO.pdf', attached: true },
                { id: 'i485-dep2', label: 'Ana Clara Santos (Dependente)', fileName: 'I-485 Ana Clara Santos ASSINADO.pdf', attached: false },
                { id: 'i485-dep3', label: 'Lucas Santos (Dependente)', fileName: 'I-485 Lucas Santos ASSINADO.pdf', attached: false },
            ],
        },
        {
            id: 'i485j',
            order: 6,
            emoji: '📄',
            title: 'Form I-485 Supplement J',
            description: 'Confirmação de Oferta de Emprego Contínua — se aplicável',
            checked: false,
            supportsMultiple: false,
            required: false,
            files: [
                { id: 'i485j-1', label: 'TechCorp Inc.', fileName: 'I-485J - TechCorp Inc.pdf', attached: true },
            ],
        },
        {
            id: 'i693',
            order: 7,
            emoji: '🩺',
            title: 'Form I-693',
            description: 'Exame Médico em ENVELOPE LACRADO — Requerente + cada Dependente',
            checked: false,
            supportsMultiple: true,
            required: true,
            files: [
                { id: 'i693-req', label: 'Eduardo Santos', fileName: 'I-693 Eduardo Santos (Lacrado).pdf', attached: true },
                { id: 'i693-dep1', label: 'Mariana Santos', fileName: 'I-693 Mariana Santos (Lacrado).pdf', attached: true },
                { id: 'i693-dep2', label: 'Ana Clara Santos', fileName: 'I-693 Ana Clara Santos (Lacrado).pdf', attached: false },
                { id: 'i693-dep3', label: 'Lucas Santos', fileName: 'I-693 Lucas Santos (Lacrado).pdf', attached: false },
            ],
        },
        {
            id: 'i797',
            order: 8,
            emoji: '📄',
            title: 'Cópia do Form I-797',
            description: 'I-140 Approval Notice ou Receipt Notice',
            checked: false,
            supportsMultiple: false,
            required: true,
            files: [
                { id: 'i797-1', label: 'I-140 Approval', fileName: 'I-797 Approval Notice I-140.pdf', attached: true },
            ],
        },
        {
            id: 'passports',
            order: 9,
            emoji: '🛂',
            title: 'Documentos de Identidade',
            description: 'Passaportes válidos do Requerente e todos os Dependentes',
            checked: false,
            supportsMultiple: true,
            required: true,
            files: [
                { id: 'pass-req', label: 'Eduardo Santos', fileName: 'Passaporte Eduardo Santos.pdf', attached: true },
                { id: 'pass-dep1', label: 'Mariana Santos', fileName: 'Passaporte Mariana Santos.pdf', attached: true },
                { id: 'pass-dep2', label: 'Ana Clara Santos', fileName: 'Passaporte Ana Clara Santos.pdf', attached: true },
                { id: 'pass-dep3', label: 'Lucas Santos', fileName: 'Passaporte Lucas Santos.pdf', attached: false },
            ],
        },
        {
            id: 'birth',
            order: 10,
            emoji: '👶',
            title: 'Certidões de Nascimento + Tradução',
            description: 'Requerente e todos os Dependentes com tradução juramentada',
            checked: false,
            supportsMultiple: true,
            required: true,
            files: [
                { id: 'birth-req', label: 'Eduardo Santos', fileName: 'Certidão Eduardo Santos + Tradução.pdf', attached: true },
                { id: 'birth-dep1', label: 'Mariana Santos', fileName: 'Certidão Mariana Santos + Tradução.pdf', attached: true },
                { id: 'birth-dep2', label: 'Ana Clara Santos', fileName: 'Certidão Ana Clara Santos + Tradução.pdf', attached: true },
                { id: 'birth-dep3', label: 'Lucas Santos', fileName: 'Certidão Lucas Santos + Tradução.pdf', attached: false },
            ],
        },
        {
            id: 'i94',
            order: 11,
            emoji: '✈️',
            title: 'Form I-94 e Cópia do Visto/Carimbo',
            description: 'Arrival/Departure Record + página do visto e carimbo de última entrada',
            checked: false,
            supportsMultiple: false,
            required: true,
            files: [
                { id: 'i94-req', label: 'Eduardo Santos', fileName: 'I-94 Eduardo Santos.pdf', attached: true },
                { id: 'i94-dep1', label: 'Mariana Santos', fileName: 'I-94 Mariana Santos.pdf', attached: false },
            ],
        },
        {
            id: 'status',
            order: 12,
            emoji: '📁',
            title: 'Evidência de Status Legal',
            description: 'I-20s, I-797s de extensão, cartas de aprovação anteriores',
            checked: false,
            supportsMultiple: true,
            required: true,
            files: [
                { id: 'status-1', label: 'I-20 Final', fileName: 'I-20 Final Eduardo Santos.pdf', attached: true },
                { id: 'status-2', label: 'H-1B Extensão 2023', fileName: 'I-797 Extensão H-1B 2023.pdf', attached: true },
                { id: 'status-3', label: 'H-1B Original', fileName: 'I-797 H-1B Original.pdf', attached: false },
            ],
        },
        {
            id: 'civil',
            order: 13,
            emoji: '💍',
            title: 'Documentos Civis Extras',
            description: 'Certidão de Casamento / Divórcio + tradução — se aplicável',
            checked: false,
            supportsMultiple: true,
            required: false,
            files: [
                { id: 'civil-1', label: 'Certidão de Casamento', fileName: 'Certidão Casamento Eduardo e Mariana + Tradução.pdf', attached: true },
            ],
        },
    ]
}

// ============================================================
// HELPERS
// ============================================================
function StatusPill({ status }: { status: BlockStatus }) {
    const map = {
        pending: { label: 'Pendente', emoji: '⏳', bg: '#fef3c7', fg: '#92400e' },
        review: { label: 'Em Revisão', emoji: '🟡', bg: '#fef9c3', fg: '#713f12' },
        extracted: { label: 'Extraído', emoji: '✅', bg: '#dcfce7', fg: '#166534' },
    }
    const s = map[status]
    return (
        <span style={{
            background: s.bg, color: s.fg,
            fontSize: 11, fontWeight: 700,
            padding: '2px 9px', borderRadius: 20,
            whiteSpace: 'nowrap',
        }}>
            {s.emoji} {s.label}
        </span>
    )
}

// ============================================================
// MAIN PAGE
// ============================================================
export default function ClientCommandCenter() {
    const params = useParams()
    const router = useRouter()
    const clientId = (params?.id as string) ?? ''

    // ── DATA STATE ─────────────────────────────────────────
    // TODO: Replace MOCK_CLIENT with a real fetch:
    // const [client, setClient] = useState<ClientData | null>(null)
    // useEffect(() => {
    //   fetch(`/api/admin/clients/${clientId}`)  // API Route com service role key
    //     .then(r => r.json())
    //     .then(data => setClient(data))
    // }, [clientId])
    const client = MOCK_CLIENT

    const [formBlocks] = useState<FormBlock[]>(MOCK_FORM_BLOCKS)
    const [assemblyItems, setAssemblyItems] = useState<AssemblyItem[]>(buildInitialAssemblyItems)

    // ── DISPATCH STATE ─────────────────────────────────────
    const [packageStatus, setPackageStatus] = useState<PackageStatus>('draft')
    const [trackingInput, setTrackingInput] = useState('')
    const [showTrackingField, setShowTrackingField] = useState(false)
    const [showPreview, setShowPreview] = useState(false) // 👈 NOVO ESTADO PARA O MODAL DE PREVIEW

    // ── LIVE INDICATOR ─────────────────────────────────────
    // TODO: Supabase Realtime — subscribes to extracted_fields changes for this client
    // useEffect(() => {
    //   const supabase = createBrowserClient(
    //     process.env.NEXT_PUBLIC_SUPABASE_URL!,
    //     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    //   )
    //   const channel = supabase
    //     .channel(`client-command-center-${clientId}`)
    //     .on('postgres_changes', {
    //       event: '*', schema: 'public',
    //       table: 'extracted_fields',
    //       filter: `client_id=eq.${clientId}`,
    //     }, (payload) => {
    //       // Update formBlocks based on payload
    //       console.log('Realtime update:', payload)
    //     })
    //     .on('postgres_changes', {
    //       event: '*', schema: 'public',
    //       table: 'package_checklist',
    //       filter: `application_id=eq.${client.applicationId}`,
    //     }, (payload) => {
    //       // Sync assembly item checked/attached state
    //       console.log('Checklist update:', payload)
    //     })
    //     .subscribe()
    //   return () => { supabase.removeChannel(channel) }
    // }, [clientId])

    const [dotVisible, setDotVisible] = useState(true)
    useEffect(() => {
        const id = setInterval(() => setDotVisible(v => !v), 900)
        return () => clearInterval(id)
    }, [])

    // ── COMPUTED ───────────────────────────────────────────
    const requiredItems = assemblyItems.filter(i => i.required)
    const checkedRequired = requiredItems.filter(i => i.checked).length
    const assemblyProgress = Math.round((checkedRequired / requiredItems.length) * 100)
    const totalChecked = assemblyItems.filter(i => i.checked).length

    const allFilesReady = assemblyItems.every(i =>
        !i.required || i.files.every(f => f.attached)
    )

    // ── ACTIONS ────────────────────────────────────────────
    function toggleItem(id: string) {
        setAssemblyItems(prev =>
            prev.map(item => item.id === id ? { ...item, checked: !item.checked } : item)
        )
        // TODO: Persist to Supabase:
        // await supabase.from('package_checklist').upsert({ application_id: client.applicationId, item_id: id, checked: !current })
    }

    function toggleFile(itemId: string, fileId: string) {
        setAssemblyItems(prev =>
            prev.map(item =>
                item.id === itemId
                    ? { ...item, files: item.files.map(f => f.id === fileId ? { ...f, attached: !f.attached } : f) }
                    : item
            )
        )
    }

    function handleMarkSent() {
        if (!trackingInput.trim()) return
        setPackageStatus('sent')
        setShowTrackingField(false)
        // TODO: Persist tracking number + status:
        // await supabase.from('i485_applications')
        //   .update({ status: 'filed', tracking_number: trackingInput, filed_at: new Date().toISOString() })
        //   .eq('id', client.applicationId)
    }

    // ── DISPATCH BUTTON CONFIGS ───────────────────────────
    const dispatchSteps: {
        key: PackageStatus
        from: PackageStatus
        label: string
        activeLabel: string
        emoji: string
        style: (active: boolean, done: boolean) => React.CSSProperties
    }[] = [
            {
                key: 'approved',
                from: 'draft',
                label: 'Aprovar Revisão',
                activeLabel: 'Revisão Aprovada',
                emoji: '✅',
                style: (active, done) => ({
                    background: done ? '#dcfce7' : active ? '#fff' : '#f8fafc',
                    color: done ? '#166534' : active ? '#0f172a' : '#94a3b8',
                    border: `1.5px solid ${done ? '#86efac' : active ? '#d1d5db' : '#e2e8f0'}`,
                    cursor: active ? 'pointer' : 'default',
                    boxShadow: active ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                }),
            },
            {
                key: 'printing',
                from: 'approved',
                label: '🖨️ Autorizar Impressão do Pacote',
                activeLabel: '⏳ Pacote em Impressão...',
                emoji: '🖨️',
                style: (active, done) => ({
                    background: done
                        ? '#fef3c7'
                        : active
                            ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
                            : '#f8fafc',
                    color: done ? '#92400e' : active ? '#fff' : '#94a3b8',
                    border: 'none',
                    cursor: active ? 'pointer' : 'default',
                    boxShadow: active ? '0 4px 14px rgba(34,197,94,0.35)' : 'none',
                }),
            },
        ]

    // ── RENDER ─────────────────────────────────────────────
    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'Inter, system-ui, sans-serif' }}>
            <style>{`
                @keyframes liveDot {
                    0%, 100% { opacity: 1; transform: scale(1.1); }
                    50% { opacity: 0.2; transform: scale(0.75); }
                }
                @keyframes aiShimmer {
                    0% { background-position: -300% 0; }
                    100% { background-position: 300% 0; }
                }
                .ai-shimmer {
                    background: linear-gradient(90deg, #f0fdf4 25%, #bbf7d0 50%, #f0fdf4 75%);
                    background-size: 300% 100%;
                    animation: aiShimmer 2.2s ease-in-out infinite;
                }
                .assembly-row { transition: background 0.18s ease; }
                .assembly-row:hover { background: #fafafa !important; }
                .dispatch-btn { transition: all 0.18s ease; }
                .dispatch-btn:hover:not(:disabled) { filter: brightness(1.06); transform: translateY(-1px); }
                .file-tag { transition: background 0.15s; }
            `}</style>

            {/* ════════════════════════════════════════════════════
                TOP NAV
            ════════════════════════════════════════════════════ */}
            <nav style={{
                position: 'sticky', top: 0, zIndex: 100,
                background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)',
                borderBottom: '1px solid #e2e8f0',
                height: 52, display: 'flex', alignItems: 'center',
                padding: '0 28px', gap: 16,
            }}>
                <button
                    onClick={() => router.push('/admin')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#64748b', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5, padding: '4px 0' }}
                >
                    ← Painel Admin
                </button>
                <span style={{ color: '#e2e8f0', fontSize: 16 }}>|</span>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>Clientes</span>
                <span style={{ color: '#e2e8f0', fontSize: 12 }}>/</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                    {client.full_name}
                </span>

                {/* Live badge */}
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: '#22c55e',
                        animation: 'liveDot 1.1s ease-in-out infinite',
                        opacity: dotVisible ? 1 : 0.25,
                    }} />
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#22c55e', letterSpacing: '0.02em' }}>
                        🟢 Monitoramento Ativo
                    </span>
                </div>
            </nav>

            <div style={{ maxWidth: 1380, margin: '0 auto', padding: '22px 24px 100px' }}>

                {/* ════════════════════════════════════════════════════
                    SECTION 1 — CLIENT HEADER
                ════════════════════════════════════════════════════ */}
                <div style={{
                    background: '#fff', borderRadius: 18,
                    border: '1px solid #e2e8f0',
                    padding: '22px 28px', marginBottom: 20,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
                        {/* Avatar */}
                        <div style={{
                            width: 58, height: 58, borderRadius: 16, flexShrink: 0,
                            background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontSize: 20, fontWeight: 900, letterSpacing: '-0.5px',
                        }}>
                            {client.full_name.split(' ').slice(0, 2).map(n => n[0]).join('')}
                        </div>

                        {/* Info block */}
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                                <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.3px' }}>
                                    {client.full_name}
                                </h1>
                                <span style={{ fontSize: 11, fontWeight: 800, background: '#dcfce7', color: '#166534', padding: '3px 10px', borderRadius: 20 }}>
                                    I-485 Ativo
                                </span>
                                <span style={{ fontSize: 11, fontWeight: 800, background: '#e0f2fe', color: '#0369a1', padding: '3px 10px', borderRadius: 20 }}>
                                    {client.dependents.length} Dependente{client.dependents.length !== 1 ? 's' : ''}
                                </span>
                            </div>

                            <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', marginBottom: 10 }}>
                                <span style={{ fontSize: 13, color: '#64748b' }}>✉️ {client.email}</span>
                                <span style={{ fontSize: 13, color: '#64748b' }}>
                                    🗂️ Case: <strong style={{ color: '#0f172a' }}>{client.caseId}</strong>
                                </span>
                                <span style={{ fontSize: 13, color: '#64748b' }}>
                                    ID: <code style={{ fontSize: 11, background: '#f1f5f9', padding: '1px 6px', borderRadius: 4 }}>
                                        {clientId.split('-')[0]}...
                                    </code>
                                </span>
                            </div>

                            {/* Dependents chips */}
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {client.dependents.map(dep => (
                                    <span key={dep.id} style={{
                                        fontSize: 11, background: '#f8fafc',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: 20, padding: '3px 10px', color: '#475569',
                                        display: 'flex', alignItems: 'center', gap: 4,
                                    }}>
                                        {dep.relationship === 'Cônjuge' ? '💑' : '👶'} {dep.name}
                                        <span style={{ color: '#94a3b8' }}>· {dep.relationship}</span>
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Progress gauges */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 210 }}>
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Preenchimento I-485
                                    </span>
                                    <span style={{ fontSize: 14, fontWeight: 900, color: '#22c55e' }}>
                                        {client.fillProgress}%
                                    </span>
                                </div>
                                <div style={{ height: 8, background: '#e2e8f0', borderRadius: 99 }}>
                                    <div style={{
                                        height: '100%', borderRadius: 99,
                                        width: `${client.fillProgress}%`,
                                        background: 'linear-gradient(90deg, #22c55e, #4ade80)',
                                        transition: 'width 0.6s ease',
                                    }} />
                                </div>
                            </div>
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Pacote Físico
                                    </span>
                                    <span style={{ fontSize: 14, fontWeight: 900, color: assemblyProgress === 100 ? '#22c55e' : '#0f172a' }}>
                                        {assemblyProgress}%
                                    </span>
                                </div>
                                <div style={{ height: 8, background: '#e2e8f0', borderRadius: 99 }}>
                                    <div style={{
                                        height: '100%', borderRadius: 99,
                                        width: `${assemblyProgress}%`,
                                        background: assemblyProgress === 100
                                            ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                                            : 'linear-gradient(90deg, #0f172a, #334155)',
                                        transition: 'width 0.6s ease',
                                    }} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ════════════════════════════════════════════════════
                    MAIN GRID: LEFT | RIGHT
                ════════════════════════════════════════════════════ */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 410px', gap: 20, alignItems: 'start' }}>

                    {/* ── LEFT COLUMN ── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                        {/* ════════════════════════════════════════════════
                            SECTION 2 — AI ENGINE & USCIS PREVIEW
                        ════════════════════════════════════════════════ */}
                        <div style={{
                            background: '#fff', borderRadius: 18,
                            border: '1px solid #e2e8f0',
                            padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                                <span style={{ fontSize: 20 }}>⚙️</span>
                                <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
                                    Motor de IA — Extração de Documentos
                                </h2>
                                {client.aiStatus === 'processing' && (
                                    <span style={{
                                        marginLeft: 'auto', fontSize: 10, fontWeight: 800,
                                        background: '#fef3c7', color: '#92400e',
                                        padding: '3px 9px', borderRadius: 20,
                                    }}>
                                        ⏳ Processando
                                    </span>
                                )}
                                {client.aiStatus === 'completed' && (
                                    <span style={{
                                        marginLeft: 'auto', fontSize: 10, fontWeight: 800,
                                        background: '#dcfce7', color: '#166534',
                                        padding: '3px 9px', borderRadius: 20,
                                    }}>
                                        ✅ Concluído
                                    </span>
                                )}
                                {client.aiStatus === 'error' && (
                                    <span style={{
                                        marginLeft: 'auto', fontSize: 10, fontWeight: 800,
                                        background: '#fef2f2', color: '#991b1b',
                                        padding: '3px 9px', borderRadius: 20,
                                    }}>
                                        ⚠️ Erro
                                    </span>
                                )}
                            </div>

                            {/* Processing shimmer bar */}
                            {client.aiStatus === 'processing' && (
                                <div className="ai-shimmer" style={{
                                    borderRadius: 10, padding: '13px 16px',
                                    border: '1px solid #bbf7d0', marginBottom: 14,
                                }}>
                                    <div style={{ fontSize: 11, fontWeight: 800, color: '#166534', marginBottom: 3 }}>
                                        🔄 Claude está processando documentos…
                                    </div>
                                    <div style={{ fontSize: 13, color: '#15803d', fontWeight: 500 }}>
                                        {client.aiProcessingStep}
                                    </div>
                                </div>
                            )}

                            {/* Last document processed */}
                            <div style={{
                                background: '#f8fafc', border: '1px solid #f1f5f9',
                                borderRadius: 10, padding: '12px 15px',
                                display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18,
                            }}>
                                <span style={{ fontSize: 22 }}>📄</span>
                                <div>
                                    <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
                                        Último Documento Processado
                                    </div>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                                        {client.lastDocumentProcessed}
                                    </div>
                                </div>
                            </div>

                            {/* Action buttons */}
                            <div style={{ display: 'flex', gap: 10 }}>
                                <button
                                    onClick={() => setShowPreview(true)}
                                    style={{
                                        flex: 1, padding: '13px 18px', borderRadius: 11,
                                        background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                                        color: '#fff', border: 'none', cursor: 'pointer',
                                        fontSize: 13, fontWeight: 800,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                                        boxShadow: '0 4px 14px rgba(34,197,94,0.3)',
                                        letterSpacing: '-0.1px',
                                    }}>
                                    👁️ Visualizar I-485 (Modelo USCIS)
                                </button>
                                <button style={{
                                    padding: '13px 16px', borderRadius: 11,
                                    background: '#f8fafc', color: '#475569',
                                    border: '1px solid #e2e8f0', cursor: 'pointer',
                                    fontSize: 13, fontWeight: 600,
                                    display: 'flex', alignItems: 'center', gap: 6,
                                }}>
                                    🔄 Re-processar
                                </button>
                            </div>
                        </div>

                        {/* ════════════════════════════════════════════════
                            SECTION 3 — FORM DATA TIMELINE
                        ════════════════════════════════════════════════ */}
                        <div style={{
                            background: '#fff', borderRadius: 18,
                            border: '1px solid #e2e8f0',
                            padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                                <span style={{ fontSize: 20 }}>🚀</span>
                                <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
                                    Timeline de Dados do Formulário
                                </h2>
                                <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94a3b8' }}>
                                    {formBlocks.filter(b => b.status === 'extracted').length}/{formBlocks.length} blocos completos
                                </span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                                {formBlocks.map((block, i) => {
                                    const dotColor = block.status === 'extracted'
                                        ? '#22c55e'
                                        : block.status === 'review'
                                            ? '#fbbf24'
                                            : '#cbd5e1'
                                    const lineColor = block.status === 'extracted' ? '#86efac' : '#e2e8f0'
                                    const pct = Math.round((block.fieldsExtracted / block.fieldsTotal) * 100)

                                    return (
                                        <div key={block.id} style={{ display: 'flex', gap: 0, paddingBottom: i < formBlocks.length - 1 ? 0 : 0 }}>
                                            {/* Timeline spine */}
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 28, flexShrink: 0 }}>
                                                <div style={{
                                                    width: 14, height: 14, borderRadius: '50%', marginTop: 16,
                                                    background: dotColor,
                                                    border: '2.5px solid #fff',
                                                    boxShadow: `0 0 0 2px ${dotColor}60`,
                                                    flexShrink: 0,
                                                }} />
                                                {i < formBlocks.length - 1 && (
                                                    <div style={{ flex: 1, width: 2, background: lineColor, minHeight: 20 }} />
                                                )}
                                            </div>

                                            {/* Content card */}
                                            <div style={{
                                                flex: 1, marginLeft: 12,
                                                marginBottom: i < formBlocks.length - 1 ? 10 : 0,
                                                background: '#f8fafc', borderRadius: 12,
                                                border: '1px solid #f1f5f9',
                                                padding: '13px 16px',
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <span style={{ fontSize: 18 }}>{block.emoji}</span>
                                                        <span style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>
                                                            {block.title}
                                                        </span>
                                                    </div>
                                                    <StatusPill status={block.status} />
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                    <div style={{ flex: 1, height: 5, background: '#e2e8f0', borderRadius: 99 }}>
                                                        <div style={{
                                                            height: '100%', borderRadius: 99,
                                                            width: `${pct}%`,
                                                            background: dotColor,
                                                            transition: 'width 0.4s ease',
                                                        }} />
                                                    </div>
                                                    <span style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', fontWeight: 600 }}>
                                                        {block.fieldsExtracted}/{block.fieldsTotal} campos
                                                    </span>
                                                </div>
                                                {block.lastUpdated && (
                                                    <div style={{ marginTop: 6, fontSize: 10, color: '#94a3b8' }}>
                                                        Atualizado em {block.lastUpdated}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    {/* ── RIGHT COLUMN — ASSEMBLY LINE ── */}
                    <div style={{ position: 'sticky', top: 62 }}>
                        <div style={{
                            background: '#fff', borderRadius: 18,
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 6px 24px rgba(0,0,0,0.08)',
                            overflow: 'hidden',
                            display: 'flex', flexDirection: 'column',
                        }}>
                            {/* ════════════════════════════════════════════════
                                SECTION 4 — ASSEMBLY HEADER
                            ════════════════════════════════════════════════ */}
                            <div style={{
                                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                                padding: '18px 22px 16px',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                                    <span style={{ fontSize: 24, lineHeight: 1 }}>🖨️</span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 14, fontWeight: 900, color: '#f1f5f9', letterSpacing: '-0.2px' }}>
                                            Esteira de Montagem
                                        </div>
                                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                                            Pacote Físico I-485 · Ordem exata USCIS
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: 24, fontWeight: 900, color: '#22c55e', lineHeight: 1 }}>
                                            {assemblyProgress}%
                                        </div>
                                        <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>montado</div>
                                    </div>
                                </div>

                                {/* Assembly progress bar */}
                                <div style={{ height: 5, background: '#334155', borderRadius: 99 }}>
                                    <div style={{
                                        height: '100%', borderRadius: 99,
                                        width: `${assemblyProgress}%`,
                                        background: 'linear-gradient(90deg, #22c55e, #4ade80)',
                                        transition: 'width 0.5s ease',
                                    }} />
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                                    <span style={{ fontSize: 10, color: '#64748b' }}>
                                        {totalChecked} de {assemblyItems.length} itens verificados
                                    </span>
                                    {!allFilesReady && (
                                        <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700 }}>
                                            ⚠️ Arquivos pendentes
                                        </span>
                                    )}
                                    {allFilesReady && (
                                        <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 700 }}>
                                            ✅ Todos os arquivos anexados
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* ════════════════════════════════════════════════
                                ASSEMBLY ITEMS LIST
                            ════════════════════════════════════════════════ */}
                            <div style={{ maxHeight: 470, overflowY: 'auto', padding: '8px 0' }}>
                                {assemblyItems.map((item, index) => (
                                    <div
                                        key={item.id}
                                        className="assembly-row"
                                        style={{
                                            padding: '11px 18px',
                                            borderBottom: index < assemblyItems.length - 1
                                                ? '1px solid #f1f5f9' : 'none',
                                            background: item.checked ? '#f0fdf4' : '#fff',
                                        }}
                                    >
                                        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                            {/* Order badge */}
                                            <div style={{
                                                width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 2,
                                                background: item.checked ? '#22c55e' : '#f1f5f9',
                                                color: item.checked ? '#fff' : '#94a3b8',
                                                fontSize: 10, fontWeight: 900,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            }}>
                                                {item.checked ? '✓' : item.order}
                                            </div>

                                            {/* Content */}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginBottom: 2 }}>
                                                    <span style={{ fontSize: 15 }}>{item.emoji}</span>
                                                    <span style={{
                                                        fontSize: 12, fontWeight: 800,
                                                        color: item.checked ? '#166534' : '#0f172a',
                                                    }}>
                                                        {item.title}
                                                    </span>
                                                    {!item.required && (
                                                        <span style={{ fontSize: 9, fontWeight: 800, background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: 99 }}>
                                                            Opcional
                                                        </span>
                                                    )}
                                                    {item.supportsMultiple && (
                                                        <span style={{ fontSize: 9, fontWeight: 800, background: '#e0f2fe', color: '#0369a1', padding: '1px 6px', borderRadius: 99 }}>
                                                            Múltiplos
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: 10, color: '#64748b', marginBottom: 7, lineHeight: 1.4 }}>
                                                    {item.description}
                                                </div>

                                                {/* Files */}
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                                    {item.files.map(file => (
                                                        <div
                                                            key={file.id}
                                                            className="file-tag"
                                                            style={{
                                                                display: 'flex', alignItems: 'center', gap: 6,
                                                                background: file.attached ? '#f0fdf4' : '#fef2f2',
                                                                border: `1px solid ${file.attached ? '#bbf7d0' : '#fecaca'}`,
                                                                borderRadius: 6, padding: '3px 8px',
                                                            }}
                                                        >
                                                            <span style={{ fontSize: 10, flexShrink: 0 }}>
                                                                {file.attached ? '✅' : '❌'}
                                                            </span>
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b' }}>
                                                                    {file.label}
                                                                </div>
                                                                <div style={{
                                                                    fontSize: 10, color: '#475569',
                                                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                                }}>
                                                                    {file.fileName}
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => toggleFile(item.id, file.id)}
                                                                style={{
                                                                    fontSize: 9, fontWeight: 800,
                                                                    color: file.attached ? '#16a34a' : '#dc2626',
                                                                    background: 'none', border: 'none',
                                                                    cursor: 'pointer', padding: '1px 4px',
                                                                    whiteSpace: 'nowrap', flexShrink: 0,
                                                                }}
                                                            >
                                                                {file.attached ? 'Ver' : 'Anexar'}
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Checkbox */}
                                            <div
                                                onClick={() => toggleItem(item.id)}
                                                style={{
                                                    width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 2,
                                                    border: `2px solid ${item.checked ? '#22c55e' : '#d1d5db'}`,
                                                    background: item.checked ? '#22c55e' : '#fff',
                                                    cursor: 'pointer',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    color: '#fff', fontSize: 12, fontWeight: 900,
                                                    transition: 'all 0.15s ease',
                                                    userSelect: 'none',
                                                }}
                                            >
                                                {item.checked && '✓'}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* ════════════════════════════════════════════════
                                SECTION 5 — DISPATCH ACTIONS (Sticky Footer)
                            ════════════════════════════════════════════════ */}
                            <div style={{
                                background: '#f8fafc', borderTop: '1px solid #e2e8f0',
                                padding: '15px 18px',
                            }}>
                                <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                                    Ações de Despacho
                                </div>

                                {/* Status trail */}
                                {packageStatus === 'sent' && (
                                    <div style={{
                                        background: '#eff6ff', border: '1px solid #bfdbfe',
                                        borderRadius: 8, padding: '8px 12px', marginBottom: 10,
                                        fontSize: 12, color: '#1d4ed8', fontWeight: 600,
                                    }}>
                                        ✈️ Enviado — Tracking: <strong>{trackingInput}</strong>
                                    </div>
                                )}

                                {/* Step 1: Approve */}
                                <button
                                    className="dispatch-btn"
                                    disabled={packageStatus !== 'draft'}
                                    onClick={() => setPackageStatus('approved')}
                                    style={{
                                        width: '100%', padding: '11px 14px', borderRadius: 10,
                                        fontSize: 12, fontWeight: 800, marginBottom: 8,
                                        textAlign: 'left', display: 'flex', alignItems: 'center', gap: 7,
                                        ...{
                                            draft: {
                                                background: '#fff', color: '#0f172a',
                                                border: '1.5px solid #d1d5db', cursor: 'pointer',
                                                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                                            },
                                            approved: {
                                                background: '#dcfce7', color: '#166534',
                                                border: '1.5px solid #86efac', cursor: 'default',
                                            },
                                            printing: {
                                                background: '#dcfce7', color: '#166534',
                                                border: '1.5px solid #86efac', cursor: 'default',
                                            },
                                            sent: {
                                                background: '#dcfce7', color: '#166534',
                                                border: '1.5px solid #86efac', cursor: 'default',
                                            },
                                        }[packageStatus],
                                    }}
                                >
                                    ✅{' '}
                                    {packageStatus === 'draft' ? 'Aprovar Revisão' : 'Revisão Aprovada'}
                                </button>

                                {/* Step 2: Print */}
                                <button
                                    className="dispatch-btn"
                                    disabled={packageStatus !== 'approved'}
                                    onClick={() => setPackageStatus('printing')}
                                    style={{
                                        width: '100%', padding: '11px 14px', borderRadius: 10,
                                        fontSize: 12, fontWeight: 800, marginBottom: 8,
                                        textAlign: 'left', display: 'flex', alignItems: 'center', gap: 7,
                                        border: 'none',
                                        ...{
                                            draft: {
                                                background: '#f8fafc', color: '#94a3b8', cursor: 'default',
                                            },
                                            approved: {
                                                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                                                color: '#fff', cursor: 'pointer',
                                                boxShadow: '0 4px 14px rgba(34,197,94,0.35)',
                                            },
                                            printing: {
                                                background: '#fef3c7', color: '#92400e', cursor: 'default',
                                            },
                                            sent: {
                                                background: '#fef3c7', color: '#92400e', cursor: 'default',
                                            },
                                        }[packageStatus],
                                    }}
                                >
                                    🖨️{' '}
                                    {packageStatus === 'printing' || packageStatus === 'sent'
                                        ? '⏳ Pacote em Impressão...'
                                        : 'Autorizar Impressão do Pacote'}
                                </button>

                                {/* Step 3: Mark sent */}
                                {!showTrackingField && packageStatus !== 'sent' && (
                                    <button
                                        className="dispatch-btn"
                                        disabled={packageStatus !== 'printing'}
                                        onClick={() => setShowTrackingField(true)}
                                        style={{
                                            width: '100%', padding: '11px 14px', borderRadius: 10,
                                            fontSize: 12, fontWeight: 800, border: 'none',
                                            textAlign: 'left', display: 'flex', alignItems: 'center', gap: 7,
                                            ...{
                                                draft: { background: '#f8fafc', color: '#94a3b8', cursor: 'default' },
                                                approved: { background: '#f8fafc', color: '#94a3b8', cursor: 'default' },
                                                printing: {
                                                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                                                    color: '#fff', cursor: 'pointer',
                                                    boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
                                                },
                                                sent: { background: '#eff6ff', color: '#1d4ed8', cursor: 'default' },
                                            }[packageStatus],
                                        }}
                                    >
                                        ✈️ Marcar como Enviado (Tracking)
                                    </button>
                                )}

                                {/* Tracking input */}
                                {showTrackingField && packageStatus === 'printing' && (
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <input
                                            autoFocus
                                            value={trackingInput}
                                            onChange={e => setTrackingInput(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleMarkSent()}
                                            placeholder="Ex: 1Z999AA10123456784"
                                            style={{
                                                flex: 1, padding: '10px 12px',
                                                border: '1.5px solid #2563eb',
                                                borderRadius: 10, fontSize: 12, fontWeight: 500,
                                                outline: 'none', boxShadow: '0 0 0 3px rgba(37,99,235,0.1)',
                                            }}
                                        />
                                        <button
                                            onClick={handleMarkSent}
                                            disabled={!trackingInput.trim()}
                                            style={{
                                                padding: '10px 14px', borderRadius: 10,
                                                background: trackingInput.trim() ? '#2563eb' : '#e2e8f0',
                                                color: trackingInput.trim() ? '#fff' : '#94a3b8',
                                                border: 'none', cursor: trackingInput.trim() ? 'pointer' : 'default',
                                                fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap',
                                            }}
                                        >
                                            ✈️ Confirmar
                                        </button>
                                    </div>
                                )}

                                {packageStatus === 'sent' && (
                                    <div style={{
                                        width: '100%', padding: '11px 14px', borderRadius: 10,
                                        background: '#eff6ff', color: '#1d4ed8',
                                        border: '1.5px solid #bfdbfe',
                                        fontSize: 12, fontWeight: 800,
                                        display: 'flex', alignItems: 'center', gap: 7,
                                    }}>
                                        ✈️ Enviado ao USCIS
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ════════════════════════════════════════════════════
                PDF PREVIEW MODAL
            ════════════════════════════════════════════════════ */}
            {showPreview && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)',
                    zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 40,
                }}>
                    <div style={{
                        background: '#fff', borderRadius: 24, width: '100%', maxWidth: 1000, height: '100%',
                        display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 48px rgba(0,0,0,0.2)'
                    }}>
                        <div style={{
                            padding: '16px 24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>📄 Visualização Dinâmica do I-485</h3>
                                <p style={{ margin: 0, fontSize: 12, color: '#64748b', marginTop: 2 }}>Os dados extraídos da IA já estão injetados neste modelo fiscal do USCIS.</p>
                            </div>
                            <button
                                onClick={() => setShowPreview(false)}
                                style={{
                                    background: '#e2e8f0', border: 'none', color: '#475569', width: 32, height: 32,
                                    borderRadius: '50%', cursor: 'pointer', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = '#cbd5e1'}
                                onMouseLeave={e => e.currentTarget.style.background = '#e2e8f0'}
                            >
                                ✕
                            </button>
                        </div>
                        <div style={{ flex: 1, background: '#e2e8f0', position: 'relative' }}>
                            {/* Componente real consumirá a rota em PDF. Provisório injetando mock */}
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
                                <div className="ai-shimmer" style={{ width: 64, height: 64, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>🤖</div>
                                <h4 style={{ margin: 0, color: '#0f172a', fontWeight: 800 }}>Renderizando o formulário...</h4>
                                <p style={{ margin: 0, color: '#64748b', fontSize: 14, textAlign: 'center', maxWidth: 400 }}>A Plataforma irá compilar os dados do cliente <strong>{client.full_name}</strong> diretamente nos campos interativos do i485_draft_v2.pdf em tempo real.</p>
                            </div>
                        </div>
                        <div style={{ padding: '16px 24px', background: '#fff', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                            <button onClick={() => setShowPreview(false)} style={{ padding: '10px 20px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, color: '#475569', fontWeight: 700, cursor: 'pointer' }}>Fechar</button>
                            <button style={{ padding: '10px 20px', background: '#2563eb', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center' }}>
                                <span>📥</span> Baixar Draft PDF
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

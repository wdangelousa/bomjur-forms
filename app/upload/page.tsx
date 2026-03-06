// Substitua todo o código por:
// app/upload/page.tsx

'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { FileText, CheckCircle, UploadCloud, AlertTriangle, ShieldCheck, Loader2, Eye } from 'lucide-react';
import { DocumentRequirement, ScreeningAnswers } from '@/types/i485-schema';
import Link from 'next/link';

// --- CONFIGURAÇÃO DE REGRAS DE NEGÓCIO (PROEXPAND) ---
const DOCS_CONFIG: DocumentRequirement[] = [
    // 1. Documentos Pessoais Básicos
    { id: 'passport', label: 'Passaportes (Atual e Anteriores)', description: 'Inclua cópias de todos os vistos usados (B1/B2, F1, etc).', category: 'personal', required: true, multiple: true },
    { id: 'visa_i94', label: 'Visto Atual + I-94 Recente', category: 'personal', required: true },
    { id: 'birth_cert', label: 'Certidão de Nascimento', description: 'Obrigatório: Inteiro teor digitada + Tradução.', category: 'personal', required: true },

    // 2. Documentos Condicionais (Dependentes da Triagem)
    {
        id: 'marriage_cert',
        label: 'Certidão de Casamento',
        description: 'Inteiro teor + Tradução.',
        category: 'legal',
        required: true,
        condition: (answers) => answers.isMarried
    },
    {
        id: 'divorce_decree',
        label: 'Certidão de Divórcio ou Óbito',
        description: 'Comprovante do término de casamentos anteriores.',
        category: 'legal',
        required: true,
        condition: (answers) => answers.hasPriorMarriages
    },
    {
        id: 'children_birth_certs',
        label: 'Certidões de Nascimento dos Filhos',
        description: 'De todos os filhos (mesmo se não aplicarem).',
        category: 'personal',
        required: true,
        condition: (answers) => answers.hasChildren
    },
    {
        id: 'criminal_record',
        label: 'Antecedentes Criminais',
        description: 'Certidões estaduais e federais.',
        category: 'legal',
        required: true,
        condition: (answers) => answers.hasCriminalRecord
    },

    // 3. Documentos do Processo EB-2/I-485
    { id: 'i140_receipt', label: 'Recibo/Aprovação I-140 (I-797)', description: 'Comprova a base do seu pedido.', category: 'process', required: true },
    { id: 'medical_i693', label: 'Exame Médico (Form I-693)', description: 'Cópia do formulário preenchido pelo médico civil.', category: 'process', required: true },

    // 4. Administrativo Proex
    { id: 'payment_form', label: 'Formulário de Pagamento (G-1450)', description: 'Autorização de débito assinada.', category: 'financial', required: true },
    { id: 'client_resp', label: 'Client Responsibility Notice', description: 'Documento interno Proex (Dados Bancários).', category: 'financial', required: true, isProexpandInternal: true },
];

// Tipo para os status possíveis de cada documento
type DocUploadStatus = 'idle' | 'uploading' | 'processing' | 'extracted' | 'error';

// Info do documento após criação na DB
interface DocInfo {
    documentId: string;
    status: DocUploadStatus;
    error?: string;
}

export default function UploadPage() {
    const [answers, setAnswers] = useState<ScreeningAnswers>({
        isMarried: false,
        hasChildren: false,
        hasPriorMarriages: false,
        hasCriminalRecord: false,
    });

    // Mapa de status por docId (id do DOCS_CONFIG, ex: 'passport')
    const [docStatus, setDocStatus] = useState<Record<string, DocInfo>>({});
    const supabase = createClient();
    const channelsRef = useRef<Map<string, ReturnType<typeof supabase.channel>>>(new Map());

    // Filtra documentos visíveis com base nas respostas
    const visibleDocs = DOCS_CONFIG.filter(doc => !doc.condition || doc.condition(answers));

    // ── Cleanup Realtime channels ao desmontar ───────────────────
    useEffect(() => {
        return () => {
            channelsRef.current.forEach((channel) => {
                supabase.removeChannel(channel);
            });
            channelsRef.current.clear();
        };
    }, [supabase]);

    // ── Criar subscription Realtime para um documento específico ─
    const subscribeToDocument = (dbDocumentId: string, configDocId: string) => {
        // Evitar duplicação
        if (channelsRef.current.has(dbDocumentId)) return;

        console.log(`[Upload] Criando Realtime subscription para doc ${dbDocumentId}`);

        const channel = supabase
            .channel(`doc-extraction-${dbDocumentId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'client_documents',
                    filter: `id=eq.${dbDocumentId}`,
                },
                (payload) => {
                    console.log('[Upload] Realtime UPDATE recebido:', payload.new);
                    const newStatus = (payload.new as Record<string, unknown>).extraction_status as string;

                    if (newStatus === 'completed') {
                        setDocStatus(prev => ({
                            ...prev,
                            [configDocId]: {
                                ...prev[configDocId],
                                status: 'extracted',
                            }
                        }));
                        // Limpar o canal após sucesso
                        supabase.removeChannel(channel);
                        channelsRef.current.delete(dbDocumentId);
                    } else if (newStatus === 'failed') {
                        const errorMsg = (payload.new as Record<string, unknown>).extraction_error as string;
                        setDocStatus(prev => ({
                            ...prev,
                            [configDocId]: {
                                ...prev[configDocId],
                                status: 'error',
                                error: errorMsg || 'Erro na extração',
                            }
                        }));
                        supabase.removeChannel(channel);
                        channelsRef.current.delete(dbDocumentId);
                    }
                }
            )
            .subscribe((subStatus) => {
                console.log(`[Upload] Realtime subscription status (${dbDocumentId}):`, subStatus);
            });

        channelsRef.current.set(dbDocumentId, channel);
    };

    // ── Handler de Upload — via API Route (SERVICE_ROLE_KEY) ─────
    const handleUpload = async (file: File, configDocId: string) => {
        setDocStatus(prev => ({
            ...prev,
            [configDocId]: { documentId: '', status: 'uploading' },
        }));

        try {
            // Obter o userId atual para a RLS
            const { data: { user } } = await supabase.auth.getUser();

            const formData = new FormData();
            formData.append('file', file);
            formData.append('documentCategory', configDocId);
            if (user?.id) {
                formData.append('userId', user.id);
            }

            console.log('[Upload] Enviando para API Route /api/process-document...');

            const res = await fetch('/api/process-document', {
                method: 'POST',
                body: formData,
            });

            const data = await res.json();

            if (!res.ok || !data.documentId) {
                throw new Error(data.error || 'Erro no upload');
            }

            console.log('[Upload] API Route respondeu:', data);

            // Marcar como processing e criar subscription Realtime
            setDocStatus(prev => ({
                ...prev,
                [configDocId]: {
                    documentId: data.documentId,
                    status: 'processing',
                },
            }));

            // Subscrever ao Realtime para escutar quando a extração terminar
            subscribeToDocument(data.documentId, configDocId);

        } catch (e) {
            console.error('[Upload] Erro:', e);
            setDocStatus(prev => ({
                ...prev,
                [configDocId]: {
                    documentId: '',
                    status: 'error',
                    error: e instanceof Error ? e.message : 'Erro desconhecido',
                },
            }));
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 py-10 px-4 font-sans text-slate-900">
            <div className="max-w-4xl mx-auto space-y-8 pb-20">

                {/* HEADER */}
                <header className="text-center space-y-2 mb-10">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        Preparação de Documentos para Ajuste de Status
                    </h1>
                    <p className="text-slate-500">
                        Siga o checklist inteligente abaixo para garantir que seu processo migratório esteja completo e bem documentado.
                    </p>
                </header>

                {/* SEÇÃO 1: TRIAGEM INTELIGENTE */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-blue-600" />
                        <h2 className="font-semibold text-slate-800">Definições Iniciais do Processo</h2>
                    </div>

                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Toggle
                            label="Você é casado(a) atualmente?"
                            checked={answers.isMarried}
                            onChange={v => setAnswers({ ...answers, isMarried: v })}
                        />
                        <Toggle
                            label="Você tem filhos?"
                            checked={answers.hasChildren}
                            onChange={v => setAnswers({ ...answers, hasChildren: v })}
                        />
                        <Toggle
                            label="Você ou cônjuge têm casamentos anteriores?"
                            checked={answers.hasPriorMarriages}
                            onChange={v => setAnswers({ ...answers, hasPriorMarriages: v })}
                        />
                        <Toggle
                            label="Possui algum histórico de prisão/detenção?"
                            checked={answers.hasCriminalRecord}
                            onChange={v => setAnswers({ ...answers, hasCriminalRecord: v })}
                            alert
                        />
                    </div>
                </div>

                {/* SEÇÃO 2: CHECKLIST DE DOCUMENTOS */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <FileText className="w-6 h-6 text-purple-600" />
                            Checklist de Documentos
                        </h2>
                        <span className="text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                            {visibleDocs.length} documentos requeridos
                        </span>
                    </div>

                    <div className="grid gap-3">
                        {visibleDocs.map((doc) => {
                            const info = docStatus[doc.id];
                            const status: DocUploadStatus = info?.status || 'idle';

                            return (
                                <div
                                    key={doc.id}
                                    className={`group relative bg-white border rounded-xl p-5 transition-all duration-200
                                        ${status === 'extracted' ? 'border-green-200 bg-green-50/30' : 'border-slate-200 hover:border-blue-300 hover:shadow-md'}
                                        ${status === 'processing' ? 'border-purple-300 bg-purple-50/20' : ''}
                                        ${status === 'error' ? 'border-red-200 bg-red-50/20' : ''}
                                    `}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        {/* Info do Documento */}
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`font-semibold ${status === 'extracted' ? 'text-green-800' : 'text-slate-800'}`}>
                                                    {doc.label}
                                                </span>
                                                {doc.isProexpandInternal && (
                                                    <span className="text-[10px] uppercase font-bold tracking-wider bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                                                        Interno Proex
                                                    </span>
                                                )}
                                                {status === 'extracted' && (
                                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-500 leading-relaxed">
                                                {doc.description || 'Documento obrigatório para análise.'}
                                            </p>
                                            {status === 'error' && info?.error && (
                                                <p className="text-xs text-red-600 mt-1">{info.error}</p>
                                            )}
                                        </div>

                                        {/* Ação de Upload / Status */}
                                        <div className="shrink-0 flex flex-col items-end gap-1">
                                            <input
                                                type="file"
                                                id={`file-${doc.id}`}
                                                className="hidden"
                                                accept=".pdf,.jpg,.jpeg,.png,.webp"
                                                disabled={status === 'uploading' || status === 'processing'}
                                                onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], doc.id)}
                                            />

                                            {/* Botão principal */}
                                            {(status === 'idle' || status === 'error') && (
                                                <label
                                                    htmlFor={`file-${doc.id}`}
                                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all
                                                        ${status === 'idle' ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-sm hover:shadow' : ''}
                                                        ${status === 'error' ? 'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100' : ''}
                                                    `}
                                                >
                                                    <UploadCloud className="w-4 h-4" />
                                                    {status === 'idle' ? 'Anexar' : 'Tentar Novamente'}
                                                </label>
                                            )}

                                            {status === 'uploading' && (
                                                <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-400">
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Enviando...
                                                </div>
                                            )}

                                            {status === 'processing' && (
                                                <div className="flex flex-col items-end gap-1">
                                                    <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-purple-50 text-purple-600 border border-purple-200">
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                        Processando IA...
                                                    </div>
                                                    <span className="text-xs text-purple-600 font-medium animate-pulse mt-1">
                                                        O Ben está extraindo dados...
                                                    </span>
                                                </div>
                                            )}

                                            {status === 'extracted' && (
                                                <div className="flex items-center gap-2">
                                                    <span className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium bg-white border border-green-200 text-green-700">
                                                        <CheckCircle className="w-4 h-4" />
                                                        Concluído
                                                    </span>
                                                    {info?.documentId && (
                                                        <Link
                                                            href={`/upload/review/${info.documentId}`}
                                                            className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-all"
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                            Revisar
                                                        </Link>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

            </div>
        </div>
    );
}

// Componente Toggle Reutilizável
function Toggle({ label, checked, onChange, alert }: { label: string, checked: boolean, onChange: (v: boolean) => void, alert?: boolean }) {
    return (
        <div
            onClick={() => onChange(!checked)}
            className={`
                flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all duration-200
                ${checked
                    ? (alert ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200')
                    : 'bg-white border-slate-100 hover:border-slate-300'}
            `}
        >
            <div className="flex items-center gap-3">
                {alert && checked && <AlertTriangle className="w-5 h-5 text-amber-500" />}
                <span className={`text-sm font-medium ${checked ? 'text-slate-900' : 'text-slate-600'}`}>
                    {label}
                </span>
            </div>

            <div className={`
                w-12 h-7 rounded-full p-1 transition-colors duration-200 ease-in-out relative
                ${checked
                    ? (alert ? 'bg-amber-500' : 'bg-blue-600')
                    : 'bg-slate-200'}
            `}>
                <div className={`
                    w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform duration-200 ease-in-out
                    ${checked ? 'translate-x-5' : 'translate-x-0'}
                `} />
            </div>
        </div>
    );
}

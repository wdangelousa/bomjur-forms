'use client';

import { useState } from 'react';
import { createClient } from '@/src/lib/supabase/client';
import { FileText, CheckCircle, UploadCloud, AlertTriangle, ShieldCheck } from 'lucide-react';
import { DocumentRequirement, ScreeningAnswers } from '@/src/types/i485-schema';

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

export default function UploadPage() {
    const [answers, setAnswers] = useState<ScreeningAnswers>({
        isMarried: false,
        hasChildren: false,
        hasPriorMarriages: false,
        hasCriminalRecord: false,
    });

    const [uploadStatus, setUploadStatus] = useState<Record<string, 'idle' | 'uploading' | 'success' | 'error'>>({});
    const supabase = createClient();

    // Filtra documentos visíveis com base nas respostas
    const visibleDocs = DOCS_CONFIG.filter(doc => !doc.condition || doc.condition(answers));

    const handleUpload = async (file: File, docId: string) => {
        setUploadStatus(prev => ({ ...prev, [docId]: 'uploading' }));

        try {
            const filePath = `uploads/${Date.now()}_${file.name}`;

            // 1. Upload to Storage
            const { data: storageData, error: storageError } = await supabase.storage
                .from('bomjur-documents')
                .upload(filePath, file);

            if (storageError) throw storageError;

            const { data: { publicUrl } } = supabase.storage
                .from('bomjur-documents')
                .getPublicUrl(filePath)

            // 2. Registro na tabela client_documents
            const { data: docRecord, error: dbError } = await supabase
                .from('client_documents')
                .insert({
                    file_name: file.name,
                    file_path: storageData.path,
                    file_url: publicUrl,
                    file_size: file.size,
                    file_type: file.type,
                    bucket_name: 'bomjur-documents',
                    processing_status: 'pending',
                    document_category: docId,
                    uploaded_at: new Date().toISOString(),
                })
                .select('id')
                .single()

            if (dbError || !docRecord) {
                throw dbError;
            }

            // 3. Processamento via IA (Edge Function)
            setUploadStatus(prev => ({ ...prev, [docId]: 'analyzing' as any }));

            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
            const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            const edgeFnUrl = `${supabaseUrl}/functions/v1/process-document`

            try {
                const response = await fetch(edgeFnUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${supabaseAnonKey}`,
                        'apikey': supabaseAnonKey,
                    },
                    body: JSON.stringify({ documentId: docRecord.id, filePath: storageData.path }),
                })

                if (!response.ok) {
                    console.warn(`Análise falhou com status ${response.status}`);
                    setUploadStatus(prev => ({ ...prev, [docId]: 'error' }));
                } else {
                    // Simulando o delay de polling simplificado / ou set direto.
                    setUploadStatus(prev => ({ ...prev, [docId]: 'success' }));
                }
            } catch (err) {
                console.error('Edge Function call falhou', err)
                setUploadStatus(prev => ({ ...prev, [docId]: 'error' }));
            }

        } catch (e) {
            console.error(e);
            setUploadStatus(prev => ({ ...prev, [docId]: 'error' }));
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
                            const status: any = uploadStatus[doc.id] || 'idle';

                            return (
                                <div
                                    key={doc.id}
                                    className={`group relative bg-white border rounded-xl p-5 transition-all duration-200
                    ${status === 'success' ? 'border-green-200 bg-green-50/30' : 'border-slate-200 hover:border-blue-300 hover:shadow-md'}
                    ${status === 'analyzing' ? 'border-purple-300 bg-purple-50/20' : ''}
                  `}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        {/* Info do Documento */}
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`font-semibold ${status === 'success' ? 'text-green-800' : 'text-slate-800'}`}>
                                                    {doc.label}
                                                </span>
                                                {doc.isProexpandInternal && (
                                                    <span className="text-[10px] uppercase font-bold tracking-wider bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                                                        Interno Proex
                                                    </span>
                                                )}
                                                {status === 'success' && (
                                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-500 leading-relaxed">
                                                {doc.description || 'Documento obrigatório para análise.'}
                                            </p>
                                        </div>

                                        {/* Ação de Upload */}
                                        <div className="shrink-0 flex flex-col items-end gap-1">
                                            <input
                                                type="file"
                                                id={`file-${doc.id}`}
                                                className="hidden"
                                                disabled={status === 'uploading' || status === 'analyzing' || status === 'success'}
                                                onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], doc.id)}
                                            />
                                            <label
                                                htmlFor={`file-${doc.id}`}
                                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all
                          ${status === 'idle' ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-sm hover:shadow' : ''}
                          ${status === 'uploading' || status === 'analyzing' ? 'bg-slate-100 text-slate-400 cursor-wait' : ''}
                          ${status === 'success' ? 'bg-white border border-green-200 text-green-700 cursor-default' : ''}
                          ${status === 'error' ? 'bg-red-50 text-red-600 border border-red-100' : ''}
                        `}
                                            >
                                                {status === 'idle' && <><UploadCloud className="w-4 h-4" /> Anexar</>}
                                                {status === 'uploading' && 'Enviando...'}
                                                {status === 'analyzing' && 'Processando IA...'}
                                                {status === 'success' && 'Concluído'}
                                                {status === 'error' && 'Tentar Novamente'}
                                            </label>
                                            {status === 'analyzing' && (
                                                <span className="text-xs text-purple-600 font-medium animate-pulse mt-1">Extraindo dados...</span>
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

// Componente Toggle Reutilizável com Design Moderno
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

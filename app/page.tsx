'use client';
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

type StepStatus = 'idle' | 'loading' | 'ok' | 'error';

interface Steps {
    upload: StepStatus;
    database: StepStatus;
    ai: StepStatus;
    aiError: string;
}

export default function UploadPage() {
    const [file, setFile] = useState<File | null>(null);
    const [steps, setSteps] = useState<Steps>({ upload: 'idle', database: 'idle', ai: 'idle', aiError: '' });
    const [done, setDone] = useState(false);

    const setStep = (step: keyof Omit<Steps, 'aiError'>, status: StepStatus, aiErr = '') => {
        setSteps(prev => ({ ...prev, [step]: status, aiError: aiErr || prev.aiError }));
    };

    const handleUpload = async () => {
        if (!file) return;
        setDone(false);
        setSteps({ upload: 'loading', database: 'idle', ai: 'idle', aiError: '' });

        // ── 1. Upload para o Storage ──────────────────────────────────────
        const fileExt = file.name.split('.').pop();
        const filePath = `${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from('bomjur-documents')
            .upload(filePath, file);

        if (uploadError) {
            setStep('upload', 'error');
            return;
        }
        setStep('upload', 'ok');

        // ── 2. Registro no banco ──────────────────────────────────────────
        setStep('database', 'loading');
        const { data: docData, error: dbError } = await supabase
            .from('client_documents')
            .insert([{
                file_name: file.name,
                file_path: filePath,
                file_size: file.size,
                mime_type: file.type || 'application/octet-stream',
                extraction_status: 'pending',
            }])
            .select('id')
            .single();

        if (dbError) {
            setStep('database', 'error');
            return;
        }
        setStep('database', 'ok');

        // ── 3. Análise com IA ─────────────────────────────────────────────
        setStep('ai', 'loading');
        const { data: fnData, error: fnError } = await supabase.functions.invoke('process-document', {
            body: { documentId: docData.id, filePath }
        });

        if (fnError) {
            // Tenta extrair a mensagem de erro real da Edge Function
            const detail = (fnData as Record<string, string>)?.error || fnError.message;
            setStep('ai', 'error', detail);
        } else {
            setStep('ai', 'ok');
        }
        setDone(true);
    };

    const stepLabel = (status: StepStatus, label: string, detail?: string) => {
        const icons: Record<StepStatus, string> = { idle: '○', loading: '⟳', ok: '✓', error: '✕' };
        const colors: Record<StepStatus, string> = {
            idle: '#94a3b8', loading: '#6366f1', ok: '#10b981', error: '#ef4444'
        };
        return (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                <span style={{
                    fontSize: 18, color: colors[status], minWidth: 20, lineHeight: '22px',
                    animation: status === 'loading' ? 'spin 1s linear infinite' : 'none'
                }}>
                    {icons[status]}
                </span>
                <div>
                    <span style={{ color: colors[status], fontWeight: 600, fontSize: 14 }}>{label}</span>
                    {detail && status === 'error' && (
                        <p style={{ fontSize: 12, color: '#ef4444', margin: '4px 0 0', maxWidth: 400 }}>
                            ⚠️ {detail}
                        </p>
                    )}
                </div>
            </div>
        );
    };

    const anyActive = Object.values(steps).some(v => v === 'loading');

    return (
        <div style={{
            padding: '40px', maxWidth: '600px', margin: '40px auto',
            fontFamily: 'sans-serif', backgroundColor: '#fff', borderRadius: '10px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>

            <h2 style={{ color: '#333', marginBottom: 8 }}>Documentos de Imigração</h2>
            <p style={{ color: '#666', marginBottom: 28, fontSize: 14 }}>
                Faça o upload do seu passaporte ou formulário. Nossa IA fará a leitura automática.
            </p>

            <div style={{
                border: '2px dashed #0070f3', borderRadius: 8, padding: '32px 40px',
                textAlign: 'center', marginBottom: 16, backgroundColor: '#f9fbfd'
            }}>
                <input type="file" onChange={e => setFile(e.target.files?.[0] ?? null)}
                    style={{ cursor: 'pointer' }} />
            </div>

            <button onClick={handleUpload} disabled={!file || anyActive}
                style={{
                    width: '100%', padding: 15, backgroundColor: anyActive ? '#93c5fd' : '#0070f3',
                    color: 'white', border: 'none', borderRadius: 8, fontSize: 16,
                    fontWeight: 'bold', cursor: file && !anyActive ? 'pointer' : 'not-allowed'
                }}>
                {anyActive ? 'Processando...' : 'Enviar e Processar'}
            </button>

            {/* ── Progresso por etapa ── */}
            {steps.upload !== 'idle' && (
                <div style={{
                    marginTop: 20, padding: '16px 20px', backgroundColor: '#f8fafc',
                    borderRadius: 8, border: '1px solid #e2e8f0'
                }}>

                    {stepLabel(steps.upload, 'Upload para o cofre seguro')}
                    {steps.database !== 'idle' && stepLabel(steps.database, 'Registro no banco de dados')}
                    {steps.ai !== 'idle' && stepLabel(steps.ai, 'Leitura inteligente com Claude AI', steps.aiError)}

                    {/* Mensagem final */}
                    {done && steps.ai === 'ok' && (
                        <p style={{ marginTop: 10, color: '#10b981', fontWeight: 700, fontSize: 14 }}>
                            ✅ Documento enviado e analisado com sucesso!
                        </p>
                    )}
                    {done && steps.ai === 'error' && steps.upload === 'ok' && (
                        <p style={{ marginTop: 10, color: '#f59e0b', fontSize: 13 }}>
                            📁 Documento salvo com sucesso. A análise com IA falhou — tente novamente em instantes.
                        </p>
                    )}
                </div>
            )}

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
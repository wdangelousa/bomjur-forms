'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type StepStatus = 'idle' | 'loading' | 'ok' | 'error';
interface Steps { upload: StepStatus; database: StepStatus; ai: StepStatus; aiError: string; }

export default function UploadPage() {
    const [file, setFile] = useState<File | null>(null);
    const [steps, setSteps] = useState<Steps>({ upload: 'idle', database: 'idle', ai: 'idle', aiError: '' });
    const [done, setDone] = useState(false);
    const router = useRouter();

    const setStep = (step: keyof Omit<Steps, 'aiError'>, status: StepStatus, aiErr = '') => {
        setSteps(prev => ({ ...prev, [step]: status, aiError: aiErr || prev.aiError }));
    };

    const handleUpload = async () => {
        if (!file) return;
        setDone(false);
        setSteps({ upload: 'loading', database: 'idle', ai: 'idle', aiError: '' });

        // 1. Upload para o Storage
        const fileExt = file.name.split('.').pop();
        const filePath = `${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('bomjur-documents').upload(filePath, file);
        if (uploadError) { setStep('upload', 'error', uploadError.message); return; }
        setStep('upload', 'ok');

        // 2. Registro no banco
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
        if (dbError) { setStep('database', 'error'); return; }
        setStep('database', 'ok');

        // 3. Dispara a Edge Function sem esperar a resposta (fire-and-forget)
        // A IA pode demorar > 10s então fazemos polling do status
        setStep('ai', 'loading');

        // Invoca de forma assíncrona (não faz await)
        supabase.functions.invoke('process-document', {
            body: { documentId: docData.id, filePath }
        }).then(({ error }) => {
            // Resolve silenciosamente — o polling cuidará do resultado
            if (error) console.warn('Edge Function async result:', error.message);
        });

        // 4. Polling: verifica o status a cada 3s por até 90s
        const docId = docData.id;
        let attempts = 0;
        const maxAttempts = 30; // 30 × 3s = 90s

        const poll = setInterval(async () => {
            attempts++;

            const { data: statusData } = await supabase
                .from('client_documents')
                .select('extraction_status, extraction_error')
                .eq('id', docId)
                .single();

            const status = statusData?.extraction_status;

            if (status === 'extracted') {
                clearInterval(poll);
                setStep('ai', 'ok');
                setDone(true);
                setTimeout(() => router.push(`/upload/review/${docId}`), 800);
                return;
            }

            if (status === 'error') {
                clearInterval(poll);
                setStep('ai', 'error', statusData?.extraction_error || 'Erro desconhecido na extração.');
                setDone(true);
                return;
            }

            if (attempts >= maxAttempts) {
                clearInterval(poll);
                setStep('ai', 'error', 'Tempo limite atingido. Por favor, tente novamente.');
                setDone(true);
            }
        }, 3000);
    };

    const stepIcon = (status: StepStatus) => {
        if (status === 'idle') return '○';
        if (status === 'ok') return '✓';
        if (status === 'error') return '✕';
        return '⟳';
    };

    const stepColor: Record<StepStatus, string> = {
        idle: '#94a3b8', loading: '#6366f1', ok: '#10b981', error: '#ef4444'
    };

    const anyActive = steps.upload === 'loading' || steps.database === 'loading' || steps.ai === 'loading';

    return (
        <div style={{
            padding: '40px', maxWidth: '600px', margin: '40px auto', fontFamily: 'sans-serif',
            backgroundColor: '#fff', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>

            <h2 style={{ color: '#333', marginBottom: 8 }}>Documentos de Imigração</h2>
            <p style={{ color: '#666', marginBottom: 28, fontSize: 14 }}>
                Faça o upload do seu passaporte ou formulário. Nossa IA fará a leitura automática.
            </p>

            <div style={{
                border: '2px dashed #0070f3', borderRadius: 8, padding: '32px 40px',
                textAlign: 'center', marginBottom: 16, backgroundColor: '#f9fbfd'
            }}>
                <input type="file" onChange={e => setFile(e.target.files?.[0] ?? null)} style={{ cursor: 'pointer' }} />
            </div>

            <button onClick={handleUpload} disabled={!file || anyActive}
                style={{
                    width: '100%', padding: 15, backgroundColor: anyActive ? '#93c5fd' : '#0070f3',
                    color: 'white', border: 'none', borderRadius: 8, fontSize: 16,
                    fontWeight: 'bold', cursor: file && !anyActive ? 'pointer' : 'not-allowed'
                }}>
                {anyActive ? 'Processando...' : 'Enviar e Processar'}
            </button>

            {steps.upload !== 'idle' && (
                <div style={{
                    marginTop: 20, padding: '16px 20px', backgroundColor: '#f8fafc',
                    borderRadius: 8, border: '1px solid #e2e8f0'
                }}>

                    {[
                        { key: 'upload', label: 'Upload para o cofre seguro', status: steps.upload },
                        { key: 'database', label: 'Registro no banco de dados', status: steps.database },
                        { key: 'ai', label: 'Leitura inteligente com Claude AI', status: steps.ai },
                    ].map(s => (
                        <div key={s.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                            <span style={{
                                fontSize: 18, color: stepColor[s.status], minWidth: 20, lineHeight: '22px',
                                animation: s.status === 'loading' ? 'spin 1s linear infinite' : 'none'
                            }}>
                                {stepIcon(s.status)}
                            </span>
                            <div>
                                <span style={{ color: stepColor[s.status], fontWeight: 600, fontSize: 14 }}>{s.label}</span>
                                {s.key === 'ai' && s.status === 'loading' && (
                                    <p style={{ fontSize: 12, color: '#6366f1', margin: '4px 0 0' }}>
                                        🕐 Aguardando resposta da IA (pode levar até 60s)...
                                    </p>
                                )}
                                {s.key === 'ai' && s.status === 'error' && steps.aiError && (
                                    <p style={{ fontSize: 12, color: '#ef4444', margin: '4px 0 0', maxWidth: 400 }}>
                                        ⚠️ {steps.aiError}
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}

                    {done && steps.ai === 'ok' && (
                        <p style={{ marginTop: 10, color: '#10b981', fontWeight: 700, fontSize: 14 }}>
                            ✅ Redirecionando para a revisão...
                        </p>
                    )}
                    {done && steps.ai === 'error' && (
                        <p style={{ marginTop: 10, color: '#f59e0b', fontSize: 13 }}>
                            📁 Documento salvo. A análise com IA falhou — tente novamente.
                        </p>
                    )}
                </div>
            )}
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
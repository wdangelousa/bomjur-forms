import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import confetti from 'canvas-confetti';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const DocumentUpload: React.FC = () => {
    const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
    const [docId, setDocId] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        if (!docId) return;

        const channel = supabase
            .channel(`doc-${docId}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'client_documents',
                filter: `id=eq.${docId}`
            }, (payload) => {
                const current = payload.new.extraction_status;
                if (current === 'extracted') {
                    setStatus('success');
                    setProgress(100);
                    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#2563eb', '#10b981', '#f59e0b'] });
                } else if (current === 'error') {
                    setStatus('error');
                }
            }).subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [docId]);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setStatus('uploading');
        setProgress(30);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/process-document', { method: 'POST', body: formData });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setDocId(data.documentId);
            setStatus('processing');
            setProgress(55);

            // 2. Acionar a Edge Function diretamente do cliente para contornar timeout de 10s do Vercel
            const { error: fnError } = await supabase.functions.invoke('process-document', {
                body: { documentId: data.documentId, filePath: data.filePath }
            });
            if (fnError) {
                console.error("Erro na Edge Function:", fnError);
                // a lógica realtime pode cobrir mas se falhar de vez devolve erro
                setStatus('error');
            }
        } catch (e) {
            console.error(e);
            setStatus('error');
        }
    };

    return (
        <div className="max-w-md mx-auto p-12 border-2 border-dashed border-blue-500 rounded-[2.5rem] bg-white shadow-2xl text-center transition-all duration-500">
            {status === 'idle' && (
                <div className="animate-in zoom-in duration-300">
                    <div className="text-7xl mb-6">🛸</div>
                    <h2 className="text-2xl font-black text-gray-900 mb-2">Pronto para o Ben analisar?</h2>
                    <p className="text-gray-500 mb-8 text-sm">O Ben fará a leitura instantânea e organizará seus dados com precisão.</p>
                    <input type="file" onChange={handleFileChange} className="hidden" id="ben-upload-input" accept=".pdf,.png,.jpg,.jpeg" />
                    <label htmlFor="ben-upload-input" className="cursor-pointer bg-blue-600 text-white px-10 py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-blue-700 active:scale-95 transition-all inline-block">
                        ENVIAR PARA O BEN
                    </label>
                </div>
            )}

            {(status === 'uploading' || status === 'processing') && (
                <div className="py-6">
                    <div className="relative w-32 h-32 mx-auto mb-8">
                        <div className="absolute inset-0 border-[6px] border-blue-50 rounded-full"></div>
                        <div className="absolute inset-0 border-[6px] border-blue-600 rounded-full border-t-transparent animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center font-black text-blue-600 text-2xl">{progress}%</div>
                    </div>
                    <h3 className="text-xl font-black text-blue-900 uppercase tracking-tighter animate-pulse">
                        {status === 'uploading' ? 'Recebendo arquivo...' : 'O Ben está lendo tudo...'}
                    </h3>
                    <p className="text-sm text-blue-400 mt-4 font-bold">Analisando seu documento para o processo de imigração.</p>
                </div>
            )}

            {status === 'success' && (
                <div className="animate-in bounce-in duration-500 text-green-600">
                    <div className="text-7xl mb-6">🎊</div>
                    <h2 className="text-3xl font-black mb-2">MISSÃO CUMPRIDA!</h2>
                    <p className="text-gray-600 font-medium mb-8">O Ben terminou a leitura. Todos os dados foram extraídos com sucesso.</p>
                    <button onClick={() => setStatus('idle')} className="text-blue-600 font-bold underline hover:text-blue-800">Enviar outro?</button>
                </div>
            )}

            {status === 'error' && (
                <div className="text-red-600 animate-in shake duration-300">
                    <div className="text-7xl mb-6">⚠️</div>
                    <h3 className="text-xl font-black uppercase tracking-tight">O Ben encontrou um obstáculo</h3>
                    <p className="text-gray-500 mt-2 text-sm">Houve um erro no processamento. Vamos tentar novamente?</p>
                    <button onClick={() => setStatus('idle')} className="mt-6 bg-red-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg">REPETIR MISSÃO</button>
                </div>
            )}
        </div>
    );
};

export default DocumentUpload;
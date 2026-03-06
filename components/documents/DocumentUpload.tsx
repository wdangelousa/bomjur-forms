import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import confetti from 'canvas-confetti';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const DocumentUpload: React.FC = () => {
    const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
    const [docId, setDocId] = useState<string | null>(null);

    useEffect(() => {
        if (!docId) return;

        // Escuta o canal de Realtime para este documento específico
        const channel = supabase.channel(`doc-${docId}`).on('postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'client_documents',
                filter: `id=eq.${docId}`
            },
            (payload) => {
                const newStatus = payload.new.extraction_status;
                if (newStatus === 'extracted') {
                    setStatus('success');
                    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
                } else if (newStatus === 'error') {
                    setStatus('error');
                }
            }).subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [docId]);

    const handleUpload = async (file: File) => {
        setStatus('processing');
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await fetch('/api/process-document', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.documentId) setDocId(data.documentId);
            else setStatus('error');
        } catch { setStatus('error'); }
    };

    return (
        <div className="max-w-md mx-auto p-12 border-2 border-dashed border-blue-500 rounded-3xl bg-white text-center shadow-xl">
            {status === 'idle' && (
                <div>
                    <div className="text-6xl mb-4">📄</div>
                    <h2 className="text-xl font-bold mb-6">Enviar para o Ben</h2>
                    <label className="cursor-pointer bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all">
                        SELECIONAR ARQUIVO
                        <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
                    </label>
                </div>
            )}

            {status === 'processing' && (
                <div className="py-4">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-blue-600 font-bold animate-pulse">O Ben está lendo o documento...</p>
                </div>
            )}

            {status === 'success' && (
                <div className="text-green-600 font-bold">
                    <div className="text-6xl mb-4">🎊</div>
                    <h2 className="text-2xl">SUCESSO!</h2>
                    <button onClick={() => setStatus('idle')} className="mt-4 text-blue-600 underline">Enviar outro?</button>
                </div>
            )}

            {status === 'error' && (
                <div className="text-red-600 font-bold">
                    <div className="text-6xl mb-4">⚠️</div>
                    <p>Erro no processamento.</p>
                    <button onClick={() => setStatus('idle')} className="mt-4 bg-red-600 text-white px-6 py-2 rounded-lg">TENTAR DE NOVO</button>
                </div>
            )}
        </div>
    );
};

export default DocumentUpload;
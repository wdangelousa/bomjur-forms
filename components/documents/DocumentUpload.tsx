// Substitua todo o código por...
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import confetti from 'canvas-confetti';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface DocumentUploadProps {
    caseId?: string;
    category?: string;
    label?: string;
    onComplete?: () => void;
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({
    caseId,
    category,
    label,
    onComplete
}) => {
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
                    if (onComplete) onComplete();
                } else if (newStatus === 'error') {
                    setStatus('error');
                }
            }).subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [docId, onComplete]);

    const handleUpload = async (file: File) => {
        setStatus('processing');
        const formData = new FormData();
        formData.append('file', file);
        if (category) formData.append('documentCategory', category);

        try {
            const res = await fetch('/api/process-document', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.documentId) {
                setDocId(data.documentId);
            } else {
                setStatus('error');
            }
        } catch {
            setStatus('error');
        }
    };

    return (
        <div className="w-full p-8 border-2 border-dashed border-slate-200 rounded-3xl bg-white text-center shadow-sm">
            {status === 'idle' && (
                <div>
                    <div className="text-4xl mb-4 text-slate-300">📄</div>
                    <h2 className="text-sm font-bold mb-1">Fazer Upload</h2>
                    <p className="text-[10px] text-slate-400 mb-6 uppercase tracking-wider font-bold">{label}</p>

                    <label className="cursor-pointer bg-sky-500 text-white px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-sky-600 transition-all inline-block active:scale-95">
                        SELECIONAR
                        <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
                    </label>
                </div>
            )}

            {status === 'processing' && (
                <div className="py-4">
                    <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-sky-600 text-xs font-bold animate-pulse">Processando documento...</p>
                </div>
            )}

            {status === 'success' && (
                <div className="text-emerald-600 font-bold py-4">
                    <div className="text-4xl mb-4">🎊</div>
                    <h2 className="text-lg">Sucesso!</h2>
                    <p className="text-[10px] uppercase text-emerald-500 font-bold">Documento Processado</p>
                </div>
            )}

            {status === 'error' && (
                <div className="text-red-500 font-bold py-4">
                    <div className="text-4xl mb-4">⚠️</div>
                    <p className="text-sm mb-4">Erro no processamento.</p>
                    <button onClick={() => setStatus('idle')} className="bg-red-500 text-white px-6 py-2 rounded-xl text-xs font-bold">TENTAR DE NOVO</button>
                </div>
            )}
        </div>
    );
};

export default DocumentUpload;
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import confetti from 'canvas-confetti';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

const DocumentUpload: React.FC = () => {
    const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
    const [docId, setDocId] = useState<string | null>(null);

    useEffect(() => {
        if (!docId) return;
        const channel = supabase.channel(`doc-${docId}`).on('postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'client_documents', filter: `id=eq.${docId}` },
            (payload) => {
                if (payload.new.extraction_status === 'extracted') {
                    setStatus('success');
                    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
                } else if (payload.new.extraction_status === 'error') {
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
            setDocId(data.documentId);
        } catch { setStatus('error'); }
    };

    return (
        <div className="max-w-md mx-auto p-12 border-2 border-dashed border-blue-500 rounded-[2.5rem] bg-white shadow-2xl text-center">
            {status === 'idle' && (
                <div className="animate-in zoom-in duration-300">
                    <div className="text-7xl mb-6">🛸</div>
                    <h2 className="text-2xl font-black text-gray-900 mb-2">Ben está de prontidão</h2>
                    <p className="text-gray-500 mb-8 text-sm">O Ben fará a leitura e organização dos seus dados.</p>
                    <input type="file" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} className="hidden" id="ben-up" accept=".pdf,.png,.jpg" />
                    <label htmlFor="ben-up" className="cursor-pointer bg-blue-600 text-white px-10 py-5 rounded-2xl font-black uppercase shadow-xl hover:bg-blue-700 active:scale-95 transition-all inline-block">
                        ENVIAR PARA O BEN
                    </label>
                </div>
            )}

            {status === 'processing' && (
                <div className="py-6">
                    <div className="w-20 h-20 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                    <h3 className="text-xl font-black text-blue-900 uppercase animate-pulse">O Ben está lendo tudo...</h3>
                    <p className="text-sm text-blue-400 mt-4 font-bold italic">"Sua jornada rumo ao Green Card está sendo processada."</p>
                </div>
            )}

            {status === 'success' && (
                <div className="animate-in bounce-in duration-500 text-green-600">
                    <div className="text-7xl mb-6">🎊</div>
                    <h2 className="text-3xl font-black mb-2">MISSÃO CUMPRIDA!</h2>
                    <p className="text-gray-600 font-medium mb-8">O Ben terminou a análise com sucesso.</p>
                    <button onClick={() => setStatus('idle')} className="font-bold underline text-blue-600">Enviar outro?</button>
                </div>
            )}

            {status === 'error' && (
                <div className="text-red-600">
                    <div className="text-7xl mb-6">⚠️</div>
                    <h3 className="text-xl font-black uppercase">Erro na leitura</h3>
                    <button onClick={() => setStatus('idle')} className="mt-6 bg-red-600 text-white px-8 py-3 rounded-xl font-bold">REPETIR</button>
                </div>
            )}
        </div>
    );
};

export default DocumentUpload;
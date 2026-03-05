'use client'

import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Camera,
    Upload,
    FileText,
    CheckCircle2,
    Loader2,
    AlertCircle,
    Image as ImageIcon,
    Sparkles
} from 'lucide-react'
import { COLORS } from '@/lib/design-system'
import { compressImage, uploadDocument } from '@/lib/storage/upload'

interface DocumentUploadProps {
    caseId: string
    category: string // ex: 'passport', 'birth_certificate'
    label: string
    onComplete?: (data: any) => void
}

type UploadStep = 'idle' | 'compressing' | 'uploading' | 'processing' | 'done' | 'error'

export default function DocumentUpload({ caseId, category, label, onComplete }: DocumentUploadProps) {
    const [step, setStep] = useState<UploadStep>('idle')
    const [error, setError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const cameraInputRef = useRef<HTMLInputElement>(null)

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        console.log(`[DocumentUpload] Arquivo selecionado: ${file.name} (${file.type})`);
        setError(null)
        try {
            // 1. Compressão
            setStep('compressing')
            console.log('[DocumentUpload] Iniciando compressão...');
            const fileToUpload = file.type.startsWith('image/')
                ? await compressImage(file)
                : file
            console.log('[DocumentUpload] Compressão concluída ou ignorada.');

            // 2. Upload para Supabase
            setStep('uploading')
            console.log('[DocumentUpload] Iniciando upload para Supabase...');
            const path = await uploadDocument(fileToUpload, caseId, category)
            console.log(`[DocumentUpload] Upload concluído! Path: ${path}`);

            // 3. IA Lendo Documento
            setStep('processing')
            console.log('[DocumentUpload] Solicitando processamento de IA...');
            const response = await fetch('/api/process-document', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path, caseId, category })
            })

            if (!response.ok) throw new Error('IA falhou ao processar documento')

            const result = await response.json()
            console.log('[DocumentUpload] IA processou o documento com sucesso:', result);

            // 4. Concluído
            setStep('done')
            if (onComplete) onComplete(result)

        } catch (err: any) {
            console.error('[DocumentUpload] Erro crítico:', err)
            setError(err.message || 'Erro no processo de upload')
            setStep('error')
        }
    }

    const triggerFileSelect = () => {
        console.log('[DocumentUpload] Acionando seleção de galeria');
        fileInputRef.current?.click();
    }
    const triggerCamera = () => {
        console.log('[DocumentUpload] Acionando câmera');
        cameraInputRef.current?.click();
    }

    return (
        <div
            className="p-5 rounded-2xl border transition-all"
            style={{
                background: COLORS.card,
                borderColor: step === 'error' ? COLORS.danger : COLORS.border,
                boxShadow: step === 'processing' ? `0 0 20px ${COLORS.primary}22` : 'none'
            }}
        >
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-slate-50">
                        <FileText className="w-5 h-5 text-dim" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold" style={{ color: COLORS.text }}>{label}</h4>
                        <p className="text-[10px] text-dim font-medium uppercase tracking-wider">
                            {category.replace('_', ' ')}
                        </p>
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {step === 'done' && (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                            <CheckCircle2 className="w-6 h-6" style={{ color: COLORS.success }} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="space-y-3">
                {step === 'idle' || step === 'error' ? (
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={triggerCamera}
                            className="flex flex-col items-center justify-center gap-2 py-4 rounded-xl border border-dashed transition-all active:scale-95 hover:bg-slate-50"
                            style={{ borderColor: COLORS.border }}
                        >
                            <Camera className="w-6 h-6" style={{ color: COLORS.primary }} />
                            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: COLORS.textDim }}>Câmera</span>
                        </button>

                        <button
                            onClick={triggerFileSelect}
                            className="flex flex-col items-center justify-center gap-2 py-4 rounded-xl border border-dashed transition-all active:scale-95 hover:bg-white/5"
                            style={{ borderColor: COLORS.border }}
                        >
                            <ImageIcon className="w-6 h-6" style={{ color: COLORS.blue }} />
                            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: COLORS.textDim }}>Galeria</span>
                        </button>
                    </div>
                ) : (
                    <div className="py-4 flex flex-col items-center justify-center gap-4">
                        <div className="relative">
                            {step === 'processing' ? (
                                <div className="relative">
                                    <Sparkles className="w-8 h-8 text-sky-500 animate-pulse" />
                                    <motion.div
                                        className="absolute inset-0 rounded-full border-2 border-sky-300"
                                        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                    />
                                </div>
                            ) : (
                                <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
                            )}
                        </div>

                        <div className="text-center">
                            <p className="text-xs font-bold" style={{ color: COLORS.text }}>
                                {step === 'compressing' && 'Comprimindo...'}
                                {step === 'uploading' && 'Enviando...'}
                                {step === 'processing' && 'IA Analisando Documento...'}
                                {step === 'done' && 'Concluído'}
                            </p>
                            <p className="text-[10px] mt-1" style={{ color: COLORS.textDim }}>
                                {step === 'processing' ? 'Extraindo dados automaticamente' : 'Por favor aguarde'}
                            </p>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 mt-2">
                        <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                        <p className="text-[10px] font-medium text-red-500">{error}</p>
                    </div>
                )}
            </div>

            {/* Hidden Inputs */}
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
            />
            <input
                type="file"
                ref={cameraInputRef}
                className="hidden"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
            />
        </div>
    )
}

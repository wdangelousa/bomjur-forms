'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { sortForUscis } from '@/lib/uscis-sorter'
import type { CaseDocument, Case } from '@/types'
import {
    FileText,
    ArrowLeft,
    Download,
    Printer,
    CheckCircle2,
    Clock,
    AlertCircle,
    User
} from 'lucide-react'

export default function TeamCaseDetailPage() {
    const { id: caseId } = useParams()
    const router = useRouter()
    const supabase = createClient()

    const [loading, setLoading] = useState(true)
    const [caseData, setCaseData] = useState<any>(null)
    const [documents, setDocuments] = useState<CaseDocument[]>([])

    const fetchCaseData = async () => {
        setLoading(true)
        try {
            // Fetch case and client data
            const { data: cData } = await supabase
                .from('cases')
                .select('*, profiles!client_id(full_name, email)')
                .eq('id', caseId)
                .single()
            setCaseData(cData)

            // Fetch case documents
            const { data: dData } = await supabase
                .from('case_documents')
                .select('*')
                .eq('case_id', caseId)

            if (dData) {
                setDocuments(dData as CaseDocument[])
            }
        } catch (error) {
            console.error('Error fetching case:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (caseId) {
            fetchCaseData()
        }
    }, [caseId])

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    if (!caseData) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
                <FileText className="w-16 h-16 text-slate-300 mb-4" />
                <h1 className="text-xl font-bold text-slate-700">Caso não encontrado</h1>
                <button onClick={() => router.back()} className="mt-4 text-sky-500 font-medium hover:underline">
                    Voltar para a lista
                </button>
            </div>
        )
    }

    // Apply the USCIS assembly sort
    const orderedDocuments = sortForUscis(documents)

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'approved': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            case 'rejected': return <AlertCircle className="w-4 h-4 text-red-500" />
            case 'under_review': return <Clock className="w-4 h-4 text-purple-500" />
            default: return <FileText className="w-4 h-4 text-slate-400" />
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 p-4 lg:p-8">
            <div className="max-w-4xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                            Processo: <span className="text-sky-500">{caseData.profiles?.full_name || 'Cliente'}</span>
                        </h1>
                        <p className="text-sm font-medium text-slate-500 mt-1 flex items-center gap-2">
                            <User className="w-4 h-4" />
                            {caseData.profiles?.email}
                            <span className="mx-2">•</span>
                            <span className="uppercase tracking-widest text-[10px] font-bold bg-slate-200 px-2 py-0.5 rounded-md text-slate-700">
                                {caseData.case_type}
                            </span>
                        </p>
                    </div>
                </div>

                {/* Expedição USCIS Section */}
                <section className="bg-white border border-slate-200 rounded-3xl p-6 lg:p-8 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6 pb-6 border-b border-slate-100">
                        <div>
                            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                <Printer className="w-5 h-5 text-sky-500" />
                                Expedição USCIS (Print Order)
                            </h2>
                            <p className="text-sm text-slate-500 font-medium mt-1">
                                Documentos ordenados exatamente como a imigração americana exige na montagem física.
                            </p>
                        </div>
                        <button className="shrink-0 flex items-center justify-center gap-2 px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95">
                            <Download className="w-4 h-4" />
                            Fazer Download do Pacote Completo (Merge PDF)
                        </button>
                    </div>

                    <div className="space-y-3">
                        {orderedDocuments.length === 0 ? (
                            <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                <p className="text-slate-500 font-medium text-sm">Nenhum documento anexado ainda.</p>
                            </div>
                        ) : (
                            orderedDocuments.map((doc, index) => {
                                const isMainForm = doc.document_type?.toLowerCase() === 'form' || doc.category.includes('form_')

                                return (
                                    <div
                                        key={doc.id}
                                        className={`group relative flex items-center gap-4 p-4 rounded-2xl border transition-all ${isMainForm
                                                ? 'bg-sky-50/50 border-sky-100 hover:border-sky-300'
                                                : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                                            }`}
                                    >
                                        <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-slate-900 text-white rounded-xl shadow-md flex items-center justify-center text-xs font-black">
                                            {index + 1}
                                        </div>

                                        <div className="pl-6 flex-1 min-w-0">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isMainForm ? 'bg-sky-100 text-sky-600' : 'bg-slate-100 text-slate-600'}`}>
                                                    <FileText className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <h3 className={`text-sm font-bold truncate ${isMainForm ? 'text-sky-900' : 'text-slate-900'}`}>
                                                        {doc.title || doc.document_type || doc.category.replace('_', ' ')}
                                                    </h3>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                                                            {doc.category.replace('_', ' ')}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 shrink-0">
                                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-100">
                                                {getStatusIcon(doc.status)}
                                                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                                                    {doc.status}
                                                </span>
                                            </div>

                                            {doc.file_url && (
                                                <a
                                                    href={doc.file_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-2 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors"
                                                    title="Visualizar Documento"
                                                >
                                                    <FileText className="w-5 h-5" />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </section>

                {/* Additional case data sections could go here */}
            </div>
        </div>
    )
}

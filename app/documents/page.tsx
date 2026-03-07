'use client'

import React, { useState, useEffect } from 'react'
import {
    FileText,
    Shield,
    Download,
    Eye,
    Clock,
    CheckCircle2,
    Search,
    Filter,
    MoreHorizontal,
    FilePlus,
    Archive,
    AlertCircle,
    Loader2
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function DocumentHubPage() {
    const supabase = createClient()
    const [documents, setDocuments] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    const fetchDocuments = async () => {
        try {
            setLoading(true)
            setErrorMsg(null)

            // 1. Await explicit session to ensure Auth is ready
            const { data: { session }, error: sessionError } = await supabase.auth.getSession()

            if (sessionError) {
                console.error('DocumentHub: Session error:', sessionError.message || sessionError)
                setErrorMsg('Erro de autenticação. Por favor, faça login novamente.')
                setLoading(false)
                return
            }

            if (!session?.user) {
                console.warn('DocumentHub: No active session found')
                setErrorMsg('Sessão expirada. Por favor, faça login novamente.')
                setLoading(false)
                return
            }

            const userId = session.user.id

            // 2. Fetch all documents for this specific user
            // FIX: Removed 'case_id' as it does not exist in the schema.
            // Using 'client_id' which maps to the user ID in the public.client_documents table.
            const { data, error } = await supabase
                .from('client_documents')
                .select('*')
                .eq('client_id', userId)
                .order('created_at', { ascending: false })

            if (error) {
                console.error('DocumentHub: Error fetching client_documents:', error.message || error)
                setErrorMsg('Não foi possível carregar seus documentos. Tente recarregar a página.')
                throw error
            }

            setDocuments(data || [])
        } catch (err: any) {
            console.error('DocumentHub: Critical error in fetchDocuments:', err.message || err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchDocuments()
    }, [])

    const handleView = async (filePath: string) => {
        try {
            const { data, error } = await supabase.storage
                .from('documents')
                .createSignedUrl(filePath, 60)

            if (error) throw error
            if (data?.signedUrl) {
                window.open(data.signedUrl, '_blank')
            }
        } catch (err: any) {
            console.error('Error viewing document:', err.message || err)
            alert('Erro ao visualizar documento.')
        }
    }

    const handleDownload = async (filePath: string, fileName: string) => {
        try {
            const { data, error } = await supabase.storage
                .from('documents')
                .download(filePath)

            if (error) throw error
            if (data) {
                const url = window.URL.createObjectURL(data)
                const link = document.createElement('a')
                link.href = url
                link.setAttribute('download', fileName)
                document.body.appendChild(link)
                link.click()
                link.parentNode?.removeChild(link)
                window.URL.revokeObjectURL(url)
            }
        } catch (err: any) {
            console.error('Error downloading document:', err.message || err)
            alert('Erro ao baixar documento.')
        }
    }

    // Filter Logic
    const filteredDocs = documents.filter(doc =>
        (doc.file_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (doc.category?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    )

    const formatDocDate = (dateStr: string) => {
        if (!dateStr) return 'N/A'
        try {
            return format(new Date(dateStr), 'dd/MM/yyyy HH:mm', { locale: ptBR })
        } catch (e) {
            return 'Data inválida'
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
            {/* ── Page Header ── */}
            <div className="bg-white border-b border-slate-200 px-8 py-10">
                <div className="max-w-6xl mx-auto">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-1.5 bg-blue-50 rounded-lg">
                                    <Shield className="w-4 h-4 text-blue-600" />
                                </div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Cofre Digital Seguro</span>
                            </div>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">Cofre de Documentos</h1>
                            <p className="text-slate-500 font-medium mt-1">Visualize, organize e baixe todos os seus arquivos do processo.</p>
                        </div>

                        <div className="flex items-center gap-3">
                            <button className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-slate-900/10 hover:bg-blue-600 hover:scale-[1.02] transition-all active:scale-95">
                                <FilePlus className="w-4 h-4" />
                                Novo Documento
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <main className="max-w-6xl mx-auto px-8 mt-10">
                {/* ── Error Feedback ── */}
                <AnimatePresence>
                    {errorMsg && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-700 text-sm font-medium"
                        >
                            <AlertCircle className="w-5 h-5 text-red-500" />
                            {errorMsg}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Search & Filter Controls ── */}
                <div className="mb-6 flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar documento pelo nome ou categoria..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white border border-slate-200 px-11 py-3.5 rounded-2xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all shadow-sm"
                        />
                    </div>
                    <button className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl text-xs font-bold hover:bg-slate-50 transition-all shadow-sm active:scale-95">
                        <Filter className="w-4 h-4" />
                        Filtros
                    </button>
                </div>

                {/* ── Documents Table Card ── */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.02)]"
                >
                    <div className="overflow-x-auto">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-24">
                                <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
                                <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Carregando Cofre...</p>
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50 border-b border-slate-100">
                                        <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nome do Ficheiro</th>
                                        <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoria</th>
                                        <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data de Envio</th>
                                        <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                        <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredDocs.map((doc, idx) => (
                                        <motion.tr
                                            key={doc.id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: idx * 0.05 }}
                                            className="group hover:bg-slate-50/50 transition-colors"
                                        >
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-all">
                                                        <FileText className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-900 truncate max-w-[200px]">{doc.file_name}</p>
                                                        <p className="text-[10px] font-bold text-slate-400">PDF</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <span className="px-3 py-1 bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-wider rounded-lg border border-blue-100/50">
                                                    {doc.category?.replace('_', ' ') || 'Geral'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5">
                                                <p className="text-xs font-bold text-slate-600">{formatDocDate(doc.created_at)}</p>
                                            </td>
                                            <td className="px-6 py-5">
                                                {doc.extraction_status === 'approved' ? (
                                                    <div className="flex items-center gap-2 text-emerald-600">
                                                        <CheckCircle2 className="w-4 h-4" />
                                                        <span className="text-[11px] font-black uppercase tracking-widest">Verificado</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 text-orange-500">
                                                        <Clock className="w-4 h-4" />
                                                        <span className="text-[11px] font-black uppercase tracking-widest">Em Análise</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleView(doc.file_path)}
                                                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                        title="Visualizar"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDownload(doc.file_path, doc.file_name)}
                                                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                                        title="Download"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                    </button>
                                                    <button className="p-2 text-slate-400 hover:text-slate-900 rounded-lg transition-all">
                                                        <MoreHorizontal className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))}

                                    {filteredDocs.length === 0 && !loading && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-20 text-center">
                                                <div className="flex flex-col items-center">
                                                    <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-200 mb-4">
                                                        <Archive className="w-8 h-8" />
                                                    </div>
                                                    <h3 className="text-lg font-black text-slate-900">Documento não encontrado</h3>
                                                    <p className="text-slate-500 text-sm max-w-xs mt-1">Verifique o nome do arquivo ou ajuste os filtros de busca.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </motion.div>

                {/* ── Footer Info ── */}
                <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-4 px-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        Criptografia de Ponta a Ponta Ativa
                    </div>
                    <p>© 2024 Proexpand Brasil • Document Hub v1.0</p>
                </div>
            </main>
        </div>
    )
}

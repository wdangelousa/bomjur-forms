'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    Search,
    Filter,
    Clock,
    User,
    ChevronRight,
    FileText,
    Inbox,
    RefreshCw
} from 'lucide-react'
import { COLORS } from '@/lib/design-system'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface ReviewItem {
    id: string
    category: string
    status: string
    created_at: string
    case_id: string
    cases: {
        client_name: string
        case_type: string
    }
}

export default function ReviewQueuePage() {
    const [items, setItems] = useState<ReviewItem[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const supabase = createClient()

    const fetchQueue = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('case_documents')
                .select(`
                    id,
                    category,
                    status,
                    created_at,
                    case_id,
                    cases (
                        client_name,
                        case_type
                    )
                `)
                .in('status', ['uploaded', 'under_review'])
                .order('created_at', { ascending: true })

            if (error) throw error

            const transformedData = (data as any[] || []).map(item => ({
                ...item,
                cases: Array.isArray(item.cases) ? item.cases[0] : item.cases
            }))

            setItems(transformedData)
        } catch (err) {
            console.error('Error fetching review queue:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchQueue()
    }, [])

    const filteredItems = items.filter(item =>
        item.cases?.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="min-h-screen bg-[#0A0E17] flex flex-col">
            {/* Header */}
            <header className="p-6 border-b border-white/5 bg-[#0D1117]/80 backdrop-blur-md sticky top-0 z-20">
                <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl font-black text-white flex items-center gap-2">
                            <Inbox className="w-6 h-6 text-lime-500" />
                            Fila de Revisão
                        </h1>
                        <p className="text-xs text-dim font-medium uppercase tracking-widest mt-1">
                            Documentos Pendentes de Aprovação
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dim" />
                            <input
                                type="text"
                                placeholder="Procurar cliente ou docs..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-500/20 transition-all"
                            />
                        </div>
                        <button
                            onClick={fetchQueue}
                            className="p-2 rounded-xl bg-white/5 border border-white/10 text-dim hover:text-white transition-all"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 p-6 max-w-5xl mx-auto w-full">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="w-10 h-10 border-2 border-lime-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-lime-500">Sincronizando Fila...</span>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                            <CheckCircle2 className="w-8 h-8 text-dim" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-white font-bold">Tudo em dia!</h3>
                            <p className="text-sm text-dim">Não há documentos pendentes para revisão no momento.</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredItems.map((item, idx) => (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                            >
                                <Link
                                    href={`/team/review/${item.id}`}
                                    className="group flex items-center justify-between p-4 rounded-2xl bg-[#111827] border border-white/5 hover:border-lime-500/30 transition-all active:scale-[0.99]"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-dim group-hover:bg-lime-500/10 group-hover:text-lime-500 transition-all">
                                            <FileText className="w-6 h-6" />
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-sm font-bold text-white group-hover:text-lime-500 transition-colors">
                                                    {item.cases?.client_name || 'Cliente Desconhecido'}
                                                </h4>
                                                <span className="text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded bg-white/5 text-dim border border-white/5">
                                                    {item.cases?.case_type}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <p className="text-xs text-dim capitalize">
                                                    {item.category.replace('_', ' ')}
                                                </p>
                                                <span className="w-1 h-1 rounded-full bg-white/10" />
                                                <p className="text-[10px] text-dim flex items-center gap-1 font-medium">
                                                    <Clock className="w-3 h-3" />
                                                    Enviado {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ptBR })}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <div className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${item.status === 'in_review' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
                                            {item.status === 'in_review' ? 'Em Revisão' : 'Novo'}
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-dim group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </Link>
                            </motion.div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    )
}

function CheckCircle2(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M20 6 9 17l-5-5" />
        </svg>
    )
}

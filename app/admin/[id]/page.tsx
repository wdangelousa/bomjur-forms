'use client'

import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

export default function AdminClientManagement() {
    const params = useParams()
    const router = useRouter()
    const id = params?.id

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
            <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200 px-6 h-16 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.push('/admin')} className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all">
                        <ChevronLeft size={20} />
                    </button>
                    <div className="h-5 w-[1px] bg-slate-200" />
                    <h1 className="font-bold text-sm tracking-tight">
                        Gerenciamento de Cliente <span className="text-slate-400 font-normal">#{id ? (id as string).split('-')[0].toUpperCase() : ''}</span>
                    </h1>
                </div>
            </nav>

            <main className="max-w-5xl mx-auto px-6 mt-10 space-y-8">
                <div className="bg-white rounded-[2rem] p-8 md:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col md:flex-row gap-8 items-start md:items-center relative overflow-hidden">
                    <div className="flex-1">
                        <h2 className="text-3xl font-extrabold tracking-tight mb-4">Painel do Cliente</h2>
                        <p className="text-slate-500 font-medium">
                            A interface detalhada de gerenciamento I-485 para este cliente está em construção.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    )
}

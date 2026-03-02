// Server Component — sem 'use client'
// Barra de marca global da Proexpand Brasil: exibida em TODAS as páginas via RootLayout

export default function ProexpandTopBar() {
    return (
        <header className="fixed top-0 left-0 right-0 h-24 z-[5000] flex items-center px-10 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
            {/* Logo Proexpand - Protagonismo Absoluto */}
            <div className="flex items-center">
                <img
                    src="/proexpand-logo.png"
                    alt="Proexpand Brasil"
                    className="h-14 w-auto object-contain block transition-transform hover:scale-105 duration-300"
                />
            </div>

            <div className="ml-6 h-8 w-[1px] bg-slate-200 hidden md:block" />

            {/* Identificador da Solução - Estilo Tech Product */}
            <div className="ml-4 hidden md:flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Immigration Technology</span>
                <span className="text-sm font-semibold text-slate-800 tracking-tight">Employment-Based Platform</span>
            </div>

            {/* Badge de Status - Lado Direito */}
            <div className="ml-auto flex items-center gap-3 px-5 py-2.5 bg-emerald-50 border border-emerald-100 rounded-2xl">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold text-emerald-700 font-sans tracking-wide whitespace-nowrap uppercase">
                    Sistema Ativo
                </span>
            </div>
        </header>
    )
}
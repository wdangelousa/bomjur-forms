// Server Component — sem 'use client'
// Barra de marca global da Proexpand Brasil: exibida em TODAS as páginas via RootLayout

export default function ProexpandTopBar() {
    return (
        <header className="fixed top-0 left-0 right-0 h-20 z-[5000] flex items-center px-8 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
            {/* Logo Proexpand - Destaque Absoluto */}
            <div className="flex items-center">
                <img
                    src="/proexpand_brasil_logo.png"
                    alt="Proexpand Brasil"
                    className="h-16 w-auto object-contain block"
                />
            </div>

            {/* Badge de Plataforma - Lado Direito */}
            <div className="ml-auto flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-full shadow-sm">
                <span className="text-lg leading-none">🚀</span>
                <span className="text-xs font-semibold text-slate-600 font-sans tracking-wide whitespace-nowrap">
                    Green Card · Employment-Based
                </span>
            </div>
        </header>
    )
}

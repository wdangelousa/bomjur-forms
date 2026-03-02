// Server Component — sem 'use client'
// Assinatura flutuante da fornecedora de tecnologia: canto inferior direito em TODAS as páginas

export default function BomjurSignature() {
    return (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 z-50 bg-white/80 backdrop-blur-sm p-2 rounded-full shadow-lg pointer-events-none border border-slate-200">
            <span className="text-xs text-slate-500 font-medium whitespace-nowrap select-none px-2">
                Powered by Bomjur Technology
            </span>
            <img
                src="/bomjur-logo.png"
                alt="Bomjur Technology"
                className="h-6 w-auto object-contain block opacity-90 mr-1"
            />
        </div>
    )
}

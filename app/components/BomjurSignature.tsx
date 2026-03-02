// Server Component
// Assinatura da fornecedora Bomjur: fixa no canto inferior direito

export default function BomjurSignature() {
    return (
        <div className="fixed bottom-6 right-8 z-[5000] flex items-center gap-3 px-4 py-2 bg-white/50 backdrop-blur-sm rounded-full border border-slate-100 opacity-60 hover:opacity-100 transition-all duration-300 select-none">
            <span className="text-[10px] font-medium text-slate-500 tracking-widest uppercase">
                Powered by
            </span>
            <img
                src="/bomjur-logo.png"
                alt="Bomjur Technology"
                className="h-5 w-auto grayscale contrast-125 object-contain"
            />
        </div>
    )
}
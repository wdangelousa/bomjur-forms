import bomjurLogo from '@/public/bomjur-logo.png'

export default function BomjurSignature() {
    return (
        <div suppressHydrationWarning={true} className="fixed bottom-4 right-4 z-[5000] flex items-center gap-3 px-5 py-2.5 bg-white shadow-md rounded-full border border-slate-200 select-none overflow-hidden hover:shadow-lg transition-all duration-300">
            <span className="text-[11px] font-bold text-slate-500 tracking-widest uppercase relative z-10">
                Powered by
            </span>
            <div suppressHydrationWarning={true} className="relative h-12 flex items-center justify-center">
                <img
                    src={bomjurLogo.src}
                    alt="Bomjur Technology"
                    className="w-auto h-8 object-contain"
                />
            </div>
        </div>
    )
}
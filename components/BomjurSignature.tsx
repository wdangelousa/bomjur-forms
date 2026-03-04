import bomjurLogo from '@/public/bomjur-logo.png'

export default function BomjurSignature() {
    return (
        <div className="fixed bottom-4 right-4 z-[5000] flex items-center gap-3 px-4 py-2 bg-white shadow-sm rounded-full border border-slate-200 select-none overflow-hidden hover:shadow transition-all duration-300">
            <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase relative z-10">
                Powered by
            </span>
            <div className="relative h-6 flex items-center justify-center">
                <img
                    src={bomjurLogo.src}
                    alt="Bomjur Technology"
                    className="w-auto h-6 object-contain"
                />
            </div>
        </div>
    )
}
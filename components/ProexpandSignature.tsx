import proexpandLogo from '@/public/proexpand-logo.png'

export default function ProexpandSignature() {
    return (
        <div className="fixed bottom-4 left-4 z-[5000] flex items-center gap-3 px-4 py-2 bg-white shadow-sm rounded-full border border-slate-200 select-none overflow-hidden hover:shadow transition-all duration-300">
            <div className="relative h-6 flex items-center justify-center">
                <img
                    src={proexpandLogo.src}
                    alt="Proexpand Brasil"
                    className="w-auto h-6 object-contain"
                />
            </div>
            <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase relative z-10">
                Protagonismo
            </span>
        </div>
    )
}

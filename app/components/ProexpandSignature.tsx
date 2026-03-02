import proexpandLogo from '../../public/proexpand-logo.png'

export default function ProexpandSignature() {
    return (
        <div className="fixed bottom-6 left-8 z-[5000] flex items-center gap-4 px-6 py-3 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.08)] rounded-full border border-slate-200 select-none overflow-hidden hover:shadow-[0_8px_30px_rgb(0,0,0,0.14)] transition-all duration-300">
            <div className="relative w-36 h-8 flex items-center justify-center">
                <img
                    src={proexpandLogo.src}
                    alt="Proexpand Brasil"
                    className="absolute w-auto max-w-none h-36 object-contain"
                />
            </div>
            <span className="text-[11px] font-bold text-slate-600 tracking-widest uppercase relative z-10">
                Protagonismo
            </span>
        </div>
    )
}

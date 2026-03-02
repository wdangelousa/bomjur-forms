import proexpandLogo from '../../public/proexpand-logo.png'

export default function ProexpandSignature() {
    return (
        <div className="fixed bottom-6 left-8 z-[5000] flex items-center gap-3 px-5 py-2.5 bg-white/90 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.06)] rounded-full border border-slate-200/60 select-none overflow-hidden hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all duration-300">
            <div className="relative w-28 h-6 flex items-center justify-center">
                <img
                    src={proexpandLogo.src}
                    alt="Proexpand Brasil"
                    className="absolute w-full h-full object-contain"
                />
            </div>
            <span className="text-[10px] font-bold text-slate-500 tracking-[0.2em] uppercase relative z-10 pt-0.5">
                Protagonismo
            </span>
        </div>
    )
}

import bomjurLogo from '../../public/bomjur-logo.png'

export default function BomjurSignature() {
    return (
        <div className="fixed bottom-6 right-8 z-[5000] flex items-center gap-4 px-6 py-3 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.08)] rounded-full border border-slate-200 select-none overflow-hidden hover:shadow-[0_8px_30px_rgb(0,0,0,0.14)] transition-all duration-300">
            <span className="text-[11px] font-bold text-slate-600 tracking-widest uppercase relative z-10">
                Powered by
            </span>
            {/* Mantido o contêiner proporcional ao aumento de h-36 da imagem */}
            <div className="relative w-36 h-8 flex items-center justify-center">
                <img
                    src={bomjurLogo.src}
                    alt="Bomjur Technology"
                    className="absolute w-auto max-w-none h-36 object-contain"
                />
            </div>
        </div>
    )
}
import type { Metadata } from 'next'
import './globals.css'
import ProexpandTopBar from './components/ProexpandTopBar'
import BomjurSignature from './components/BomjurSignature'

export const metadata: Metadata = {
    title: 'Proexpand Brasil · Immigration Platform',
    description:
        'Plataforma de imigração Employment-Based Green Card — desenvolvida e operada pela Proexpand Brasil, com tecnologia Bomjur.',
    icons: {
        icon: '/proexpandbrasil-logo.png',
    },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="pt-BR" suppressHydrationWarning>
            <body suppressHydrationWarning>
                {/* Barra de marca global — topo fixo em todas as páginas */}
                <ProexpandTopBar />

                {/* Conteúdo de cada página */}
                {children}

                {/* Assinatura da fornecedora — canto inferior direito fixo */}
                <BomjurSignature />
            </body>
        </html>
    )
}

import type { Metadata } from 'next'
import './globals.css'
import LayoutSignatures from './components/LayoutSignatures'

export const metadata: Metadata = {
    title: 'Proexpand Brasil · Immigration Platform',
    description:
        'Plataforma de imigração Employment-Based Green Card — desenvolvida e operada pela Proexpand Brasil, com tecnologia Bomjur.',
    icons: {
        icon: '/proexpand-logo.png',
    },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="pt-BR" suppressHydrationWarning>
            <body suppressHydrationWarning>
                {/* Conteúdo de cada página (Tela de Login, etc) */}
                {children}

                {/* Assinaturas de marca — fixas no rodapé (exclui /login) */}
                <LayoutSignatures />
            </body>
        </html>
    )
}
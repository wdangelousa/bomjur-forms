import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import LayoutSignatures from './components/LayoutSignatures'

const inter = Inter({ subsets: ['latin'] })

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    themeColor: '#84CC16',
}

export const metadata: Metadata = {
    title: 'Proexpand Brasil · Immigration Platform',
    description:
        'Plataforma de imigração Employment-Based Green Card — desenvolvida e operada pela Proexpand Brasil, com tecnologia Bomjur.',
    icons: {
        icon: '/proexpand-logo.png',
    },
    appleWebApp: {
        capable: true,
        statusBarStyle: 'default',
        title: 'Bomjur Forms',
    },
    formatDetection: {
        telephone: false,
    },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="pt-BR" suppressHydrationWarning>
            <body className={inter.className} suppressHydrationWarning style={{ background: '#0A0E17' }}>
                {/* Conteúdo de cada página (Tela de Login, etc) */}
                {children}

                {/* Assinaturas de marca — fixas no rodapé (exclui /login) */}
                <LayoutSignatures />
            </body>
        </html>
    )
}
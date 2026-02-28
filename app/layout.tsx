import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Bomjur — Immigration Platform',
    description: 'Plataforma de imigração Employment-Based',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="pt-BR" suppressHydrationWarning>
            <body suppressHydrationWarning style={{ margin: 0, padding: 0, fontFamily: 'Inter, system-ui, sans-serif' }}>
                {children}
            </body>
        </html>
    )
}

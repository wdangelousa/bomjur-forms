'use client'

import { usePathname } from 'next/navigation'
import BomjurSignature from './BomjurSignature'
import ProexpandSignature from './ProexpandSignature'

export default function LayoutSignatures() {
    const pathname = usePathname()

    // Não exibir assinaturas na página de login
    if (pathname === '/login') return null

    return (
        <>
            <ProexpandSignature />
            <BomjurSignature />
        </>
    )
}

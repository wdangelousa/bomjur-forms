'use client'

import { usePathname } from 'next/navigation'
import BomjurSignature from './BomjurSignature'
import ProexpandSignature from './ProexpandSignature'

export default function LayoutSignatures() {
    const pathname = usePathname()

    // Na página de login, exibir apenas a Bomjur e com o tema apropriado se necessário
    if (pathname === '/login') {
        return <BomjurSignature />
    }

    return (
        <>
            <ProexpandSignature />
            <BomjurSignature />
        </>
    )
}

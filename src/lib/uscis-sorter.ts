import { CaseDocument } from '@/types'

export function sortForUscis(documents: CaseDocument[]): CaseDocument[] {
    // USCIS preferred order index map
    const getWeight = (doc: CaseDocument) => {
        const title = (doc.title || doc.document_type || '').toLowerCase()
        const type = (doc.document_type || '').toLowerCase()

        // 1. Formulários preenchidos (I-485, I-765, I-131)
        if (type === 'form' || title.includes('i-485') || title.includes('i-765') || title.includes('i-131')) return 1

        // 2. Aprovação base (I-140 Approval Notice / I-797)
        if (title.includes('i-140') || title.includes('i-797') || type === 'approval_notice') return 2

        // 3. Documentos de Identidade (Passaporte, Visto, I-94)
        if (type === 'passport' || title.includes('passport') || title.includes('passaporte') ||
            type === 'visa' || title.includes('visto') || title.includes('visa') ||
            type === 'i94' || title.includes('i-94')) return 3

        // 4. Documentos Civis (Certidão de Nascimento, Casamento)
        if (type === 'birth_certificate' || title.includes('birth') || title.includes('nascimento') ||
            type === 'marriage_certificate' || title.includes('marriage') || title.includes('casamento')) return 4

        // 5. Exames Médicos (I-693)
        if (type === 'medical' || title.includes('medical') || title.includes('i-693')) return 5

        // 6. Evidências Financeiras / Outros
        return 6
    }

    return [...documents].sort((a, b) => getWeight(a) - getWeight(b))
}

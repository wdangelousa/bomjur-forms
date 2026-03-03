import { NextRequest, NextResponse } from 'next/server'
import {
    arrayBufferToBase64,
    resolveMediaType,
    buildFileBlock,
    callClaude,
    extractJson,
} from '@/lib/ai-utils'

// Up to 60s on Vercel Pro; capped at 10s on Hobby.
export const maxDuration = 60

/**
 * Mapeia o texto livre da IA para um dos valores de VisaCategory do sistema.
 * Trata códigos USCIS (E11, E21, etc.) e nomes em inglês.
 */
function mapToCategory(raw: string | null | undefined): string {
    if (!raw) return ''
    const r = raw.toUpperCase().trim()
    if (r.includes('EB-1A') || r.includes('E11') || r.includes('EXTRAORDINARY ABILITY')) return 'EB-1A'
    if (r.includes('EB-1B') || r.includes('E12') || r.includes('OUTSTANDING RESEARCHER') || r.includes('OUTSTANDING PROFESSOR')) return 'EB-1B'
    if (r.includes('NIW') || r.includes('E21') || r.includes('NATIONAL INTEREST WAIVER') || r.includes('NATIONAL INTEREST')) return 'EB-2 NIW'
    if (r.includes('EB-3 OTHER') || r.includes('EW3') || r.includes('OTHER WORKER') || r.includes('UNSKILLED')) return 'EB-3 Other'
    if (r.includes('EB-2') || r.includes('E20') || r.includes('ADVANCED DEGREE')) return 'EB-2'
    if (r.includes('EB-3') || r.includes('E31') || r.includes('E32') || r.includes('SKILLED WORKER') || r.includes('PROFESSIONAL')) return 'EB-3'
    return ''
}

const FAST_TRACK_PROMPT = `Você está analisando um formulário USCIS I-797 (Notice of Action) ou outro documento de imigração americana.

Extraia os dados e retorne APENAS JSON válido no formato exato abaixo. Nenhum texto fora do JSON.

{
  "category": "uma das opções: EB-1A, EB-1B, EB-2 NIW, EB-2, EB-3, EB-3 Other — ou null",
  "priority_date": "data no formato YYYY-MM-DD ou null",
  "full_name": "nome completo do beneficiário ou null",
  "birth_country": "país de nascimento em português ou null",
  "birth_date": "data de nascimento YYYY-MM-DD ou null",
  "confidence": 0.90
}

Regras de mapeamento de categoria:
- EB-1A = código E11 = "Alien of Extraordinary Ability"
- EB-1B = código E12 = "Outstanding Researcher or Professor"
- EB-2 NIW = código E21 = "National Interest Waiver"
- EB-2 = código E20 = "Advanced Degree Professional"
- EB-3 = código E31/E32 = "Skilled Worker or Professional"
- EB-3 Other = código EW3 = "Other Worker (unskilled)"

Busque o nome do beneficiário (não do peticionário/empregador).
Se um campo não for visível ou legível, use null.`

export async function POST(req: NextRequest) {
    let formData: FormData
    try {
        formData = await req.formData()
    } catch {
        return NextResponse.json({ error: 'Falha ao ler o arquivo enviado.' }, { status: 400 })
    }

    const file = formData.get('file') as File | null
    if (!file || !file.size) {
        return NextResponse.json({ error: 'Arquivo não enviado ou vazio.' }, { status: 400 })
    }

    if (file.size > 20 * 1024 * 1024) {
        return NextResponse.json({ error: 'Arquivo muito grande. Limite: 20 MB.' }, { status: 400 })
    }

    try {
        const buffer = await file.arrayBuffer()
        const base64 = arrayBufferToBase64(buffer)
        const { isPdf, mediaType } = resolveMediaType(file.name, file.type)
        const fileBlock = buildFileBlock(isPdf, mediaType, base64)

        const aiText = await callClaude(FAST_TRACK_PROMPT, fileBlock, isPdf, 512)
        const parsed = extractJson<Record<string, unknown>>(aiText)

        return NextResponse.json({
            category: mapToCategory(parsed.category as string | null),
            priorityDate: (parsed.priority_date as string | null) ?? '',
            fullName: (parsed.full_name as string | null) ?? '',
            birthCountry: (parsed.birth_country as string | null) ?? '',
            birthDate: (parsed.birth_date as string | null) ?? '',
            confidence: (parsed.confidence as number) ?? 0.9,
        })
    } catch (e) {
        const msg = (e as Error).message
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}

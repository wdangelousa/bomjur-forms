// ============================================================
// ai-utils.ts — Utilitários centralizados para chamadas de IA
// Importar daqui em vez de duplicar nas rotas de API
// ============================================================

/**
 * Converte um ArrayBuffer em string Base64.
 * Processa em chunks para evitar stack overflow em arquivos grandes.
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    const chunkSize = 8192
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
    }
    return btoa(binary)
}

/**
 * Determina o mediaType correto para um arquivo (PDF vs imagem).
 * Retorna { isPdf, mediaType }.
 */
export function resolveMediaType(
    fileName: string,
    mimeType: string,
): { isPdf: boolean; mediaType: string } {
    const ext = fileName.split('.').pop()?.toLowerCase()
    const isPdf = ext === 'pdf' || mimeType === 'application/pdf'

    if (isPdf) return { isPdf: true, mediaType: 'application/pdf' }

    let mediaType = mimeType || 'image/jpeg'
    if (mediaType.includes('jpg') || mediaType.includes('jpeg')) mediaType = 'image/jpeg'
    else if (mediaType.includes('png')) mediaType = 'image/png'
    else if (mediaType.includes('gif')) mediaType = 'image/gif'
    else if (mediaType.includes('webp')) mediaType = 'image/webp'
    else mediaType = 'image/jpeg'

    return { isPdf: false, mediaType }
}

/**
 * Monta o bloco de arquivo para o payload da Anthropic API.
 */
export function buildFileBlock(
    isPdf: boolean,
    mediaType: string,
    base64Data: string,
): Record<string, unknown> {
    if (isPdf) {
        return {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64Data },
        }
    }
    return {
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: base64Data },
    }
}

/**
 * Chama a API da Anthropic (Claude) e retorna o texto bruto da resposta.
 * Lança um Error se a chamada falhar.
 */
export async function callClaude(
    prompt: string,
    fileBlock: Record<string, unknown>,
    isPdf: boolean,
    maxTokens = 1024,
): Promise<string> {
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY não configurada.')

    const headers: Record<string, string> = {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
    }
    if (isPdf) headers['anthropic-beta'] = 'pdfs-2024-09-25'

    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers,
        body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: maxTokens,
            messages: [{
                role: 'user',
                content: [fileBlock, { type: 'text', text: prompt }],
            }],
        }),
    })

    if (!res.ok) {
        const body = await res.text()
        throw new Error(`Claude erro ${res.status}: ${body.substring(0, 300)}`)
    }

    const data = await res.json()
    const text: string = data.content?.[0]?.text ?? ''
    if (!text) throw new Error('Resposta vazia da IA.')
    return text
}

/**
 * Extrai o primeiro bloco JSON de uma string de texto.
 * Lança um Error se não encontrar JSON válido.
 */
export function extractJson<T = Record<string, unknown>>(text: string): T {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error(`JSON não encontrado na resposta da IA: ${text.substring(0, 100)}`)
    try {
        return JSON.parse(match[0]) as T
    } catch {
        throw new Error('JSON inválido na resposta da IA.')
    }
}

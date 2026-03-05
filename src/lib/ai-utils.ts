import type { I485ExtractedData } from '@/types/i485-schema'

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

export function resolveMediaType(fileName: string, mimeType: string): { isPdf: boolean; mediaType: string } {
  const ext = fileName.split('.').pop()?.toLowerCase()
  const isPdf = ext === 'pdf' || mimeType === 'application/pdf'
  if (isPdf) return { isPdf: true, mediaType: 'application/pdf' }
  return { isPdf: false, mediaType: mimeType || 'image/jpeg' }
}

export function buildFileBlock(isPdf: boolean, mediaType: string, base64Data: string) {
  if (isPdf) {
    return {
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: base64Data,
      },
    }
  }
  return {
    type: 'image',
    source: {
      type: 'base64',
      media_type: mediaType as any,
      data: base64Data,
    },
  }
}

export async function callClaude(prompt: string, fileBlock: Record<string, unknown>, isPdf: boolean, maxTokens = 2048): Promise<string> {
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
      model: 'claude-3-haiku-20240307', // Usando Haiku para evitar 404 de acesso aos modelos 3.5
      max_tokens: maxTokens,
      system: "Você é o Ben, um analista especialista em documentos de imigração. Responda APENAS com JSON válido.",
      messages: [{ role: 'user', content: [fileBlock, { type: 'text', text: prompt }] }],
    }),
  })

  if (!res.ok) {
    const bodyText = await res.text()
    throw new Error(`Claude erro ${res.status}: ${bodyText.substring(0, 300)}`)
  }

  const data = await res.json()
  return data.content?.[0]?.text ?? ''
}

export function extractJson<T = Record<string, unknown>>(text: string): T {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error(`JSON não encontrado.`)
  return JSON.parse(match[0]) as T
}
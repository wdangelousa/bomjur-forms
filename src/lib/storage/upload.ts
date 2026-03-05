import { createClient } from '@/lib/supabase/client'

const supabase = createClient()
const BUCKET_NAME = 'documents'

/**
 * Faz o upload de um documento para o Supabase Storage
 */
export async function uploadDocument(file: File, caseId: string, category: string) {
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
    const filePath = `${caseId}/${category}/${fileName}`

    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
        })

    if (error) throw error
    return data.path
}

/**
 * Retorna uma URL assinada (signed URL) para acesso seguro ao documento
 */
export async function getDocumentUrl(path: string, expiresIn = 3600) {
    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(path, expiresIn)

    if (error) throw error
    return data.signedUrl
}

/**
 * Comprime uma imagem client-side via Canvas para economizar dados
 * Redimensiona para um máximo de 2000px mantendo o aspect ratio
 */
export async function compressImage(file: File): Promise<File> {
    if (!file.type.startsWith('image/')) return file

    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = (event) => {
            const img = new Image()
            img.src = event.target?.result as string
            img.onload = () => {
                const canvas = document.createElement('canvas')
                let width = img.width
                let height = img.height
                const maxDim = 2000

                if (width > height) {
                    if (width > maxDim) {
                        height *= maxDim / width
                        width = maxDim
                    }
                } else {
                    if (height > maxDim) {
                        width *= maxDim / height
                        height = maxDim
                    }
                }

                canvas.width = width
                canvas.height = height
                const ctx = canvas.getContext('2d')
                ctx?.drawImage(img, 0, 0, width, height)

                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            const compressedFile = new File([blob], file.name, {
                                type: 'image/jpeg',
                                lastModified: Date.now(),
                            })
                            resolve(compressedFile)
                        } else {
                            reject(new Error('Canvas toBlob failed'))
                        }
                    },
                    'image/jpeg',
                    0.85 // Qualidade 85%
                )
            }
        }
        reader.onerror = (error) => reject(error)
    })
}

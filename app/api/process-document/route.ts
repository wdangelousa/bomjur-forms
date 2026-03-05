import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

export async function POST(req: NextRequest) {
    try {
        // Agora aceitamos FormData (o ficheiro real vindo do browser)
        const formData = await req.formData()
        const file = formData.get('file') as File

        if (!file) {
            return NextResponse.json({ error: 'Nenhum ficheiro enviado.' }, { status: 400 })
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
        const supabase = createClient(supabaseUrl, serviceRoleKey)

        // 1. Upload para o bucket 'bomjur-documents' (o mesmo que a Edge Function usa)
        const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`
        const filePath = `uploads/${fileName}`

        const { error: uploadErr } = await supabase.storage
            .from('bomjur-documents')
            .upload(filePath, file)

        if (uploadErr) throw new Error(`Erro no upload: ${uploadErr.message}`)

        // 2. Criar o registo na base de dados para a IA saber o que processar
        const { data: doc, error: dbErr } = await supabase
            .from('client_documents')
            .insert({
                file_path: filePath,
                file_name: file.name,
                extraction_status: 'processing'
            })
            .select()
            .single()

        if (dbErr) throw new Error(`Erro na DB: ${dbErr.message}`)

        // 3. Disparar a Edge Function (robusta para PDFs e evita timeouts no Vercel)
        const { error: funcError } = await supabase.functions.invoke('process-document', {
            body: { documentId: doc.id, filePath: filePath }
        })

        if (funcError) throw new Error(`Falha ao disparar Edge Function: ${funcError.message}`)

        return NextResponse.json({
            success: true,
            documentId: doc.id,
            message: 'Processamento iniciado com sucesso.'
        })

    } catch (e: any) {
        console.error('[API Error]:', e.message)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
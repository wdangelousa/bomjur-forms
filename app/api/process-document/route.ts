import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData()
        const file = formData.get('file') as File
        if (!file) return NextResponse.json({ error: 'Ficheiro ausente' }, { status: 400 })

        // Usamos Service Role para garantir bypass de RLS no backend
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`
        const filePath = `uploads/${fileName}`

        // 1. Upload para o Storage
        const { error: upErr } = await supabase.storage.from('documents').upload(filePath, file)
        if (upErr) throw upErr

        // 2. Registro na tabela client_documents
        const { data: doc, error: dbErr } = await supabase.from('client_documents').insert({
            file_path: filePath,
            file_name: file.name,
            extraction_status: 'processing'
        }).select().single()

        if (dbErr) throw dbErr

        // 3. 🚀 IGNIÇÃO: Acorda o Ben (Edge Function)
        await supabase.functions.invoke('process-document', {
            body: { documentId: doc.id, filePath: filePath }
        })

        return NextResponse.json({ success: true, documentId: doc.id })
    } catch (e: any) {
        console.error('Erro na API:', e.message)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument } from 'pdf-lib'
import fs from 'fs'
import path from 'path'

// Mapa de formulários disponíveis para escaneamento
const FORM_FILES: Record<string, string> = {
    'i-140': 'i-140.pdf',
    'i-485': 'i-485.pdf',
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const formKey = searchParams.get('form') ?? 'i-140'

    const fileName = FORM_FILES[formKey]
    if (!fileName) {
        return NextResponse.json(
            { erro: `Formulário "${formKey}" não encontrado. Opções: ${Object.keys(FORM_FILES).join(', ')}` },
            { status: 400 }
        )
    }

    const filePath = path.join(process.cwd(), fileName)

    if (!fs.existsSync(filePath)) {
        return NextResponse.json(
            { erro: `Arquivo "${fileName}" não encontrado na raiz do projeto.` },
            { status: 404 }
        )
    }

    const pdfBytes = fs.readFileSync(filePath)
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
    const form = pdfDoc.getForm()
    const fields = form.getFields()

    const resultado = fields.map(field => ({
        nome: field.getName(),
        tipo: field.constructor.name,
    }))

    // Log no console para inspeção durante o desenvolvimento
    console.log(`\n📋 Campos do formulário ${formKey.toUpperCase()} (${resultado.length} campos):`)
    resultado.forEach((f, i) => {
        console.log(`  [${String(i + 1).padStart(3, '0')}] ${f.tipo.padEnd(20)} ${f.nome}`)
    })

    return NextResponse.json({
        formulario: formKey.toUpperCase(),
        totalCampos: resultado.length,
        campos: resultado,
    })
}

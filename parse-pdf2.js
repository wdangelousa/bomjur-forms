const { PDFDocument } = require('pdf-lib');
const fs = require('fs');

async function parse(file) {
    const pdfBytes = fs.readFileSync(file);
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const form = pdfDoc.getForm();
    console.log(`\n\n--- ${file} ---`);
    console.log("hasXFA:", form.hasXFA());
    console.log("Field count (getFields):", form.getFields().length);
    
    // Let's try to get AcroForm dict directly
    const acroForm = pdfDoc.catalog.lookup(pdfDoc.context.obj('AcroForm'));
    if (acroForm) {
        console.log("AcroForm keys:", acroForm.keys().map(k => k.encodedName));
    } else {
        console.log("No AcroForm found.");
    }
}

async function run() {
    await parse('./i-485.pdf').catch(e => console.error(e));
    await parse('./i-140.pdf').catch(e => console.error(e));
}

run();

const { PDFDocument } = require('pdf-lib');
const fs = require('fs');

async function parse(file) {
    const pdfBytes = fs.readFileSync(file);
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const form = pdfDoc.getForm();
    const fields = form.getFields();
    
    console.log(`\n\n--- FIELDS FOR ${file} ---`);
    fields.forEach(field => {
        const type = field.constructor.name;
        const name = field.getName();
        console.log(`${type}: ${name}`);
    });
}

async function run() {
    await parse('./i-485.pdf').catch(e => console.error(e));
    await parse('./i-140.pdf').catch(e => console.error(e));
}

run();

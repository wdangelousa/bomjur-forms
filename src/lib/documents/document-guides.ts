export interface GuideContent {
    howToPrepare: string;
    requirements: string[];
    aiTip: string;
}

export interface DocumentGuide {
    pt: GuideContent;
    en: GuideContent;
}

export const DOCUMENT_GUIDES: Record<string, DocumentGuide> = {
    passport: {
        pt: {
            howToPrepare: "Abra o passaporte na página que contém sua foto e dados pessoais.",
            requirements: [
                "Foto colorida e nítida",
                "Sem reflexos de luz sobre os dados",
                "Os quatro cantos da página devem estar visíveis",
                "Documento dentro da validade"
            ],
            aiTip: "Nossa IA lê melhor se você colocar o passaporte sobre uma superfície escura e contrastante."
        },
        en: {
            howToPrepare: "Open your passport to the page containing your photo and personal data.",
            requirements: [
                "Clear, color photo",
                "No light reflections over the data",
                "All four corners of the page must be visible",
                "Document must be valid (not expired)"
            ],
            aiTip: "Our AI reads better if you place the passport on a dark, contrasting surface."
        }
    },
    birth_certificate: {
        pt: {
            howToPrepare: "Posicione a certidão de nascimento aberta em uma superfície plana e bem iluminada.",
            requirements: [
                "Texto totalmente legível",
                "Sem dobras ou partes cobertas",
                "Foto integral do documento (frente e verso se houver dados atrás)",
                "Tradução juramentada se não for em Inglês/Português"
            ],
            aiTip: "Evite sombras projetadas pelo seu celular sobre o documento para garantir a precisão dos nomes."
        },
        en: {
            howToPrepare: "Place the open birth certificate on a flat, well-lit surface.",
            requirements: [
                "Text must be fully legible",
                "No folds or covered parts",
                "Full photo of the document (front and back if there's data on both)",
                "Certified translation if not in English/Portuguese"
            ],
            aiTip: "Avoid shadows cast by your phone over the document to ensure name accuracy."
        }
    },
    i94_record: {
        pt: {
            howToPrepare: "Obtenha seu registro I-94 mais recente no site oficial do CBP ou escaneie o selo no passaporte.",
            requirements: [
                "Número do I-94 visível",
                "Data de admissão e classe de admissão claras",
                "Versão digital (PDF) é preferível se disponível"
            ],
            aiTip: "Se estiver fotografando o selo no passaporte, use o modo macro da câmera para capturar os detalhes da data."
        },
        en: {
            howToPrepare: "Retrieve your most recent I-94 record from the official CBP website or scan the stamp in your passport.",
            requirements: [
                "I-94 number must be visible",
                "Admission date and class must be clear",
                "Digital version (PDF) is preferred if available"
            ],
            aiTip: "If photographing the passport stamp, use the camera's macro mode to capture date details."
        }
    },
    marriage_certificate: {
        pt: {
            howToPrepare: "Fotografe a certidão de casamento original inteira.",
            requirements: [
                "Nomes dos cônjuges e data do casamento legíveis",
                "Selo ou carimbo do cartório visível",
                "Tradução juramentada necessária para o USCIS"
            ],
            aiTip: "Certifique-se de que a data do casamento está bem nítida, pois ela é fundamental para o cronograma do seu caso."
        },
        en: {
            howToPrepare: "Photograph the entire original marriage certificate.",
            requirements: [
                "Spouse names and marriage date must be legible",
                "Registry seal or stamp must be visible",
                "Certified translation required for USCIS"
            ],
            aiTip: "Ensure the marriage date is very clear, as it is critical for your case timeline."
        }
    }
};

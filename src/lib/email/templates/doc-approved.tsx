import {
    Body,
    Container,
    Head,
    Heading,
    Html,
    Link,
    Preview,
    Section,
    Text,
    Img,
    Button,
} from '@react-email/components'
import * as React from 'react'

interface DocApprovedEmailProps {
    clientName: string
    docType: string
    progress: number
    lang?: 'pt' | 'en'
}

export const DocApprovedEmail = ({
    clientName = 'Cliente',
    docType = 'Passaporte',
    progress = 70,
    lang = 'pt',
}: DocApprovedEmailProps) => {
    const isPt = lang === 'pt'

    const content = {
        preview: isPt ? `Boa notícia! Seu ${docType} foi aprovado` : `Good news! Your ${docType} has been approved`,
        heading: isPt ? 'Documento Aprovado!' : 'Document Approved!',
        subheading: isPt ? `Olá, ${clientName}.` : `Hello, ${clientName}.`,
        body: isPt
            ? `Temos boas notícias: seu documento (${docType}) foi revisado e aprovado com sucesso pela nossa equipe.`
            : `We have good news: your document (${docType}) has been successfully reviewed and approved by our team.`,
        progressTitle: isPt ? 'Seu Progresso Atual' : 'Your Current Progress',
        cta: isPt ? 'Ver Progresso no Bomjur' : 'View Progress on Bomjur',
        footer: isPt
            ? 'Este é um e-mail automático. Por favor, não responda.'
            : 'This is an automated email. Please do not reply.',
    }

    return (
        <Html>
            <Head />
            <Preview>{content.preview}</Preview>
            <Body style={main}>
                <Container style={container}>
                    <Section style={header}>
                        <Text style={logo}>BOMJUR</Text>
                    </Section>

                    <Section style={contentSection}>
                        <Heading style={h1}>{content.heading}</Heading>
                        <Text style={h2}>{content.subheading}</Text>
                        <Text style={text}>{content.body}</Text>
                    </Section>

                    <Section style={progressSection}>
                        <Text style={progressText}>{content.progressTitle}</Text>
                        <Section style={progressBarOuter}>
                            <Section style={{ ...progressBarInner, width: `${progress}%` }} />
                        </Section>
                        <Text style={statusText}>{progress}% {isPt ? 'Concluído' : 'Complete'}</Text>
                    </Section>

                    <Section style={buttonContainer}>
                        <Button style={button} href="https://bomjur.com/dashboard">
                            {content.cta}
                        </Button>
                    </Section>

                    <Text style={footerText}>{content.footer}</Text>
                </Container>
            </Body>
        </Html>
    )
}

export default DocApprovedEmail

const main = {
    backgroundColor: '#0A0E17',
    fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
}

const container = {
    margin: '0 auto',
    padding: '40px 20px',
    width: '580px',
    maxWidth: '100%',
}

const header = {
    padding: '24px 0',
    textAlign: 'center' as const,
}

const logo = {
    color: '#84CC16',
    fontSize: '24px',
    fontWeight: '900',
    letterSpacing: '4px',
}

const contentSection = {
    padding: '0 20px',
}

const h1 = {
    color: '#FFFFFF',
    fontSize: '32px',
    fontWeight: '900',
    margin: '30px 0',
    padding: '0',
    lineHeight: '1.2',
    textAlign: 'center' as const,
}

const h2 = {
    color: '#FFFFFF',
    fontSize: '20px',
    fontWeight: '700',
    margin: '0 0 10px',
}

const text = {
    color: '#8899A6',
    fontSize: '16px',
    lineHeight: '24px',
}

const progressSection = {
    backgroundColor: '#111827',
    borderRadius: '24px',
    padding: '24px',
    margin: '32px 0',
    border: '1px solid #1F2937',
}

const progressText = {
    color: '#8899A6',
    fontSize: '10px',
    fontWeight: '900',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
    margin: '0 0 16px',
}

const progressBarOuter = {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '999px',
    height: '10px',
    overflow: 'hidden',
}

const progressBarInner = {
    backgroundColor: '#84CC16',
    borderRadius: '999px',
    height: '10px',
}

const statusText = {
    color: '#84CC16',
    fontSize: '14px',
    fontWeight: '900',
    textAlign: 'right' as const,
    margin: '12px 0 0',
}

const buttonContainer = {
    textAlign: 'center' as const,
    margin: '32px 0',
}

const button = {
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    color: '#000000',
    fontSize: '14px',
    fontWeight: '900',
    textDecoration: 'none',
    textAlign: 'center' as const,
    display: 'inline-block',
    width: '100%',
    padding: '16px 0',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
}

const footerText = {
    color: '#4B5563',
    fontSize: '12px',
    textAlign: 'center' as const,
    marginTop: '40px',
}

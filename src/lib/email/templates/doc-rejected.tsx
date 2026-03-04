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

interface DocRejectedEmailProps {
    clientName: string
    docType: string
    reason: string
    lang?: 'pt' | 'en'
}

export const DocRejectedEmail = ({
    clientName = 'Cliente',
    docType = 'Passaporte',
    reason = 'Documento ilegível',
    lang = 'pt',
}: DocRejectedEmailProps) => {
    const isPt = lang === 'pt'

    const content = {
        preview: isPt ? `Ação Necessária: Seu ${docType} precisa de correção` : `Action Required: Your ${docType} needs correction`,
        heading: isPt ? 'Ajuste Necessário' : 'Adjustment Needed',
        subheading: isPt ? `Olá, ${clientName}.` : `Hello, ${clientName}.`,
        body: isPt
            ? `Após a revisão, notamos que o documento (${docType}) não pôde ser aceito.`
            : `After review, we noticed that your document (${docType}) could not be accepted.`,
        reasonTitle: isPt ? 'Motivo da Rejeição' : 'Reason for Rejection',
        cta: isPt ? 'Reenviar Documento Agora' : 'Resubmit Document Now',
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

                    <Section style={reasonSection}>
                        <Text style={reasonLabel}>{content.reasonTitle}</Text>
                        <Text style={reasonText}>"{reason}"</Text>
                    </Section>

                    <Section style={buttonContainer}>
                        <Button style={button} href="https://bomjur.com/dashboard/documents">
                            {content.cta}
                        </Button>
                    </Section>

                    <Text style={footerText}>{content.footer}</Text>
                </Container>
            </Body>
        </Html>
    )
}

export default DocRejectedEmail

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
    color: '#EF4444',
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

const reasonSection = {
    backgroundColor: '#2D1F1F',
    borderRadius: '24px',
    padding: '24px',
    margin: '32px 0',
    border: '1px solid #451A1A',
}

const reasonLabel = {
    color: '#F87171',
    fontSize: '10px',
    fontWeight: '900',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
    margin: '0 0 8px',
}

const reasonText = {
    color: '#FFFFFF',
    fontSize: '16px',
    fontWeight: '500',
    margin: '0',
}

const buttonContainer = {
    textAlign: 'center' as const,
    margin: '32px 0',
}

const button = {
    backgroundColor: '#EF4444',
    borderRadius: '16px',
    color: '#FFFFFF',
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

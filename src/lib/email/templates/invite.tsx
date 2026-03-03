import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface InviteEmailProps {
  clientName: string
  caseType: string
  magicLink: string
  language: 'pt' | 'en'
  documentsCount: number
  documentsList?: string[]
}

const t = {
  pt: {
    preview: (name: string) => `${name}, seu caso de imigração está pronto!`,
    greeting: (name: string) => `Olá, ${name}! 👋`,
    caseCreated: (type: string) => `Seu caso ${type} foi criado`,
    intro: 'A equipe da Onebridge preparou tudo para você. Agora é sua vez de completar as informações e enviar os documentos necessários.',
    steps: 'Veja como funciona:',
    step1: '1. Clique no botão abaixo para acessar seu caso',
    step2: '2. Preencha seus dados pessoais (leva ~5 minutos)',
    step3: '3. Envie os documentos solicitados (pode usar a câmera do celular!)',
    step4: '4. Acompanhe o progresso em tempo real',
    cta: 'Acessar Meu Caso',
    docsTitle: (count: number) => `📋 Você vai precisar preparar ${count} documentos:`,
    tip: '💡 Dica: Você pode acessar pelo celular e tirar fotos dos documentos direto pela câmera!',
    security: 'Este link é pessoal e seguro. Não compartilhe com outras pessoas.',
    questions: 'Dúvidas? Responda este email ou entre em contato:',
    footer: 'Onebridge Consulting — Seu parceiro de imigração',
    gamification: '🎮 Ganhe pontos e badges conforme completa cada etapa!',
  },
  en: {
    preview: (name: string) => `${name}, your immigration case is ready!`,
    greeting: (name: string) => `Hello, ${name}! 👋`,
    caseCreated: (type: string) => `Your ${type} case has been created`,
    intro: 'The Onebridge team has set everything up for you. Now it\'s your turn to complete your information and submit the required documents.',
    steps: 'Here\'s how it works:',
    step1: '1. Click the button below to access your case',
    step2: '2. Fill in your personal details (~5 minutes)',
    step3: '3. Upload the requested documents (you can use your phone camera!)',
    step4: '4. Track your progress in real time',
    cta: 'Access My Case',
    docsTitle: (count: number) => `📋 You'll need to prepare ${count} documents:`,
    tip: '💡 Tip: You can access from your phone and take photos of documents directly with your camera!',
    security: 'This link is personal and secure. Do not share it with others.',
    questions: 'Questions? Reply to this email or contact us:',
    footer: 'Onebridge Consulting — Your immigration partner',
    gamification: '🎮 Earn points and badges as you complete each step!',
  },
}

export default function InviteEmail({
  clientName,
  caseType,
  magicLink,
  language = 'pt',
  documentsCount,
  documentsList = [],
}: InviteEmailProps) {
  const l = t[language]

  return (
    <Html>
      <Head />
      <Preview>{l.preview(clientName)}</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={logo}>🛫 Bomjur</Text>
          </Section>

          {/* Main Card */}
          <Section style={card}>
            {/* Greeting */}
            <Heading style={heading}>{l.greeting(clientName)}</Heading>

            {/* Case badge */}
            <Section style={caseBadge}>
              <Text style={caseBadgeText}>{l.caseCreated(caseType)}</Text>
            </Section>

            {/* Intro */}
            <Text style={paragraph}>{l.intro}</Text>

            {/* Steps */}
            <Text style={stepsTitle}>{l.steps}</Text>
            <Text style={stepItem}>{l.step1}</Text>
            <Text style={stepItem}>{l.step2}</Text>
            <Text style={stepItem}>{l.step3}</Text>
            <Text style={stepItem}>{l.step4}</Text>

            {/* CTA Button */}
            <Section style={ctaSection}>
              <Button style={ctaButton} href={magicLink}>
                {l.cta}
              </Button>
            </Section>

            {/* Gamification teaser */}
            <Section style={gamificationBox}>
              <Text style={gamificationText}>{l.gamification}</Text>
            </Section>

            <Hr style={divider} />

            {/* Documents preview */}
            <Text style={docsTitle}>{l.docsTitle(documentsCount)}</Text>
            {documentsList.length > 0 && (
              <Section>
                {documentsList.map((doc, i) => (
                  <Text key={i} style={docItem}>• {doc}</Text>
                ))}
              </Section>
            )}

            <Hr style={divider} />

            {/* Tip */}
            <Section style={tipBox}>
              <Text style={tipText}>{l.tip}</Text>
            </Section>

            {/* Security note */}
            <Text style={securityNote}>🔒 {l.security}</Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerQuestions}>{l.questions}</Text>
            <Link href="mailto:contact@onebridge.us" style={footerLink}>
              contact@onebridge.us
            </Link>
            <Text style={footerBrand}>{l.footer}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

// ── Styles ──

const body = {
  backgroundColor: '#0A0E17',
  fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  margin: '0',
  padding: '0',
}

const container = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '24px 16px',
}

const header = {
  textAlign: 'center' as const,
  padding: '16px 0 8px',
}

const logo = {
  fontSize: '28px',
  fontWeight: '800',
  color: '#84CC16',
  margin: '0',
  letterSpacing: '-0.5px',
}

const card = {
  backgroundColor: '#111827',
  borderRadius: '16px',
  padding: '32px 28px',
  border: '1px solid #1E293B',
}

const heading = {
  fontSize: '22px',
  fontWeight: '700',
  color: '#F1F5F9',
  margin: '0 0 16px',
  lineHeight: '1.3',
}

const caseBadge = {
  backgroundColor: 'rgba(132, 204, 22, 0.1)',
  borderRadius: '10px',
  padding: '12px 16px',
  border: '1px solid rgba(132, 204, 22, 0.2)',
  marginBottom: '20px',
}

const caseBadgeText = {
  fontSize: '15px',
  fontWeight: '600',
  color: '#84CC16',
  margin: '0',
  textAlign: 'center' as const,
}

const paragraph = {
  fontSize: '14px',
  color: '#94A3B8',
  lineHeight: '1.7',
  margin: '0 0 20px',
}

const stepsTitle = {
  fontSize: '14px',
  fontWeight: '600',
  color: '#F1F5F9',
  margin: '0 0 8px',
}

const stepItem = {
  fontSize: '13px',
  color: '#94A3B8',
  lineHeight: '1.8',
  margin: '0',
  paddingLeft: '4px',
}

const ctaSection = {
  textAlign: 'center' as const,
  margin: '28px 0',
}

const ctaButton = {
  backgroundColor: '#84CC16',
  color: '#0A0E17',
  fontSize: '15px',
  fontWeight: '700',
  padding: '14px 40px',
  borderRadius: '12px',
  textDecoration: 'none',
  display: 'inline-block',
}

const gamificationBox = {
  backgroundColor: 'rgba(249, 115, 22, 0.08)',
  borderRadius: '8px',
  padding: '10px 14px',
  border: '1px solid rgba(249, 115, 22, 0.15)',
  marginBottom: '4px',
}

const gamificationText = {
  fontSize: '13px',
  color: '#F97316',
  margin: '0',
  textAlign: 'center' as const,
  fontWeight: '500',
}

const divider = {
  borderColor: '#1E293B',
  margin: '20px 0',
}

const docsTitle = {
  fontSize: '14px',
  fontWeight: '600',
  color: '#F1F5F9',
  margin: '0 0 10px',
}

const docItem = {
  fontSize: '13px',
  color: '#94A3B8',
  margin: '0',
  lineHeight: '1.8',
  paddingLeft: '4px',
}

const tipBox = {
  backgroundColor: 'rgba(6, 182, 212, 0.08)',
  borderRadius: '8px',
  padding: '12px 14px',
  border: '1px solid rgba(6, 182, 212, 0.15)',
  marginBottom: '16px',
}

const tipText = {
  fontSize: '12px',
  color: '#06B6D4',
  margin: '0',
  lineHeight: '1.5',
}

const securityNote = {
  fontSize: '11px',
  color: '#64748B',
  textAlign: 'center' as const,
  margin: '0',
}

const footer = {
  textAlign: 'center' as const,
  padding: '24px 0 8px',
}

const footerQuestions = {
  fontSize: '12px',
  color: '#64748B',
  margin: '0 0 4px',
}

const footerLink = {
  fontSize: '12px',
  color: '#84CC16',
  textDecoration: 'underline',
}

const footerBrand = {
  fontSize: '11px',
  color: '#475569',
  margin: '16px 0 0',
  fontWeight: '500',
}

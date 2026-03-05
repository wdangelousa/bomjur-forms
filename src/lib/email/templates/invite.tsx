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
  clientEmail?: string
  caseType: string
  loginLink: string
  password?: string
  language: 'pt' | 'en'
  documentsCount: number
  documentsList?: string[]
}

const t = {
  pt: {
    preview: (name: string) => `${name}, seu passaporte de acesso está pronto!`,
    greeting: (name: string) => `Olá, ${name}! 👋`,
    caseCreated: (type: string) => `Seu processo ${type} foi inicializado`,
    intro: 'A equipe da Proexpand preparou seu acesso exclusivo à nossa plataforma legal. Utilize as credenciais abaixo para começar.',
    credentialsTitle: 'Seu Acesso Antecipado:',
    emailLabel: 'Seu Login (E-mail):',
    passwordLabel: 'Sua Senha de Embarque:',
    steps: 'Como acessar:',
    step1: '1. Clique no botão "Acessar Plataforma" abaixo',
    step2: '2. Use seu e-mail e a senha temporária abaixo',
    step3: '3. Complete seu perfil e anexe os documentos',
    step4: '4. Acompanhe a aprovação em tempo real',
    cta: 'Acessar Plataforma',
    docsTitle: (count: number) => `📋 Lista de conferência (${count} itens):`,
    tip: '💡 Dica: Você pode tirar fotos dos seus documentos direto pelo celular!',
    security: 'Esta senha é temporária. Você poderá trocá-la após o primeiro acesso.',
    questions: 'Dúvidas sobre o processo? Responda este email:',
    footer: 'Proexpand — Inteligência em Imigração',
    gamification: '🎮 Ganhe pontos de progresso ao completar sua checklist!',
  },
  en: {
    preview: (name: string) => `${name}, your access passport is ready!`,
    greeting: (name: string) => `Hello, ${name}! 👋`,
    caseCreated: (type: string) => `Your ${type} process has been initialized`,
    intro: 'The Proexpand team has set up your exclusive access to our legal platform. Use the credentials below to get started.',
    credentialsTitle: 'Your Boarding Access:',
    emailLabel: 'Your Login (Email):',
    passwordLabel: 'Your Temporary Password:',
    steps: 'How to access:',
    step1: '1. Click the "Access Platform" button below',
    step2: '2. Use your email and the temporary password below',
    step3: '3. Complete your profile and attach documents',
    step4: '4. Track your approval in real-time',
    cta: 'Access Platform',
    docsTitle: (count: number) => `📋 Checklist (${count} items):`,
    tip: '💡 Tip: You can take photos of your documents directly with your phone!',
    security: 'This is a temporary password. you can change it after your first login.',
    questions: 'Questions? Just reply to this email:',
    footer: 'Proexpand — Immigration Intelligence',
    gamification: '🎮 Earn progress points as you complete your checklist!',
  },
}

export default function InviteEmail({
  clientName,
  clientEmail,
  caseType,
  loginLink,
  password,
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

            {/* Credentials Block */}
            {password && (
              <Section style={credentialsBox}>
                {clientEmail && (
                  <>
                    <Text style={credentialsLabel}>{l.emailLabel}</Text>
                    <Text style={emailText}>{clientEmail}</Text>
                  </>
                )}
                <Text style={{ ...credentialsLabel, marginTop: clientEmail ? '16px' : '0' }}>{l.passwordLabel}</Text>
                <Text style={passwordText}>{password}</Text>
              </Section>
            )}

            {/* Steps */}
            <Section style={stepsBox}>
              <Text style={stepsTitle}>{l.steps}</Text>
              <Text style={stepItem}>{l.step1}</Text>
              <Text style={stepItem}>{l.step2}</Text>
              <Text style={stepItem}>{l.step3}</Text>
              <Text style={stepItem}>{l.step4}</Text>
            </Section>

            {/* CTA Button */}
            <Section style={ctaSection}>
              <Button style={ctaButton} href={loginLink}>
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
            <Link href="mailto:support@bomjur.us" style={footerLink}>
              support@bomjur.us
            </Link>
            <Text style={footerBrand}>{l.footer}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

// ── Styles ──

const credentialsBox = {
  backgroundColor: '#1E293B',
  borderRadius: '12px',
  padding: '24px',
  textAlign: 'center' as const,
  margin: '24px 0',
  border: '1px solid #334155',
}

const credentialsLabel = {
  fontSize: '11px',
  fontWeight: '800',
  color: '#94A3B8',
  textTransform: 'uppercase' as const,
  letterSpacing: '1px',
  margin: '0 0 8px',
}

const passwordText = {
  fontSize: '28px',
  fontWeight: '800',
  color: '#FFFFFF',
  fontFamily: "'Courier New', Courier, monospace",
  margin: '0',
  letterSpacing: '4px',
}

const emailText = {
  fontSize: '16px',
  fontWeight: '600',
  color: '#FFFFFF',
  margin: '0',
}

const stepsBox = {
  margin: '24px 0',
}

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


import { Resend } from 'resend'

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Bomjur <noreply@bomjur.com>'

interface SendEmailParams {
  to: string
  subject: string
  react: React.ReactElement
}

export async function sendEmail({ to, subject, react }: SendEmailParams) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not defined. Email skip.')
    return null
  }

  const resend = new Resend(process.env.RESEND_API_KEY)

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    react,
  })

  if (error) {
    console.error('Resend error:', error)
    throw new Error(`Email failed: ${error.message}`)
  }

  return data
}

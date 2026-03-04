import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/resend'
import InviteEmail from '@/lib/email/templates/invite'

export async function POST(request: NextRequest) {
  try {
    // 1. Verify caller is team or admin
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { data: callerProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!callerProfile || !['team', 'super_admin'].includes(callerProfile.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    // 2. Parse request
    const body = await request.json()
    const { caseId, magicLink: providedLink } = body

    if (!caseId) {
      return NextResponse.json({ error: 'caseId é obrigatório' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // 3. Fetch case + client profile + required docs
    const { data: caseData, error: caseError } = await adminClient
      .from('cases')
      .select(`
        *,
        user_profiles!client_id (id, full_name, email, preferred_language)
      `)
      .eq('id', caseId)
      .single()

    if (caseError || !caseData) {
      return NextResponse.json({ error: 'Caso não encontrado' }, { status: 404 })
    }

    const clientProfile = (caseData as any).user_profiles
    const clientEmail = clientProfile?.email
    const clientName = clientProfile?.full_name || 'Cliente'
    const language = clientProfile?.preferred_language || 'pt'

    if (!clientEmail) {
      return NextResponse.json({ error: 'Email do cliente não encontrado' }, { status: 400 })
    }

    // 4. Fetch required docs for this case type
    const { data: requiredDocs } = await adminClient
      .from('required_documents')
      .select('name_pt, name_en, is_required')
      .eq('case_type', caseData.case_type)
      .eq('tenant_id', caseData.tenant_id)
      .eq('is_required', true)
      .order('display_order')

    const docNames = (requiredDocs || []).map(d =>
      language === 'pt' ? d.name_pt : d.name_en
    )

    // 5. Generate magic link if not provided
    let magicLink = providedLink

    if (!magicLink) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const redirectTo = `${appUrl}/case/${caseId}/onboarding`

      const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
        type: 'magiclink',
        email: clientEmail,
        options: { redirectTo },
      })

      if (linkError || !linkData?.properties?.action_link) {
        return NextResponse.json(
          { error: `Erro ao gerar link: ${linkError?.message || 'unknown'}` },
          { status: 500 }
        )
      }

      magicLink = linkData.properties.action_link
    }

    // 6. Send email
    const subject = language === 'pt'
      ? `${clientName}, seu caso ${caseData.case_type} está pronto!`
      : `${clientName}, your ${caseData.case_type} case is ready!`

    const emailResult = await sendEmail({
      to: clientEmail,
      subject,
      react: InviteEmail({
        clientName,
        caseType: caseData.case_type,
        magicLink,
        language,
        documentsCount: docNames.length,
        documentsList: docNames,
      }),
    })

    // 7. Log to audit
    await adminClient.from('audit_log').insert({
      tenant_id: caseData.tenant_id,
      user_id: user.id,
      case_id: caseId,
      action: 'invite_email_sent',
      details: {
        to: clientEmail,
        language,
        messageId: emailResult?.id,
      },
    })

    // 8. Create welcome notification for client
    await adminClient.from('notifications').insert({
      user_id: clientProfile.id,
      case_id: caseId,
      type: 'welcome',
      channel: 'in_app',
      title: language === 'pt' ? 'Bem-vindo ao Bomjur! 🛫' : 'Welcome to Bomjur! 🛫',
      body: language === 'pt'
        ? `Seu caso ${caseData.case_type} foi criado. Comece o onboarding para enviar seus documentos.`
        : `Your ${caseData.case_type} case has been created. Start onboarding to submit your documents.`,
      data: { caseId, action: 'start_onboarding' },
    })

    return NextResponse.json({
      success: true,
      messageId: emailResult?.id,
      sentTo: clientEmail,
    })

  } catch (error: any) {
    console.error('Send invite error:', error)
    return NextResponse.json(
      { error: `Erro ao enviar email: ${error.message}` },
      { status: 500 }
    )
  }
}

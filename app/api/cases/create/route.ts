import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/resend'
import InviteEmail from '@/lib/email/templates/invite'

// Document types required per case type
const CASE_DOCUMENTS: Record<string, string[]> = {
  'I-485': [
    'passport',
    'birth_certificate',
    'photo_2x2',
    'i94',
    'marriage_certificate',
    'employer_letter',
    'medical_exam',
    'proof_of_residence',
  ],
  'I-140': [
    'passport',
    'birth_certificate',
    'employer_letter',
    'diploma',
    'employment_verification',
    'pay_stubs',
  ],
}

export async function POST(request: NextRequest) {
  try {
    // 1. Verify caller is authenticated
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // 2. Use admin client to check caller role (bypasses RLS on profiles)
    const adminClient = createAdminClient()

    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single()

    if (!callerProfile || !['team', 'tenant_admin', 'super_admin'].includes(callerProfile.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    // 3. Parse request body (new case creation form data)
    const body = await request.json()
    const {
      client_name,
      client_email,
      client_phone,
      case_type,
      preferred_language = 'pt',
    } = body

    if (!client_name?.trim() || !client_email?.trim() || !case_type) {
      return NextResponse.json(
        { error: 'Nome, email e tipo de caso são obrigatórios' },
        { status: 400 }
      )
    }

    if (!['I-485', 'I-140'].includes(case_type)) {
      return NextResponse.json({ error: 'Tipo de caso inválido' }, { status: 400 })
    }

    // 4. Get caller's tenant_id from user_profiles
    const { data: callerUserProfile } = await adminClient
      .from('user_profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    const tenantId = callerUserProfile?.tenant_id
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 400 })
    }

    // 5. Create or find auth user for the client
    let clientUserId: string

    // Check if user already exists
    const { data: existingUsers } = await adminClient.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === client_email.toLowerCase()
    )

    if (existingUser) {
      clientUserId = existingUser.id
    } else {
      // Create new auth user (no password — client only uses magic links)
      const { data: newUser, error: createUserError } = await adminClient.auth.admin.createUser({
        email: client_email,
        email_confirm: true,
        user_metadata: {
          full_name: client_name,
          phone: client_phone || null,
        },
      })

      if (createUserError || !newUser.user) {
        return NextResponse.json(
          { error: `Erro ao criar usuário: ${createUserError?.message}` },
          { status: 500 }
        )
      }
      clientUserId = newUser.user.id
    }

    // 6. Upsert client profile in `profiles` (for RLS functions)
    await adminClient.from('profiles').upsert({
      id: clientUserId,
      full_name: client_name,
      email: client_email,
      phone: client_phone || null,
      role: 'client',
      preferred_language,
    }, { onConflict: 'id' })

    // 7. Upsert client profile in `user_profiles` (for tenant-scoped RLS)
    await adminClient.from('user_profiles').upsert({
      id: clientUserId,
      tenant_id: tenantId,
      full_name: client_name,
      email: client_email,
      phone: client_phone || null,
      role: 'client',
      preferred_language,
    }, { onConflict: 'id' })

    // 8. Create the case
    const { data: newCase, error: caseError } = await adminClient
      .from('cases')
      .insert({
        tenant_id: tenantId,
        client_id: clientUserId,
        assigned_to: user.id,
        case_type,
        status: 'pending_onboarding',
        personal_data: { full_name: client_name, email: client_email, phone: client_phone || null },
      })
      .select('id')
      .single()

    if (caseError || !newCase) {
      return NextResponse.json(
        { error: `Erro ao criar caso: ${caseError?.message}` },
        { status: 500 }
      )
    }

    const caseId = newCase.id

    // 9. Create required case_documents
    const docTypes = CASE_DOCUMENTS[case_type] || []
    if (docTypes.length > 0) {
      const docsToInsert = docTypes.map((docType, idx) => ({
        case_id: caseId,
        document_type: docType,
        status: 'pending',
        is_required: true,
        display_order: idx,
      }))

      await adminClient.from('case_documents').insert(docsToInsert)
    }

    // 10. Generate magic link for client
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const redirectTo = `${appUrl}/auth/callback?next=/case/${caseId}/onboarding`

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: client_email,
      options: { redirectTo },
    })

    let magicLink: string | null = null
    let emailSent = false

    if (!linkError && linkData?.properties?.action_link) {
      magicLink = linkData.properties.action_link

      // 11. Send invite email
      try {
        const subject = preferred_language === 'pt'
          ? `${client_name}, seu caso ${case_type} está pronto!`
          : `${client_name}, your ${case_type} case is ready!`

        await sendEmail({
          to: client_email,
          subject,
          react: InviteEmail({
            clientName: client_name,
            caseType: case_type,
            magicLink,
            language: preferred_language,
            documentsCount: docTypes.length,
            documentsList: docTypes,
          }),
        })
        emailSent = true
      } catch (emailErr) {
        // Email failure is non-fatal — case was created successfully
        console.error('Email send failed (non-fatal):', emailErr)
      }
    }

    // 12. Log to audit
    await adminClient.from('audit_log').insert({
      tenant_id: tenantId,
      user_id: user.id,
      case_id: caseId,
      action: 'case_created',
      details: {
        case_type,
        client_email,
        email_sent: emailSent,
        docs_created: docTypes.length,
      },
    })

    return NextResponse.json({
      success: true,
      caseId,
      magicLink,
      emailSent,
      documentsCreated: docTypes.length,
    })

  } catch (error: any) {
    console.error('Create case error:', error)
    return NextResponse.json(
      { error: `Erro interno: ${error.message}` },
      { status: 500 }
    )
  }
}

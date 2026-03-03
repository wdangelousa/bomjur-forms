import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    // 1. Verify caller is team or admin
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role, tenant_id')
      .eq('id', user.id)
      .single()

    if (!callerProfile || !['team', 'super_admin'].includes(callerProfile.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    // 2. Parse request body
    const body = await request.json()
    const {
      client_name,
      client_email,
      client_phone,
      case_type,
      preferred_language = 'pt',
    } = body

    if (!client_name || !client_email || !case_type) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: client_name, client_email, case_type' },
        { status: 400 }
      )
    }

    if (!['I-485', 'I-140'].includes(case_type)) {
      return NextResponse.json(
        { error: 'Tipo de caso inválido. Use I-485 ou I-140' },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()
    const tenantId = callerProfile.tenant_id

    // 3. Check if user already exists, create if not
    let clientUserId: string

    const { data: existingUsers } = await adminClient.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(
      u => u.email?.toLowerCase() === client_email.toLowerCase()
    )

    if (existingUser) {
      clientUserId = existingUser.id

      // Update profile if needed
      await adminClient
        .from('profiles')
        .update({
          full_name: client_name,
          phone: client_phone || null,
          preferred_language,
          role: 'client',
        })
        .eq('id', clientUserId)
    } else {
      // Create new auth user (trigger will create profile)
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: client_email,
        email_confirm: true,
        user_metadata: {
          full_name: client_name,
          tenant_id: tenantId,
        },
      })

      if (createError || !newUser.user) {
        return NextResponse.json(
          { error: `Erro ao criar usuário: ${createError?.message || 'unknown'}` },
          { status: 500 }
        )
      }

      clientUserId = newUser.user.id

      // Update profile with extra data (trigger creates with defaults)
      await adminClient
        .from('profiles')
        .update({
          full_name: client_name,
          phone: client_phone || null,
          preferred_language,
          role: 'client',
          tenant_id: tenantId,
        })
        .eq('id', clientUserId)
    }

    // 4. Create the case (trigger auto-initializes docs + progress)
    const { data: newCase, error: caseError } = await adminClient
      .from('cases')
      .insert({
        tenant_id: tenantId,
        client_id: clientUserId,
        assigned_to: user.id,
        case_type,
        status: 'pending_onboarding',
      })
      .select()
      .single()

    if (caseError || !newCase) {
      return NextResponse.json(
        { error: `Erro ao criar caso: ${caseError?.message || 'unknown'}` },
        { status: 500 }
      )
    }

    // 5. Count docs created by trigger
    const { count: docsCount } = await adminClient
      .from('case_documents')
      .select('*', { count: 'exact', head: true })
      .eq('case_id', newCase.id)

    // 6. Generate magic link
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const redirectTo = `${appUrl}/case/${newCase.id}/onboarding`

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: client_email,
      options: {
        redirectTo,
      },
    })

    if (linkError) {
      // Case was created but link failed — still return success with warning
      return NextResponse.json({
        success: true,
        case: newCase,
        documentsCreated: docsCount || 0,
        magicLink: null,
        warning: `Caso criado, mas erro ao gerar link: ${linkError.message}`,
      })
    }

    // 7. Log to audit
    await adminClient.from('audit_log').insert({
      tenant_id: tenantId,
      user_id: user.id,
      case_id: newCase.id,
      action: 'case_created',
      details: {
        client_email,
        case_type,
        documents_initialized: docsCount,
      },
    })

    return NextResponse.json({
      success: true,
      case: newCase,
      documentsCreated: docsCount || 0,
      magicLink: linkData?.properties?.action_link || null,
      clientUserId,
    })

  } catch (error: any) {
    console.error('Create case error:', error)
    return NextResponse.json(
      { error: `Erro interno: ${error.message}` },
      { status: 500 }
    )
  }
}

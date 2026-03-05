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
    // ──────────────────────────────────────────────
    // 1. AUTHENTICATE CALLER
    // ──────────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Use admin client for ALL database ops (bypasses RLS — secure since we validated auth)
    const adminClient = createAdminClient()

    // Check caller role
    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single()

    if (!callerProfile || !['team', 'tenant_admin', 'super_admin'].includes(callerProfile.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    // ──────────────────────────────────────────────
    // 2. PARSE FORM DATA (multipart/form-data)
    // ──────────────────────────────────────────────
    const formData = await request.formData()

    const client_name = (formData.get('client_name') as string)?.trim()
    const client_email = (formData.get('client_email') as string)?.trim()
    const client_phone = (formData.get('client_phone') as string)?.trim() || null
    const case_type = formData.get('case_type') as string
    const preferred_language = (formData.get('preferred_language') as string) || 'pt'
    const i140_file = formData.get('i140_file') as File | null

    if (!client_name || !client_email || !case_type) {
      return NextResponse.json(
        { error: 'Nome, email e tipo de caso são obrigatórios' },
        { status: 400 }
      )
    }

    if (!['I-485', 'I-140'].includes(case_type)) {
      return NextResponse.json({ error: 'Tipo de caso inválido' }, { status: 400 })
    }

    // ──────────────────────────────────────────────
    // 3. GET CALLER TENANT
    // ──────────────────────────────────────────────
    const { data: callerUserProfile } = await adminClient
      .from('user_profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    const tenantId = callerUserProfile?.tenant_id
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 400 })
    }

    // ──────────────────────────────────────────────
    // 4. CREATE OR FIND AUTH USER FOR CLIENT
    // ──────────────────────────────────────────────
    let clientUserId: string
    const generatedPassword = Math.random().toString(36).slice(-8)

    // Try to find existing user by email
    const { data: listData } = await adminClient.auth.admin.listUsers()
    const existingUser = listData?.users?.find(
      (u) => u.email?.toLowerCase() === client_email.toLowerCase()
    )

    if (existingUser) {
      clientUserId = existingUser.id
      // Update existing user with new boarding password (since we are moving from magic links)
      await adminClient.auth.admin.updateUserById(clientUserId, {
        password: generatedPassword,
        user_metadata: {
          full_name: client_name,
          phone: client_phone,
        },
      })
    } else {
      // Create new auth user with boarding password
      const { data: newUser, error: createUserError } = await adminClient.auth.admin.createUser({
        email: client_email,
        password: generatedPassword,
        email_confirm: true,
        user_metadata: {
          full_name: client_name,
          phone: client_phone,
        },
      })

      if (createUserError || !newUser.user) {
        return NextResponse.json(
          { error: `Erro ao criar utilizador: ${createUserError?.message}` },
          { status: 500 }
        )
      }
      clientUserId = newUser.user.id
    }

    // ──────────────────────────────────────────────
    // 5. UPSERT CLIENT IN BOTH PROFILE TABLES
    // ──────────────────────────────────────────────
    const { error: profileErr } = await adminClient.from('profiles').upsert({
      id: clientUserId,
      full_name: client_name,
      email: client_email,
      phone: client_phone,
      role: 'client',
      preferred_language,
    }, { onConflict: 'id' })

    if (profileErr) {
      console.error('[CREATE_CASE] Erro no form profiles:', profileErr)
      // Se falhar o perfil, ainda tentamos prosseguir mas algo está errado na BD.
    }

    const { error: userProfileErr } = await adminClient.from('user_profiles').upsert({
      id: clientUserId,
      tenant_id: tenantId,
      full_name: client_name,
      email: client_email,
      phone: client_phone,
      role: 'client',
      preferred_language,
    }, { onConflict: 'id' })

    if (userProfileErr) {
      console.error('[CREATE_CASE] Erro no form user_profiles:', userProfileErr)
    }

    // ──────────────────────────────────────────────
    // 6. CREATE THE CASE
    // ──────────────────────────────────────────────
    const { data: newCase, error: caseError } = await adminClient
      .from('cases')
      .insert({
        tenant_id: tenantId,
        client_id: clientUserId,
        assigned_to: user.id,
        case_type,
        status: 'pending_onboarding',
        personal_data: { full_name: client_name, email: client_email, phone: client_phone },
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

    // ──────────────────────────────────────────────
    // 7. CREATE REQUIRED CASE DOCUMENTS
    // ──────────────────────────────────────────────
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

    // ──────────────────────────────────────────────
    // 8. UPLOAD I-140 PDF (if provided)
    // ──────────────────────────────────────────────
    let uploadedFilePath: string | null = null

    if (i140_file && i140_file.size > 0) {
      const buffer = Buffer.from(await i140_file.arrayBuffer())
      const filePath = `cases/${caseId}/i140-source/${Date.now()}_${i140_file.name}`

      const { error: uploadError } = await adminClient.storage
        .from('documents')
        .upload(filePath, buffer, {
          contentType: i140_file.type || 'application/pdf',
          upsert: false,
        })

      if (!uploadError) {
        uploadedFilePath = filePath

        // Store reference in client_documents for traceability
        await adminClient.from('client_documents').insert({
          tenant_id: tenantId,
          client_id: clientUserId,
          file_path: filePath,
          file_name: i140_file.name,
          file_size: i140_file.size,
          mime_type: i140_file.type || 'application/pdf',
          document_type: 'i140_source',
          extraction_status: 'pending',
          uploaded_by: user.id,
          notes: `I-140 source uploaded during case creation for case ${caseId}`,
        })

        // TODO: Trigger Anthropic Webhook here
        // await triggerI140Extraction(caseId, filePath)
      } else {
        console.error('I-140 upload failed (non-fatal):', uploadError.message)
      }
    }

    // ──────────────────────────────────────────────
    // 9. SEND INVITE EMAIL VIA RESEND
    // ──────────────────────────────────────────────
    const host = request.headers.get('host') || 'localhost:3000'
    const protocol = request.headers.get('x-forwarded-proto') || 'http'
    const rawBaseUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`
    const baseUrl = rawBaseUrl.startsWith('http') ? rawBaseUrl : `https://${rawBaseUrl}`
    const loginLink = new URL('/login', baseUrl).toString()

    let emailSent = false

    try {
      const subject = preferred_language === 'pt'
        ? `${client_name}, seu passaporte para o caso ${case_type} chegou!`
        : `${client_name}, your access passport for ${case_type} case is here!`

      await sendEmail({
        to: client_email,
        subject,
        react: InviteEmail({
          clientName: client_name,
          clientEmail: client_email,
          caseType: case_type,
          loginLink,
          password: generatedPassword,
          language: preferred_language as 'pt' | 'en',
          documentsCount: docTypes.length,
          documentsList: docTypes,
        }),
      })
      emailSent = true
    } catch (emailErr) {
      // Email failure is non-fatal — case was created successfully
      console.error('Email send failed (non-fatal):', emailErr)
    }

    // ──────────────────────────────────────────────
    // 10. AUDIT LOG
    // ──────────────────────────────────────────────
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
        i140_uploaded: !!uploadedFilePath,
        auth_method: 'boarding_password',
      },
    })

    // ──────────────────────────────────────────────
    // 11. RESPONSE
    // ──────────────────────────────────────────────
    return NextResponse.json({
      success: true,
      caseId,
      tempPassword: generatedPassword,
      loginLink,
      emailSent,
      documentsCreated: docTypes.length,
      i140Uploaded: !!uploadedFilePath,
    })

  } catch (error: any) {
    console.error('Create case error:', error)
    return NextResponse.json(
      { error: `Erro interno: ${error.message}` },
      { status: 500 }
    )
  }
}

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OnboardingWizard from '@/components/onboarding/OnboardingWizard'

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function OnboardingPage({ params }: PageProps) {
    const { id: caseId } = await params

    const supabase = await createClient()

    // 1. Verificar se o usuário está autenticado (via magic link)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        redirect('/login')
    }

    // 2. Buscar dados do caso (sem join em profiles — a FK client_id aponta para user_profiles)
    const { data: caseData, error } = await supabase
        .from('cases')
        .select('*')
        .eq('id', caseId)
        .single()

    if (error || !caseData) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6 text-center" style={{ background: '#0A0E17' }}>
                <p className="text-red-400 font-medium">Ops! Não conseguimos encontrar este caso. Verifique o link e tente novamente.</p>
            </div>
        )
    }

    // 3. Segurança: garantir que o caso pertence ao usuário logado
    if (caseData.client_id !== user.id) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6 text-center" style={{ background: '#0A0E17' }}>
                <p className="text-red-400 font-medium">Acesso negado. Este caso não pertence à sua conta.</p>
            </div>
        )
    }

    // 4. Buscar nome do cliente via user_profiles (tabela correta ligada por FK)
    let clientName = 'Cliente'
    const { data: profileData } = await supabase
        .from('user_profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

    if (profileData?.full_name) {
        clientName = profileData.full_name
    } else {
        // Fallback: tentar na tabela profiles (criada no auth callback)
        const { data: legacyProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single()
        if (legacyProfile?.full_name) {
            clientName = legacyProfile.full_name
        }
    }

    // 5. Se o caso já saiu do onboarding, manda pro dashboard do caso
    if (caseData.status !== 'pending_onboarding' && caseData.status !== 'in_progress' && caseData.status !== 'documents_pending') {
        redirect(`/case/${caseId}`)
    }

    return (
        <OnboardingWizard
            caseId={caseId}
            clientName={clientName}
            caseType={caseData.case_type}
        />
    )
}

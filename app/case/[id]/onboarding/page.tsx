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
        // Se não estiver logado, redireciona para login (Supabase cuidará do magic link)
        redirect('/login')
    }

    // 2. Buscar dados do caso e do perfil
    const { data: caseData, error } = await supabase
        .from('cases')
        .select(`
      *,
      profiles!client_id (full_name)
    `)
        .eq('id', caseId)
        .single()

    if (error || !caseData) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6 text-center" style={{ background: '#0A0E17' }}>
                <p className="text-red-400 font-medium">Ops! Não conseguimos encontrar este caso. Verifique o link e tente novamente.</p>
            </div>
        )
    }

    // Se o caso já saiu do onboarding, manda pro dashboard
    if (caseData.status !== 'pending_onboarding' && caseData.status !== 'active') {
        // redirect('/dashboard')
    }

    const clientName = (caseData as any).profiles?.full_name || 'Cliente'

    return (
        <OnboardingWizard
            caseId={caseId}
            clientName={clientName}
            caseType={caseData.case_type}
        />
    )
}

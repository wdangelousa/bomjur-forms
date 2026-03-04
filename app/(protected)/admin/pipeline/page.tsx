import CasePipeline from '@/components/admin/CasePipeline'
import { Kanban } from 'lucide-react'

export const metadata = {
    title: 'Pipeline de Casos | Proexpand',
    description: 'Visualização Kanban dos processos ativos',
}

export default function AdminPipelinePage() {
    return (
        <div className="p-6 lg:p-8 max-w-full overflow-x-hidden space-y-6">
            <header className="flex flex-col md:flex-row justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Kanban className="text-bomjur-lime" /> Pipeline de Casos
                    </h1>
                    <p className="text-bomjur-muted mt-1">Gerencie e mova casos da sua equipe através das etapas.</p>
                </div>
            </header>

            {/* The Kanban Board logic handles its own Supabase fetching */}
            <CasePipeline />
        </div>
    )
}

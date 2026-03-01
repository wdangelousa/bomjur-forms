// Rota raiz (/) — redireciona usuários para o fluxo correto via login.
// A página de upload legada foi removida nesta entrega.
// O middleware em src/middleware.ts cuida de redirecionar usuários
// já autenticados para /admin (tenant_admin) ou /i485 (client).

import { redirect } from 'next/navigation'

export default function RootPage() {
    redirect('/login')
}
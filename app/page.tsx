import { redirect } from 'next/navigation'

// Raiz da aplicação — SEMPRE redireciona para /login
// O proxy NÃO interfere com esta rota (/ não é rota privada)
export default function Home() {
  redirect('/login')
}

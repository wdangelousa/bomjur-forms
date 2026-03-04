# Bomjur Forms 🚀

Plataforma inteligente de documentação e imigração desenvolvida para a **Proexpand**.

## 🏗️ Arquitetura Técnica

O Bomjur Forms utiliza uma stack moderna focada em performance, segurança e experiência do usuário (UX):

- **Framework**: Next.js 14 (App Router)
- **Backend/DB**: Supabase (PostgreSQL, Auth, Realtime, Storage)
- **IA**: Anthropic (Extração de dados e validação de documentos)
- **E-mail**: Resend (Notificações automáticas bilingues)
- **UI/UX**: Tailwind CSS, Framer Motion (Animações Premium)
- **PWA**: Instalável em dispositivos móveis com suporte offline básico.

## 🛠️ Instalação e Setup

1. **Clonar o repositório:**
   ```bash
   git clone [url-do-repo]
   cd bomjur-forms
   ```

2. **Instalar dependências:**
   ```bash
   npm install
   ```

3. **Configurar Variáveis de Ambiente:**
   Copie o arquivo `.env.example` para `.env.local` e preencha com as suas chaves.
   ```bash
   cp .env.example .env.local
   ```

4. **Rodar em desenvolvimento:**
   ```bash
   npm run dev
   ```

## 🧠 Fluxos Inteligentes

### 1. Processamento de Documentos (IA)
Logo após o upload de um ficheiro (Passaporte, Certidão, etc.), o sistema dispara a API `/api/process-document`. Esta utiliza modelos da **Anthropic** para ler o documento e extrair dados críticos (Nomes, Datas), fornecendo feedback visual imediato ao cliente.

### 2. Geração de PDFs (USCIS)
Para converter o progresso do cliente em formulários oficiais:
- O motor `src/lib/pdf/filler.ts` mapeia o JSON de dados do caso para os campos dos formulários `I-485` e `I-140`.
- Os PDFs são gerados no servidor e guardados de forma segura no Supabase Storage.

## 🔐 Segurança

O projeto segue as melhores práticas de segurança:
- **RLS (Row Level Security)**: Total isolamento de dados entre clientes.
- **Service Role**: Operações administrativas protegidas no lado do servidor.
- **Headers de Segurança**: CSP, HSTS e X-Frame-Options configurados via `vercel.json`.

---
Desenvolvido com ❤️ para Walter D'Angelo e Proexpand.

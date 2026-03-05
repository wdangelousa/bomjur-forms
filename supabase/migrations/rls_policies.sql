-- ============================================================
-- Migração: Políticas de Row Level Security (RLS)
-- Roles: tenant_admin (escritório/PROEX) | client (imigrante)
-- ============================================================
-- Execute este script no Supabase Dashboard:
-- SQL Editor → New Query → cole o conteúdo abaixo → Run
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- FUNÇÃO AUXILIAR: retorna o role do usuário logado
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ────────────────────────────────────────────────────────────
-- FUNÇÃO AUXILIAR: retorna o tenant_id do usuário logado
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;


-- ============================================================
-- FIX: Evitar Infinite Recursion nas tabelas Base (profiles e user_profiles)
-- ============================================================
DROP POLICY IF EXISTS "Admin read all profiles" ON public.profiles;
CREATE POLICY "Admin read all profiles" ON public.profiles 
FOR SELECT USING (
  auth.uid() = id OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
CREATE POLICY "Users can view own profile" ON public.user_profiles
FOR SELECT USING (
  auth.uid() = id OR public.get_user_role() = 'team' OR public.get_user_role() = 'super_admin'
);

-- ============================================================
-- TABELA: i140_petitions
-- ============================================================
ALTER TABLE public.i140_petitions ENABLE ROW LEVEL SECURITY;

-- tenant_admin vê TODAS as petições do seu tenant
DROP POLICY IF EXISTS "tenant_admin_select_i140" ON public.i140_petitions;
CREATE POLICY "tenant_admin_select_i140"
  ON public.i140_petitions FOR SELECT
  USING (
    public.get_user_role() = 'tenant_admin'
    AND tenant_id = public.get_user_tenant_id()
  );

-- tenant_admin pode inserir petições para o seu tenant
DROP POLICY IF EXISTS "tenant_admin_insert_i140" ON public.i140_petitions;
CREATE POLICY "tenant_admin_insert_i140"
  ON public.i140_petitions FOR INSERT
  WITH CHECK (
    public.get_user_role() = 'tenant_admin'
    AND tenant_id = public.get_user_tenant_id()
  );

-- tenant_admin pode atualizar petições do seu tenant
DROP POLICY IF EXISTS "tenant_admin_update_i140" ON public.i140_petitions;
CREATE POLICY "tenant_admin_update_i140"
  ON public.i140_petitions FOR UPDATE
  USING (
    public.get_user_role() = 'tenant_admin'
    AND tenant_id = public.get_user_tenant_id()
  );

-- client vê APENAS a petição vinculada a si mesmo
DROP POLICY IF EXISTS "client_select_own_i140" ON public.i140_petitions;
CREATE POLICY "client_select_own_i140"
  ON public.i140_petitions FOR SELECT
  USING (
    public.get_user_role() = 'client'
    AND created_by = auth.uid()
  );


-- ============================================================
-- TABELA: client_documents
-- ============================================================
ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;

-- tenant_admin vê todos os documentos do seu tenant
DROP POLICY IF EXISTS "tenant_admin_select_documents" ON public.client_documents;
CREATE POLICY "tenant_admin_select_documents"
  ON public.client_documents FOR SELECT
  USING (
    public.get_user_role() = 'tenant_admin'
    AND tenant_id = public.get_user_tenant_id()
  );

-- tenant_admin pode inserir documentos
DROP POLICY IF EXISTS "tenant_admin_insert_documents" ON public.client_documents;
CREATE POLICY "tenant_admin_insert_documents"
  ON public.client_documents FOR INSERT
  WITH CHECK (public.get_user_role() = 'tenant_admin');

-- client vê APENAS seus próprios documentos
DROP POLICY IF EXISTS "client_select_own_documents" ON public.client_documents;
CREATE POLICY "client_select_own_documents"
  ON public.client_documents FOR SELECT
  USING (
    public.get_user_role() = 'client'
    AND uploaded_by = auth.uid()
  );

-- client pode fazer upload de documentos
DROP POLICY IF EXISTS "client_insert_own_documents" ON public.client_documents;
CREATE POLICY "client_insert_own_documents"
  ON public.client_documents FOR INSERT
  WITH CHECK (
    public.get_user_role() = 'client'
    AND uploaded_by = auth.uid()
  );


-- ============================================================
-- TABELA: extracted_fields
-- ============================================================
ALTER TABLE public.extracted_fields ENABLE ROW LEVEL SECURITY;

-- tenant_admin vê campos extraídos de documentos do seu tenant
DROP POLICY IF EXISTS "tenant_admin_select_fields" ON public.extracted_fields;
CREATE POLICY "tenant_admin_select_fields"
  ON public.extracted_fields FOR SELECT
  USING (
    public.get_user_role() = 'tenant_admin'
    AND EXISTS (
      SELECT 1 FROM public.client_documents cd
      WHERE cd.id = extracted_fields.document_id
        AND cd.tenant_id = public.get_user_tenant_id()
    )
  );

-- client vê campos dos seus próprios documentos
DROP POLICY IF EXISTS "client_select_own_fields" ON public.extracted_fields;
CREATE POLICY "client_select_own_fields"
  ON public.extracted_fields FOR SELECT
  USING (
    public.get_user_role() = 'client'
    AND EXISTS (
      SELECT 1 FROM public.client_documents cd
      WHERE cd.id = extracted_fields.document_id
        AND cd.uploaded_by = auth.uid()
    )
  );

-- ============================================================
-- NOTA: As APIs Routes (process-document, fast-track) e Server
-- Actions (i140Actions) usam SUPABASE_SERVICE_ROLE_KEY e
-- bypassam o RLS intencionalmente — isso é seguro porque esses
-- endpoints são protegidos pelo Next.js middleware.
-- ============================================================

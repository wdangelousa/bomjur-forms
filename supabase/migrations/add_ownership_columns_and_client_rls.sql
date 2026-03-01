-- ============================================================
-- Migração: Colunas de propriedade + Políticas RLS para clients
-- Executada em: 2026-03-01
-- ============================================================
-- Esta migração:
-- 1. Adiciona created_by em i140_petitions (vincula petição ao user)
-- 2. Adiciona uploaded_by em client_documents (vincula doc ao user)
-- 3. Cria políticas RLS para o role 'client'
-- NOTA: A função get_user_role() e as políticas tenant_admin já
--       existiam no banco e não foram alteradas.
-- ============================================================

-- Passo 1: Coluna de proprietário em i140_petitions
ALTER TABLE public.i140_petitions
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Passo 2: Coluna de proprietário em client_documents
ALTER TABLE public.client_documents
  ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES auth.users(id);

-- Passo 3: Políticas CLIENT

-- i140_petitions: client vê apenas as suas
DROP POLICY IF EXISTS "client_select_own_i140" ON public.i140_petitions;
CREATE POLICY "client_select_own_i140"
  ON public.i140_petitions FOR SELECT
  USING (
    public.get_user_role() = 'client'
    AND created_by = auth.uid()
  );

-- client_documents: client vê os seus
DROP POLICY IF EXISTS "client_select_own_documents" ON public.client_documents;
CREATE POLICY "client_select_own_documents"
  ON public.client_documents FOR SELECT
  USING (
    public.get_user_role() = 'client'
    AND uploaded_by = auth.uid()
  );

DROP POLICY IF EXISTS "client_insert_own_documents" ON public.client_documents;
CREATE POLICY "client_insert_own_documents"
  ON public.client_documents FOR INSERT
  WITH CHECK (
    public.get_user_role() = 'client'
    AND uploaded_by = auth.uid()
  );

-- extracted_fields: client vê campos dos seus documentos
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

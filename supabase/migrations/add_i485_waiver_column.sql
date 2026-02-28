-- ============================================================
-- Migração: Adiciona coluna de aceite do Aditivo I-485
-- Tabela: i485_applications
-- ============================================================
-- Execute este script no Supabase Dashboard:
-- SQL Editor → New Query → cole o conteúdo abaixo → Run

ALTER TABLE public.i485_applications
  ADD COLUMN IF NOT EXISTS i485_waiver_accepted_at TIMESTAMPTZ DEFAULT NULL;

-- Comentário descritivo para documentação da coluna
COMMENT ON COLUMN public.i485_applications.i485_waiver_accepted_at IS
  'Timestamp (com timezone) que registra quando o cliente aceitou o Aditivo de Escopo '
  'e Declaração de Diretrizes da PROEX VENTURE LLC antes de iniciar o preenchimento do I-485. '
  'NULL indica que o aceite ainda não foi dado.';

-- Índice para facilitar consultas de registros pendentes de aceite
CREATE INDEX IF NOT EXISTS idx_i485_applications_waiver_pending
  ON public.i485_applications (id)
  WHERE i485_waiver_accepted_at IS NULL;

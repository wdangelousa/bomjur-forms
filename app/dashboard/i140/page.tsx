'use client'

import React, { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'

// ============================================================
// TIPOS — baseados nas tabelas reais do Supabase
// client_documents + extracted_fields (i140_petitions ainda vazia)
// ============================================================
type UserRole = 'super_admin' | 'admin' | 'tenant_admin' | 'client' | null

interface ExtractedDoc {
  id: string                    // client_documents.id
  fileName: string              // file_name
  mimeType: string              // mime_type
  fileSize: number              // file_size
  extractionStatus: string      // extraction_status
  createdAt: string             // created_at
  fields: Record<string, string> // extracted_fields agregados
}

// ============================================================
// DESIGN TOKENS
// ============================================================
const C = {
  bgPage: 'linear-gradient(135deg, #0f0c29 0%, #302b63 60%, #24243e 100%)',
  bgCard: 'rgba(255,255,255,0.05)',
  bgHover: 'rgba(255,255,255,0.08)',
  border: 'rgba(255,255,255,0.08)',
  accent: '#a78bfa',
  accentDk: '#7c3aed',
  text1: '#f1f5f9',
  text2: '#94a3b8',
  text3: '#64748b',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
}
const F = "'Inter', system-ui, sans-serif"

// ============================================================
// HELPERS
// ============================================================
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    completed: { label: 'Extraído', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
    processing: { label: 'Processando', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    pending: { label: 'Pendente', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
    error: { label: 'Erro', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  }
  const s = map[status] ?? map['pending']
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '3px 11px', borderRadius: 20, fontSize: 12, fontWeight: 600,
      color: s.color, background: s.bg, border: `1px solid ${s.color}30`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color }} />
      {s.label}
    </span>
  )
}

const FIELD_LABELS: Record<string, string> = {
  nome_completo: 'Nome Completo',
  data_nascimento: 'Data de Nascimento',
  numero_documento: 'Nº do Documento',
  data_emissao: 'Data de Emissão',
  nacionalidade: 'Nacionalidade',
  naturalidade: 'Naturalidade',
  estado_civil: 'Estado Civil',
  profissao: 'Profissão',
  cpf: 'CPF',
  rg: 'RG',
  passaporte: 'Passaporte',
  data_validade: 'Validade',
  endereco: 'Endereço',
  email: 'E-mail',
  telefone: 'Telefone',
}

// ============================================================
// CARD DE DOCUMENTO
// ============================================================
function DocCard({ doc, expanded, onToggle }: {
  doc: ExtractedDoc
  expanded: boolean
  onToggle: () => void
}) {
  const fieldEntries = Object.entries(doc.fields).filter(([, v]) => v)
  const hasData = fieldEntries.length > 0

  return (
    <div style={{
      background: C.bgCard, border: `1px solid ${expanded ? 'rgba(167,139,250,0.35)' : C.border}`,
      borderRadius: 16, overflow: 'hidden', transition: 'all 0.25s ease',
      boxShadow: expanded ? '0 8px 40px rgba(124,58,237,0.15)' : 'none',
    }}>
      {/* Header */}
      <div
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 16, padding: '18px 22px',
          cursor: 'pointer', background: expanded ? 'rgba(167,139,250,0.06)' : 'transparent',
          transition: 'background 0.2s',
        }}
      >
        {/* Ícone */}
        <div style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: doc.mimeType?.includes('pdf') ? 'rgba(239,68,68,0.12)' : 'rgba(99,102,241,0.12)',
          border: `1px solid ${doc.mimeType?.includes('pdf') ? 'rgba(239,68,68,0.25)' : 'rgba(99,102,241,0.25)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
        }}>
          {doc.mimeType?.includes('pdf') ? '📄' : '🖼️'}
        </div>

        {/* Info principal */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: C.text1, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {doc.fileName || 'Documento sem nome'}
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: C.text3 }}>{fmtBytes(doc.fileSize)}</span>
            <span style={{ fontSize: 12, color: C.text3 }}>·</span>
            <span style={{ fontSize: 12, color: C.text3 }}>{fmtDate(doc.createdAt)}</span>
            {hasData && (
              <>
                <span style={{ fontSize: 12, color: C.text3 }}>·</span>
                <span style={{ fontSize: 12, color: C.accent, fontWeight: 600 }}>{fieldEntries.length} campos extraídos</span>
              </>
            )}
          </div>
        </div>

        {/* Status */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
          {statusBadge(doc.extractionStatus)}
          <span style={{ fontSize: 16, color: C.text3, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
        </div>
      </div>

      {/* Campos extraídos */}
      {expanded && (
        <div style={{ padding: '0 22px 22px', borderTop: `1px solid ${C.border}` }}>
          {hasData ? (
            <>
              <p style={{ fontSize: 11, fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: 1, margin: '18px 0 14px' }}>
                Dados extraídos pela IA
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                {fieldEntries.map(([key, value]) => (
                  <div key={key} style={{
                    background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`,
                    borderRadius: 10, padding: '10px 14px',
                  }}>
                    <p style={{ fontSize: 11, color: C.text3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, margin: '0 0 4px' }}>
                      {FIELD_LABELS[key] ?? key.replace(/_/g, ' ')}
                    </p>
                    <p style={{ fontSize: 14, color: C.text1, margin: 0, fontWeight: 500 }}>{value}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ padding: '24px 0', textAlign: 'center', color: C.text3, fontSize: 13 }}>
              {doc.extractionStatus === 'processing'
                ? '⟳ Extração em andamento...'
                : '📭 Nenhum dado extraído ainda.'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export default function I140Page() {
  const [role, setRole] = useState<UserRole>(null)
  const [docs, setDocs] = useState<ExtractedDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adminName, setAdminName] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function load() {
      try {
        // 1. Pega role e usuário via API segura (bypassa RLS)
        const res = await fetch('/api/auth/role')
        const { role: userRole, tenantId } = await res.json()
        setRole(userRole as UserRole)

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setError('Sessão expirada.'); setLoading(false); return }
        setAdminName(user.email ?? 'Admin')

        const isAdmin = ['super_admin', 'admin', 'tenant_admin'].includes(userRole)

        // 2. Busca documentos
        let query = supabase
          .from('client_documents')
          .select('id, file_name, mime_type, file_size, extraction_status, created_at, tenant_id')
          .order('created_at', { ascending: false })

        // Se for tenant_admin, filtra pelo tenant_id dele
        // (super_admin vê tudo)
        if (userRole === 'tenant_admin' && tenantId) {
          query = query.eq('tenant_id', tenantId)
        }

        const { data: docRows, error: docErr } = await query
        if (docErr) throw new Error(docErr.message)

        if (!docRows || docRows.length === 0) {
          setDocs([])
          setLoading(false)
          return
        }

        // 3. Para cada documento busca os campos extraídos
        const docIds = docRows.map(d => d.id)
        const { data: fieldRows, error: fieldErr } = await supabase
          .from('extracted_fields')
          .select('document_id, field_key, field_value')
          .in('document_id', docIds)

        if (fieldErr) console.warn('extracted_fields error:', fieldErr.message)

        // 4. Agrupa campos por document_id
        const fieldMap: Record<string, Record<string, string>> = {}
        for (const f of fieldRows ?? []) {
          if (!fieldMap[f.document_id]) fieldMap[f.document_id] = {}
          fieldMap[f.document_id][f.field_key] = f.field_value
        }

        // 5. Monta os cards
        const mapped: ExtractedDoc[] = docRows.map(d => ({
          id: d.id,
          fileName: d.file_name ?? 'Documento',
          mimeType: d.mime_type ?? '',
          fileSize: d.file_size ?? 0,
          extractionStatus: d.extraction_status ?? 'pending',
          createdAt: d.created_at,
          fields: fieldMap[d.id] ?? {},
        }))

        setDocs(mapped)
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Renderização ──────────────────────────────────────────────────────────
  const isAdmin = role && ['super_admin', 'admin', 'tenant_admin'].includes(role)
  const extractedCount = docs.filter(d => d.extractionStatus === 'completed').length
  const pendingCount = docs.filter(d => d.extractionStatus === 'processing').length

  return (
    <div style={{ minHeight: '100vh', background: C.bgPage, fontFamily: F }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* ── Header ── */}
      <header style={{
        background: 'rgba(255,255,255,0.04)', borderBottom: `1px solid ${C.border}`,
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <a href="/admin" style={{ textDecoration: 'none', fontSize: 13, color: C.text3, padding: '4px 10px', border: `1px solid ${C.border}`, borderRadius: 8 }}>
              ← Admin
            </a>
            <div style={{ width: 1, height: 20, background: C.border }} />
            <span style={{ fontSize: 16, fontWeight: 700, background: 'linear-gradient(90deg,#a78bfa,#818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Documentos & Extração I-140
            </span>
          </div>
          <span style={{ fontSize: 12, color: C.text3 }}>👤 {adminName}</span>
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>

        {/* ── Métricas ── */}
        {!loading && !error && (
          <div style={{ display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
            {[
              { label: 'Total de Documentos', value: docs.length, icon: '📁', color: '#6366f1' },
              { label: 'Com Dados Extraídos', value: extractedCount, icon: '✅', color: '#22c55e' },
              { label: 'Em Processamento', value: pendingCount, icon: '⟳', color: '#f59e0b' },
              { label: 'Sem Extração', value: docs.length - extractedCount - pendingCount, icon: '⏳', color: '#94a3b8' },
            ].map(m => (
              <div key={m.label} style={{
                flex: '1 1 180px', minWidth: 160,
                background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px',
                display: 'flex', gap: 14, alignItems: 'center',
              }}>
                <span style={{ fontSize: 26 }}>{m.icon}</span>
                <div>
                  <p style={{ fontSize: 26, fontWeight: 800, color: m.color, lineHeight: 1 }}>{m.value}</p>
                  <p style={{ fontSize: 11, color: C.text3, marginTop: 3 }}>{m.label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Cabeçalho da lista ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text1 }}>
              {isAdmin ? 'Documentos recebidos' : 'Seus documentos'}
            </h1>
            <p style={{ fontSize: 13, color: C.text2, marginTop: 4 }}>
              {loading ? 'Carregando...' : `${docs.length} documento${docs.length !== 1 ? 's' : ''} encontrado${docs.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <a href="/upload" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 12,
            background: `linear-gradient(135deg, ${C.accent}, ${C.accentDk})`,
            color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none',
            boxShadow: '0 4px 20px rgba(124,58,237,0.35)',
          }}>
            + Enviar documento
          </a>
        </div>

        {/* ── Estados ── */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: C.text3 }}>
            <div style={{ fontSize: 40, marginBottom: 16, display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</div>
            <p>Carregando documentos...</p>
          </div>
        )}

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: '16px 20px', color: '#f87171', fontSize: 14 }}>
            ⚠️ {error}
          </div>
        )}

        {!loading && !error && docs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: C.text3 }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>📭</div>
            <p style={{ fontSize: 16, color: C.text2, fontWeight: 600, marginBottom: 8 }}>Nenhum documento encontrado</p>
            <p style={{ fontSize: 13 }}>Use o botão "Enviar documento" para começar a extração de dados.</p>
          </div>
        )}

        {/* ── Lista de documentos ── */}
        {!loading && !error && docs.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {docs.map(doc => (
              <DocCard
                key={doc.id}
                doc={doc}
                expanded={expandedId === doc.id}
                onToggle={() => setExpandedId(prev => prev === doc.id ? null : doc.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

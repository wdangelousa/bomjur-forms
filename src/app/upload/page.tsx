'use client'

import { useCallback, useState } from 'react'
import { createClient } from '@/src/lib/supabase/client'

// ─── Tipos ──────────────────────────────────────────────────────────────────

type FilePhase =
    | 'uploading'   // Fazendo upload para o Storage
    | 'analyzing'   // Chamando a Edge Function / Claude Vision
    | 'success'     // Tudo concluído com sucesso
    | 'error'       // Erro em qualquer etapa

interface UploadedFile {
    name: string
    size: number
    phase: FilePhase
    fieldsExtracted?: number
    documentType?: string
    errorMessage?: string
}

// ─── Utilitários ─────────────────────────────────────────────────────────────

function formatBytes(bytes: number, decimals = 2) {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i]
}

function getFileIcon(fileName: string) {
    const ext = fileName.split('.').pop()?.toLowerCase()
    if (ext === 'pdf') return '📄'
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext ?? '')) return '🖼️'
    if (['doc', 'docx'].includes(ext ?? '')) return '📝'
    if (['xls', 'xlsx'].includes(ext ?? '')) return '📊'
    return '📁'
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function UploadPage() {
    const [isDragging, setIsDragging] = useState(false)
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
    const [isUploading, setIsUploading] = useState(false)

    const supabase = createClient()

    // Atualiza os dados de um arquivo específico na lista pelo nome
    const updateFile = (name: string, patch: Partial<UploadedFile>) => {
        setUploadedFiles((prev) =>
            prev.map((f) => (f.name === name ? { ...f, ...patch } : f))
        )
    }

    // ── Pipeline completo para um único arquivo ────────────────────────────────
    const processFile = async (file: File) => {
        const filePath = `uploads/${Date.now()}_${file.name}`

        // ─── ETAPA 1: Upload para o Supabase Storage ────────────────────────────
        const { data: storageData, error: storageError } = await supabase.storage
            .from('bomjur-documents')
            .upload(filePath, file, { cacheControl: '3600', upsert: false })

        if (storageError) {
            updateFile(file.name, {
                phase: 'error',
                errorMessage: `Upload falhou: ${storageError.message}`,
            })
            return
        }

        // ─── ETAPA 2: Obtém a URL pública ────────────────────────────────────────
        const { data: { publicUrl } } = supabase.storage
            .from('bomjur-documents')
            .getPublicUrl(filePath)

        // ─── ETAPA 3: Registra na tabela client_documents ─────────────────────────
        const { data: docRecord, error: dbError } = await supabase
            .from('client_documents')
            .insert({
                file_name: file.name,
                file_path: storageData.path,
                file_url: publicUrl,
                file_size: file.size,
                file_type: file.type,
                bucket_name: 'bomjur-documents',
                processing_status: 'pending',
                uploaded_at: new Date().toISOString(),
            })
            .select('id')
            .single()

        if (dbError || !docRecord) {
            updateFile(file.name, {
                phase: 'error',
                errorMessage: `Registro no banco falhou: ${dbError?.message}`,
            })
            return
        }

        // ─── ETAPA 4: Muda fase para "Analisando com IA" ─────────────────────────
        updateFile(file.name, { phase: 'analyzing' })

        // ─── ETAPA 5: Chama a Edge Function process-document ─────────────────────
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

        const edgeFnUrl = `${supabaseUrl}/functions/v1/process-document`

        let edgeError: string | null = null
        let fieldsExtracted = 0
        let documentType = 'Documento'

        try {
            const response = await fetch(edgeFnUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${supabaseAnonKey}`,
                    'apikey': supabaseAnonKey,
                },
                body: JSON.stringify({ documentId: docRecord.id, filePath: storageData.path }),
            })

            if (!response.ok) {
                const errBody = await response.text()
                edgeError = `Análise falhou (${response.status}): ${errBody}`
            } else {
                // Edge Function returns 202 — processing happens in background.
                // Poll the DB until extraction_status becomes 'extracted' or 'error'.
                const POLL_INTERVAL_MS = 3000
                const POLL_TIMEOUT_MS = 90000
                const deadline = Date.now() + POLL_TIMEOUT_MS

                while (Date.now() < deadline) {
                    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))

                    const { data: doc } = await supabase
                        .from('client_documents')
                        .select('extraction_status, document_type, extraction_error')
                        .eq('id', docRecord.id)
                        .single()

                    if (!doc) continue

                    if (doc.extraction_status === 'extracted') {
                        const { count } = await supabase
                            .from('extracted_fields')
                            .select('id', { count: 'exact', head: true })
                            .eq('document_id', docRecord.id)
                        fieldsExtracted = count ?? 0
                        documentType = doc.document_type ?? 'Documento'
                        break
                    }

                    if (doc.extraction_status === 'error') {
                        edgeError = doc.extraction_error ?? 'Erro desconhecido na extração.'
                        break
                    }
                }

                if (!edgeError && fieldsExtracted === 0 && documentType === 'Documento') {
                    edgeError = 'Tempo limite atingido. O documento foi salvo, mas a análise não concluiu a tempo.'
                }
            }
        } catch (fetchErr) {
            edgeError = `Erro de rede ao chamar a análise: ${String(fetchErr)}`
        }

        // ─── ETAPA 6: Atualiza o status final ────────────────────────────────────
        if (edgeError) {
            updateFile(file.name, {
                phase: 'error',
                errorMessage: edgeError,
            })
        } else {
            updateFile(file.name, {
                phase: 'success',
                fieldsExtracted,
                documentType,
            })
        }
    }

    // ── Dispara o pipeline para múltiplos arquivos ─────────────────────────────
    const handleFiles = useCallback(
        async (files: FileList | File[]) => {
            const fileArray = Array.from(files)
            if (fileArray.length === 0) return

            const newFiles: UploadedFile[] = fileArray.map((f) => ({
                name: f.name,
                size: f.size,
                phase: 'uploading',
            }))

            setUploadedFiles((prev) => [...prev, ...newFiles])
            setIsUploading(true)

            await Promise.all(fileArray.map(processFile))
            setIsUploading(false)
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    )

    const onDrop = useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            e.preventDefault()
            setIsDragging(false)
            handleFiles(e.dataTransfer.files)
        },
        [handleFiles]
    )

    const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const onDragLeave = () => setIsDragging(false)

    const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) handleFiles(e.target.files)
    }

    // ── Contadores de status ───────────────────────────────────────────────────
    const analyzingCount = uploadedFiles.filter((f) => f.phase === 'analyzing').length
    const successCount = uploadedFiles.filter((f) => f.phase === 'success').length
    const errorCount = uploadedFiles.filter((f) => f.phase === 'error').length

    // ── Badge por fase ──────────────────────────────────────────────────────────
    const renderBadge = (file: UploadedFile) => {
        switch (file.phase) {
            case 'uploading':
                return (
                    <span className="badge uploading">
                        <span className="spinner sm" /> Enviando
                    </span>
                )
            case 'analyzing':
                return (
                    <span className="badge analyzing">
                        <span className="spinner sm purple" /> Analisando IA
                    </span>
                )
            case 'success':
                return (
                    <span className="badge success">
                        ✓ {file.fieldsExtracted ?? 0} campos extraídos
                    </span>
                )
            case 'error':
                return <span className="badge error">✕ Erro</span>
        }
    }

    // ─── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="upload-page">
            {/* ── HEADER ── */}
            <header className="header">
                <div className="header-inner">
                    <div className="logo-area">
                        <span className="logo-icon">⚖️</span>
                        <div>
                            <h1 className="logo-title">Bomjur</h1>
                            <p className="logo-sub">Immigration Platform</p>
                        </div>
                    </div>
                    <nav className="nav-pills">
                        <span className="nav-pill active">Upload</span>
                        <span className="nav-pill">Documentos</span>
                        <span className="nav-pill">Status</span>
                    </nav>
                </div>
            </header>

            {/* ── MAIN ── */}
            <main className="main">
                {/* Cabeçalho da seção */}
                <div className="section-header">
                    <div>
                        <h2 className="section-title">Enviar &amp; Analisar Documentos</h2>
                        <p className="section-desc">
                            Faça o upload dos seus documentos de imigração. Nossa IA (Claude Vision)
                            irá analisar e extrair automaticamente todos os campos relevantes.
                        </p>
                    </div>

                    {uploadedFiles.length > 0 && (
                        <div className="stats-row">
                            {analyzingCount > 0 && (
                                <div className="stat-chip purple">
                                    <span className="spinner sm purple" /> {analyzingCount} analisando
                                </div>
                            )}
                            {successCount > 0 && (
                                <div className="stat-chip green">
                                    ✓ {successCount} concluído{successCount !== 1 ? 's' : ''}
                                </div>
                            )}
                            {errorCount > 0 && (
                                <div className="stat-chip red">
                                    ✕ {errorCount} com erro
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── PIPELINE VISUAL ── */}
                <div className="pipeline-row">
                    {[
                        { icon: '⬆️', label: 'Upload Seguro', desc: 'Arquivo enviado com criptografia AES-256' },
                        { icon: '🧠', label: 'Claude Vision', desc: 'IA analisa e extrai campos automaticamente' },
                        { icon: '🗄️', label: 'Banco de Dados', desc: 'Campos salvos com confidence scores' },
                    ].map((step, i) => (
                        <div key={step.label} className="pipeline-step">
                            <div className="pipeline-icon">{step.icon}</div>
                            <div className="pipeline-info">
                                <p className="pipeline-label">{step.label}</p>
                                <p className="pipeline-desc">{step.desc}</p>
                            </div>
                            {i < 2 && <div className="pipeline-arrow">→</div>}
                        </div>
                    ))}
                </div>

                {/* ── DROP ZONE ── */}
                <div
                    className={`drop-zone ${isDragging ? 'dragging' : ''}`}
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                >
                    <div className="drop-icon-ring">
                        <svg className="drop-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                            />
                        </svg>
                    </div>

                    <h3 className="drop-title">
                        {isDragging ? 'Solte os arquivos aqui' : 'Arraste e solte seus documentos'}
                    </h3>
                    <p className="drop-sub">ou clique para selecionar do seu computador</p>

                    <label className="upload-btn">
                        {isUploading ? (
                            <><span className="spinner" /> Processando...</>
                        ) : (
                            <>
                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: 18, height: 18 }}>
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Selecionar Arquivos
                            </>
                        )}
                        <input
                            type="file"
                            multiple
                            className="hidden-input"
                            onChange={onInputChange}
                            disabled={isUploading}
                        />
                    </label>

                    <p className="drop-hint">PDF, JPEG, PNG · Máximo 50 MB por arquivo · Análise automática por IA</p>
                </div>

                {/* ── LISTA DE ARQUIVOS ── */}
                {uploadedFiles.length > 0 && (
                    <div className="file-list">
                        <h3 className="file-list-title">Documentos em Processamento</h3>
                        <div className="file-cards">
                            {uploadedFiles.map((file, i) => (
                                <div key={i} className={`file-card phase-${file.phase}`}>
                                    <div className="file-icon">{getFileIcon(file.name)}</div>
                                    <div className="file-info">
                                        <p className="file-name">{file.name}</p>
                                        <p className="file-size">{formatBytes(file.size)}</p>
                                        {file.phase === 'success' && file.documentType && (
                                            <p className="file-doctype">📋 {file.documentType}</p>
                                        )}
                                        {file.errorMessage && (
                                            <p className="file-error">{file.errorMessage}</p>
                                        )}
                                    </div>

                                    {/* Barra de progresso por fase */}
                                    <div className="file-right">
                                        {renderBadge(file)}
                                        {(file.phase === 'uploading' || file.phase === 'analyzing') && (
                                            <div className="progress-bar">
                                                <div
                                                    className={`progress-fill ${file.phase === 'analyzing' ? 'fill-purple' : 'fill-indigo'}`}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>

            {/* ── ESTILOS INLINE ── */}
            <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .upload-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
          font-family: 'Inter', system-ui, sans-serif;
          color: #e2e8f0;
        }

        /* ── HEADER ── */
        .header {
          background: rgba(255,255,255,0.04);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255,255,255,0.08);
          position: sticky; top: 0; z-index: 100;
        }
        .header-inner {
          max-width: 1100px; margin: 0 auto;
          padding: 0 24px; height: 64px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .logo-area { display: flex; align-items: center; gap: 12px; }
        .logo-icon { font-size: 28px; }
        .logo-title {
          font-size: 20px; font-weight: 700;
          background: linear-gradient(90deg, #a78bfa, #818cf8);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .logo-sub { font-size: 11px; color: #94a3b8; margin-top: 1px; }
        .nav-pills { display: flex; gap: 8px; }
        .nav-pill {
          padding: 6px 16px; border-radius: 999px;
          font-size: 13px; color: #94a3b8; cursor: pointer; transition: all 0.2s;
        }
        .nav-pill:hover { color: #e2e8f0; background: rgba(255,255,255,0.06); }
        .nav-pill.active {
          background: rgba(139,92,246,0.2); color: #a78bfa;
          border: 1px solid rgba(139,92,246,0.4);
        }

        /* ── MAIN ── */
        .main {
          max-width: 1100px; margin: 0 auto;
          padding: 48px 24px 80px;
          display: flex; flex-direction: column; gap: 28px;
        }

        /* ── SECTION HEADER ── */
        .section-header {
          display: flex; align-items: flex-start;
          justify-content: space-between; flex-wrap: wrap; gap: 16px;
        }
        .section-title { font-size: 28px; font-weight: 700; color: #f1f5f9; }
        .section-desc { margin-top: 8px; font-size: 15px; color: #94a3b8; max-width: 580px; }
        .stats-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .stat-chip {
          display: flex; align-items: center; gap: 6px;
          padding: 6px 14px; border-radius: 999px;
          font-size: 13px; font-weight: 600;
        }
        .stat-chip.green { background: rgba(16,185,129,0.15); color: #34d399; border: 1px solid rgba(16,185,129,0.3); }
        .stat-chip.red { background: rgba(239,68,68,0.15); color: #f87171; border: 1px solid rgba(239,68,68,0.3); }
        .stat-chip.purple { background: rgba(139,92,246,0.15); color: #a78bfa; border: 1px solid rgba(139,92,246,0.3); display: flex; align-items: center; gap: 6px; }

        /* ── PIPELINE ── */
        .pipeline-row {
          display: flex; align-items: center; gap: 0;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px; padding: 18px 24px;
          flex-wrap: wrap;
        }
        .pipeline-step {
          display: flex; align-items: center; gap: 12px; flex: 1; min-width: 200px;
        }
        .pipeline-icon { font-size: 26px; flex-shrink: 0; }
        .pipeline-info { flex: 1; }
        .pipeline-label { font-size: 13px; font-weight: 700; color: #e2e8f0; }
        .pipeline-desc { font-size: 11px; color: #64748b; margin-top: 2px; }
        .pipeline-arrow { font-size: 20px; color: #4b5563; padding: 0 16px; }

        /* ── DROP ZONE ── */
        .drop-zone {
          background: rgba(255,255,255,0.03);
          border: 2px dashed rgba(139,92,246,0.35);
          border-radius: 24px; padding: 60px 32px;
          display: flex; flex-direction: column; align-items: center;
          text-align: center; gap: 16px;
          transition: all 0.25s ease;
        }
        .drop-zone.dragging {
          border-color: #a78bfa;
          background: rgba(139,92,246,0.08);
          transform: scale(1.01);
          box-shadow: 0 0 60px rgba(139,92,246,0.2);
        }
        .drop-icon-ring {
          width: 80px; height: 80px; border-radius: 50%;
          background: rgba(139,92,246,0.15);
          display: flex; align-items: center; justify-content: center;
          border: 1px solid rgba(139,92,246,0.3);
        }
        .drop-icon { width: 36px; height: 36px; color: #a78bfa; }
        .drop-title { font-size: 20px; font-weight: 600; color: #f1f5f9; }
        .drop-sub { font-size: 14px; color: #64748b; }
        .upload-btn {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 12px 28px;
          background: linear-gradient(135deg, #7c3aed, #4f46e5);
          color: #fff; font-size: 14px; font-weight: 600;
          border-radius: 12px; cursor: pointer; transition: all 0.2s;
          box-shadow: 0 4px 24px rgba(124,58,237,0.4); margin-top: 8px;
        }
        .upload-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(124,58,237,0.5); }
        .hidden-input { display: none; }
        .drop-hint { font-size: 12px; color: #475569; }

        /* ── FILE LIST ── */
        .file-list-title { font-size: 16px; font-weight: 600; color: #cbd5e1; margin-bottom: 12px; }
        .file-cards { display: flex; flex-direction: column; gap: 10px; }
        .file-card {
          display: flex; align-items: center; gap: 14px;
          padding: 16px 20px;
          background: rgba(255,255,255,0.04);
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.07);
          transition: all 0.2s;
        }
        .file-card.phase-analyzing {
          border-color: rgba(139,92,246,0.3);
          background: rgba(139,92,246,0.06);
        }
        .file-card.phase-success {
          border-color: rgba(16,185,129,0.25);
          background: rgba(16,185,129,0.05);
        }
        .file-card.phase-error {
          border-color: rgba(239,68,68,0.25);
          background: rgba(239,68,68,0.05);
        }
        .file-icon { font-size: 28px; flex-shrink: 0; }
        .file-info { flex: 1; overflow: hidden; }
        .file-name {
          font-size: 14px; font-weight: 600; color: #e2e8f0;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .file-size { font-size: 12px; color: #64748b; margin-top: 2px; }
        .file-doctype { font-size: 12px; color: #a78bfa; margin-top: 4px; font-weight: 500; }
        .file-error { font-size: 12px; color: #f87171; margin-top: 4px; }
        .file-right { flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; gap: 8px; min-width: 150px; }

        /* ── BADGES ── */
        .badge {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 5px 12px; border-radius: 999px;
          font-size: 12px; font-weight: 600;
        }
        .badge.uploading { background: rgba(99,102,241,0.15); color: #818cf8; }
        .badge.analyzing { background: rgba(139,92,246,0.15); color: #a78bfa; }
        .badge.success { background: rgba(16,185,129,0.15); color: #34d399; }
        .badge.error { background: rgba(239,68,68,0.15); color: #f87171; }

        /* ── PROGRESS BAR ── */
        .progress-bar {
          width: 100%; height: 3px;
          background: rgba(255,255,255,0.08);
          border-radius: 999px; overflow: hidden;
        }
        .progress-fill {
          height: 100%; border-radius: 999px;
          animation: progress-anim 1.6s ease-in-out infinite;
        }
        .fill-indigo { background: linear-gradient(90deg, #4f46e5, #818cf8); }
        .fill-purple { background: linear-gradient(90deg, #7c3aed, #c084fc); }
        @keyframes progress-anim {
          0% { width: 5%; margin-left: 0; }
          50% { width: 60%; margin-left: 30%; }
          100% { width: 5%; margin-left: 95%; }
        }

        /* ── SPINNER ── */
        .spinner {
          display: inline-block; width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        .spinner.sm {
          width: 11px; height: 11px; border-width: 1.5px;
          border-color: rgba(129,140,248,0.3);
          border-top-color: #818cf8;
        }
        .spinner.sm.purple {
          border-color: rgba(167,139,250,0.3);
          border-top-color: #a78bfa;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
        </div>
    )
}

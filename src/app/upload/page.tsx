'use client'

import { useCallback, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// ---------- Tipos ----------
interface UploadedFile {
    name: string
    size: number
    status: 'uploading' | 'success' | 'error'
    errorMessage?: string
}

// ---------- Utilitários ----------
function formatBytes(bytes: number, decimals = 2) {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i]
}

function getFileIcon(fileName: string) {
    const ext = fileName.split('.').pop()?.toLowerCase()
    if (['pdf'].includes(ext ?? '')) return '📄'
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext ?? '')) return '🖼️'
    if (['doc', 'docx'].includes(ext ?? '')) return '📝'
    if (['xls', 'xlsx'].includes(ext ?? '')) return '📊'
    return '📁'
}

// ---------- Componente principal ----------
export default function UploadPage() {
    const [isDragging, setIsDragging] = useState(false)
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
    const [isUploading, setIsUploading] = useState(false)

    const supabase = createClient()

    const updateFileStatus = (
        name: string,
        status: UploadedFile['status'],
        errorMessage?: string
    ) => {
        setUploadedFiles((prev) =>
            prev.map((f) => (f.name === name ? { ...f, status, errorMessage } : f))
        )
    }

    const uploadFile = async (file: File) => {
        const filePath = `uploads/${Date.now()}_${file.name}`

        // 1. Faz o upload para o bucket "bomjur-documents"
        const { data: storageData, error: storageError } = await supabase.storage
            .from('bomjur-documents')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false,
            })

        if (storageError) {
            updateFileStatus(file.name, 'error', storageError.message)
            return
        }

        // 2. Obtém a URL pública do arquivo
        const {
            data: { publicUrl },
        } = supabase.storage.from('bomjur-documents').getPublicUrl(filePath)

        // 3. Registra o documento na tabela client_documents
        const { error: dbError } = await supabase.from('client_documents').insert({
            file_name: file.name,
            file_path: storageData.path,
            file_url: publicUrl,
            file_size: file.size,
            file_type: file.type,
            bucket_name: 'bomjur-documents',
            uploaded_at: new Date().toISOString(),
        })

        if (dbError) {
            updateFileStatus(file.name, 'error', dbError.message)
            return
        }

        updateFileStatus(file.name, 'success')
    }

    const handleFiles = useCallback(
        async (files: FileList | File[]) => {
            const fileArray = Array.from(files)
            if (fileArray.length === 0) return

            const newFiles: UploadedFile[] = fileArray.map((f) => ({
                name: f.name,
                size: f.size,
                status: 'uploading',
            }))

            setUploadedFiles((prev) => [...prev, ...newFiles])
            setIsUploading(true)

            await Promise.all(fileArray.map(uploadFile))
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

    const successCount = uploadedFiles.filter((f) => f.status === 'success').length
    const errorCount = uploadedFiles.filter((f) => f.status === 'error').length

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
                {/* Título da seção */}
                <div className="section-header">
                    <div>
                        <h2 className="section-title">Enviar Documentos</h2>
                        <p className="section-desc">
                            Faça o upload dos seus documentos de imigração com segurança.
                            Todos os arquivos são criptografados e armazenados de forma segura.
                        </p>
                    </div>
                    {uploadedFiles.length > 0 && (
                        <div className="stats-row">
                            <div className="stat-chip green">
                                <span>✓</span> {successCount} enviado{successCount !== 1 ? 's' : ''}
                            </div>
                            {errorCount > 0 && (
                                <div className="stat-chip red">
                                    <span>✕</span> {errorCount} com erro
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── DROP ZONE ── */}
                <div
                    className={`drop-zone ${isDragging ? 'dragging' : ''}`}
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                >
                    <div className="drop-icon-ring">
                        <svg
                            className="drop-icon"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                            />
                        </svg>
                    </div>

                    <h3 className="drop-title">
                        {isDragging ? 'Solte os arquivos aqui' : 'Arraste e solte seus arquivos'}
                    </h3>
                    <p className="drop-sub">
                        ou clique para selecionar do seu computador
                    </p>

                    <label className="upload-btn">
                        {isUploading ? (
                            <>
                                <span className="spinner" /> Enviando...
                            </>
                        ) : (
                            <>
                                <svg
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    style={{ width: 18, height: 18 }}
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 4v16m8-8H4"
                                    />
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

                    <p className="drop-hint">
                        PDF, Word, Excel, imagens · Máximo 50 MB por arquivo
                    </p>
                </div>

                {/* ── FILE LIST ── */}
                {uploadedFiles.length > 0 && (
                    <div className="file-list">
                        <h3 className="file-list-title">Arquivos Enviados</h3>
                        <div className="file-cards">
                            {uploadedFiles.map((file, i) => (
                                <div key={i} className={`file-card status-${file.status}`}>
                                    <div className="file-icon">{getFileIcon(file.name)}</div>
                                    <div className="file-info">
                                        <p className="file-name">{file.name}</p>
                                        <p className="file-size">{formatBytes(file.size)}</p>
                                        {file.errorMessage && (
                                            <p className="file-error">{file.errorMessage}</p>
                                        )}
                                    </div>
                                    <div className="file-badge">
                                        {file.status === 'uploading' && (
                                            <span className="badge uploading">
                                                <span className="spinner sm" /> Enviando
                                            </span>
                                        )}
                                        {file.status === 'success' && (
                                            <span className="badge success">✓ Enviado</span>
                                        )}
                                        {file.status === 'error' && (
                                            <span className="badge error">✕ Erro</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── INFO CARDS ── */}
                <div className="info-grid">
                    {[
                        {
                            icon: '🔒',
                            title: 'Segurança',
                            desc: 'Todos os documentos são criptografados em trânsito e em repouso com AES-256.',
                        },
                        {
                            icon: '☁️',
                            title: 'Armazenamento',
                            desc: 'Seus arquivos ficam em servidores redundantes com backup automático diário.',
                        },
                        {
                            icon: '⚡',
                            title: 'Processamento',
                            desc: 'Nossa equipe jurídica é notificada imediatamente após cada upload.',
                        },
                    ].map((card) => (
                        <div key={card.title} className="info-card">
                            <span className="info-icon">{card.icon}</span>
                            <h4 className="info-title">{card.title}</h4>
                            <p className="info-desc">{card.desc}</p>
                        </div>
                    ))}
                </div>
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

        /* HEADER */
        .header {
          background: rgba(255,255,255,0.04);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255,255,255,0.08);
          position: sticky;
          top: 0;
          z-index: 100;
        }
        .header-inner {
          max-width: 1100px;
          margin: 0 auto;
          padding: 0 24px;
          height: 64px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .logo-area {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .logo-icon { font-size: 28px; }
        .logo-title {
          font-size: 20px;
          font-weight: 700;
          background: linear-gradient(90deg, #a78bfa, #818cf8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .logo-sub { font-size: 11px; color: #94a3b8; margin-top: 1px; }
        .nav-pills { display: flex; gap: 8px; }
        .nav-pill {
          padding: 6px 16px;
          border-radius: 999px;
          font-size: 13px;
          color: #94a3b8;
          cursor: pointer;
          transition: all 0.2s;
        }
        .nav-pill:hover { color: #e2e8f0; background: rgba(255,255,255,0.06); }
        .nav-pill.active {
          background: rgba(139,92,246,0.2);
          color: #a78bfa;
          border: 1px solid rgba(139,92,246,0.4);
        }

        /* MAIN */
        .main {
          max-width: 1100px;
          margin: 0 auto;
          padding: 48px 24px 80px;
          display: flex;
          flex-direction: column;
          gap: 32px;
        }

        /* SECTION HEADER */
        .section-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
        }
        .section-title {
          font-size: 28px;
          font-weight: 700;
          color: #f1f5f9;
          line-height: 1.2;
        }
        .section-desc {
          margin-top: 8px;
          font-size: 15px;
          color: #94a3b8;
          max-width: 560px;
        }
        .stats-row { display: flex; gap: 10px; align-items: center; }
        .stat-chip {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 600;
        }
        .stat-chip.green {
          background: rgba(16,185,129,0.15);
          color: #34d399;
          border: 1px solid rgba(16,185,129,0.3);
        }
        .stat-chip.red {
          background: rgba(239,68,68,0.15);
          color: #f87171;
          border: 1px solid rgba(239,68,68,0.3);
        }

        /* DROP ZONE */
        .drop-zone {
          background: rgba(255,255,255,0.03);
          border: 2px dashed rgba(139,92,246,0.35);
          border-radius: 24px;
          padding: 64px 32px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 16px;
          transition: all 0.25s ease;
          cursor: default;
        }
        .drop-zone.dragging {
          border-color: #a78bfa;
          background: rgba(139,92,246,0.08);
          transform: scale(1.01);
          box-shadow: 0 0 60px rgba(139,92,246,0.2);
        }

        .drop-icon-ring {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: rgba(139,92,246,0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(139,92,246,0.3);
        }
        .drop-icon { width: 36px; height: 36px; color: #a78bfa; }

        .drop-title {
          font-size: 20px;
          font-weight: 600;
          color: #f1f5f9;
        }
        .drop-sub { font-size: 14px; color: #64748b; }

        .upload-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 28px;
          background: linear-gradient(135deg, #7c3aed, #4f46e5);
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 24px rgba(124,58,237,0.4);
          margin-top: 8px;
        }
        .upload-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(124,58,237,0.5);
        }
        .hidden-input { display: none; }

        .drop-hint { font-size: 12px; color: #475569; }

        /* FILE LIST */
        .file-list {}
        .file-list-title {
          font-size: 16px;
          font-weight: 600;
          color: #cbd5e1;
          margin-bottom: 12px;
        }
        .file-cards { display: flex; flex-direction: column; gap: 10px; }
        .file-card {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px 20px;
          background: rgba(255,255,255,0.04);
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.07);
          transition: all 0.2s;
        }
        .file-card.status-success {
          border-color: rgba(16,185,129,0.25);
          background: rgba(16,185,129,0.05);
        }
        .file-card.status-error {
          border-color: rgba(239,68,68,0.25);
          background: rgba(239,68,68,0.05);
        }
        .file-icon { font-size: 28px; flex-shrink: 0; }
        .file-info { flex: 1; overflow: hidden; }
        .file-name {
          font-size: 14px;
          font-weight: 600;
          color: #e2e8f0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .file-size { font-size: 12px; color: #64748b; margin-top: 2px; }
        .file-error { font-size: 12px; color: #f87171; margin-top: 4px; }
        .file-badge { flex-shrink: 0; }
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
        }
        .badge.uploading { background: rgba(99,102,241,0.15); color: #818cf8; }
        .badge.success { background: rgba(16,185,129,0.15); color: #34d399; }
        .badge.error { background: rgba(239,68,68,0.15); color: #f87171; }

        /* SPINNER */
        .spinner {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        .spinner.sm {
          width: 11px;
          height: 11px;
          border-width: 1.5px;
          border-top-color: #818cf8;
          border-color: rgba(129,140,248,0.3);
          border-top-color: #818cf8;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* INFO GRID */
        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 16px;
        }
        .info-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          transition: all 0.2s;
        }
        .info-card:hover {
          background: rgba(255,255,255,0.06);
          border-color: rgba(139,92,246,0.25);
          transform: translateY(-3px);
        }
        .info-icon { font-size: 28px; }
        .info-title { font-size: 15px; font-weight: 700; color: #f1f5f9; }
        .info-desc { font-size: 13px; color: #64748b; line-height: 1.6; }
      `}</style>
        </div>
    )
}

'use client';
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// Configuração de conexão com o seu banco Bomjur
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default function UploadPage() {
    const [file, setFile] = useState<File | null>(null);
    const [status, setStatus] = useState('');

    const handleUpload = async () => {
        if (!file) {
            setStatus('Por favor, selecione um documento primeiro.');
            return;
        }
        setStatus('Fazendo upload para o cofre seguro...');

        // 1. Upload do arquivo para o bucket bomjur-documents
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from('bomjur-documents')
            .upload(fileName, file);

        if (uploadError) {
            setStatus(`Erro no upload: ${uploadError.message}`);
            return;
        }

        setStatus('Registrando documento no sistema...');

        // 2. Insere o registro na tabela client_documents
        //    CORREÇÃO: incluídos todos os campos NOT NULL do banco (file_name, file_path, file_type)
        const { data: docData, error: dbError } = await supabase
            .from('client_documents')
            .insert([{
                file_name: file.name,
                file_path: fileName,
                file_url: fileName,
                file_size: file.size,
                file_type: file.type || 'application/octet-stream',
                bucket_name: 'bomjur-documents',
                extraction_status: 'pending',
                uploaded_at: new Date().toISOString(),
            }])
            .select()
            .single();

        if (dbError) {
            setStatus(`Erro ao salvar no banco: ${dbError.message}`);
            return;
        }

        setStatus('Iniciando leitura inteligente com Claude AI...');

        // 3. Aciona a Edge Function (Backend) para extrair os dados
        const { error: fnError } = await supabase.functions.invoke('process-document', {
            body: { documentId: docData.id, filePath: fileName }
        });

        if (fnError) {
            setStatus(`Aviso na extração (a IA pode estar offline): ${fnError.message}`);
            return;
        }

        setStatus('✅ Sucesso! Documento enviado e dados extraídos com sucesso.');
    };

    return (
        <div style={{ padding: '40px', maxWidth: '600px', margin: '40px auto', fontFamily: 'sans-serif', backgroundColor: '#fff', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <h2 style={{ color: '#333', marginBottom: '10px' }}>Documentos de Imigração</h2>
            <p style={{ color: '#666', marginBottom: '30px' }}>Faça o upload do seu passaporte ou formulário. Nossa IA fará a leitura automática.</p>

            <div style={{ border: '2px dashed #0070f3', borderRadius: '8px', padding: '40px', textAlign: 'center', marginBottom: '20px', backgroundColor: '#f9fbfd' }}>
                <input
                    type="file"
                    onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                    style={{ cursor: 'pointer' }}
                />
            </div>

            <button
                onClick={handleUpload}
                style={{ width: '100%', padding: '15px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}
            >
                Enviar e Processar
            </button>

            {status && (
                <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f0f4f8', borderRadius: '5px', color: '#333', fontSize: '14px' }}>
                    {status}
                </div>
            )}
        </div>
    );
}
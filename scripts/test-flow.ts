import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Carrega as variáveis de ambiente do .env.local
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY! // Usando service role para o teste

const supabase = createClient(supabaseUrl, supabaseKey)

async function testFlow() {
    console.log('🚀 Iniciando teste de fluxo "Happy Path"...')

    try {
        // 1. Simular a criação de um novo caso
        const testCase = {
            client_name: 'João Teste Silva',
            case_type: 'I-485 (Adjustment of Status)',
            status: 'draft',
            personal_data: {
                full_name: 'João Teste Silva',
                birth_date: '1990-01-01',
                country_origin: 'BR'
            },
            address_data: {
                street: '123 Test St',
                city: 'Miami',
                state: 'FL',
                zip_code: '33101'
            }
        }

        console.log('--- Passo 1: Inserindo caso de teste na tabela `cases` ---')
        const { data, error } = await supabase
            .from('cases')
            .insert([testCase])
            .select()
            .single()

        if (error) throw error

        console.log('✅ Caso criado com sucesso! ID:', data.id)

        // 2. Validar que o caso pode ser lido
        console.log('--- Passo 2: Validando leitura do caso ---')
        const { data: fetchResult, error: fetchError } = await supabase
            .from('cases')
            .select('*')
            .eq('id', data.id)
            .single()

        if (fetchError) throw fetchError

        if (fetchResult.client_name === testCase.client_name) {
            console.log('✅ Dados validados corretamente na base de dados.')
        } else {
            throw new Error('Dados retornados não coincidem com os inseridos.')
        }

        // 3. Limpeza (Opcional: remover o caso de teste)
        console.log('--- Passo 3: Limpeza de dados de teste ---')
        const { error: deleteError } = await supabase
            .from('cases')
            .delete()
            .eq('id', data.id)

        if (deleteError) throw deleteError
        console.log('✅ Caso de teste removido com sucesso.')

        console.log('\n✨ Teste finalizado com sucesso! Ligação ao Supabase está OK.')

    } catch (err) {
        console.error('\n❌ Erro durante o teste de fluxo:')
        console.error(err)
        process.exit(1)
    }
}

testFlow()

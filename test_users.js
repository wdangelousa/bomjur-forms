const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const SUPABASE_URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1];
const SUPABASE_KEY = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1];

const { createClient } = require('@supabase/supabase-js');
const admin = createClient(SUPABASE_URL, SUPABASE_KEY);

admin.from('profiles').select('*').then(res => {
  console.log('Profiles:', res.data, res.error);
});

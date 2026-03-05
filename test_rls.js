const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const SUPABASE_URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1];
const SUPABASE_KEY = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1];
const ANON_KEY = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1];

const { createClient } = require('@supabase/supabase-js');
const admin = createClient(SUPABASE_URL, SUPABASE_KEY);
const client = createClient(SUPABASE_URL, ANON_KEY);

async function test() {
  // Set password for team member
  const { data: users } = await admin.auth.admin.listUsers();
  const targetUser = users.users.find(u => u.email === 'wdangelo81@outlook.com');
  if (!targetUser) return console.log("User not found");

  await admin.auth.admin.updateUserById(targetUser.id, { password: 'password123' });

  // Login as team
  const { data: authData, error: authErr } = await client.auth.signInWithPassword({ email: 'wdangelo81@outlook.com', password: 'password123' });
  if (authErr) return console.log("Login err", authErr);

  // Check profiles
  const { data: prof, error: profErr } = await client.from('profiles').select('*').eq('id', targetUser.id).single();
  console.log("Client Profile Fetch Error:", profErr);
}
test();

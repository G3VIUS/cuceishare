// supabase.js — Backend (CommonJS), lazy init
const { createClient } = require('@supabase/supabase-js');

let _supabase = null;

function getSupabase() {
  if (_supabase) return _supabase;

  const url = process.env.SUPABASE_URL;
  // usa SERVICE_ROLE_KEY si existe, si no ANON_KEY (útil para dev)
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    const msg = '[Supabase] Faltan credenciales: define SUPABASE_URL y (SUPABASE_SERVICE_ROLE_KEY o SUPABASE_ANON_KEY) en .env';
    console.error(msg);
    throw new Error(msg);
  }

  _supabase = createClient(url, key, {
    auth: { persistSession: false },
    global: { headers: { 'x-app': 'cuceishare-backend' } },
  });

  return _supabase;
}

module.exports = { getSupabase };

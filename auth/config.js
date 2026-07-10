// ─── Supabase Config ──────────────────────
const SUPABASE_URL  = 'https://gnzkwjzssumrnafqrmof.supabase.co';
const SUPABASE_ANON = 'sb_publishable_4O8Oegbf4JCx1nynZiHPlA_N41BvOpR';

// ─── AI Config (keys live server-side in Edge Function) ──
const AI_FUNCTION_URL = SUPABASE_URL + '/functions/v1/generate-checklist';

// ─── Auth Config ──────────────────────────
const AUTH_REDIRECT = () => window.location.origin + '/auth/';

// ─── Supabase Init Options ────────────────
const SUPABASE_OPTIONS = {
  auth: {
    detectSessionInUrl: false,
    flowType: 'pkce',
    persistSession: true,
  }
};

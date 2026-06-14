// ─── State ───────────────────────────────────────────────────────────────
// Central shared state for the app. All modules read/write these variables.

const { createClient } = supabase;

let sb          = null;   // Supabase client instance
let currentUser = null;   // Supabase User object
let parsedData  = null;   // Last parsed markdown import { title, sections }
let checklists  = [];     // [{ id, title, data: [{id, title, items:[{id,label,checked}]}] }]
let activeId    = null;   // ID of the currently displayed checklist
let authView    = 'login';
const DEV       = true;     // Debug logging — set false in production
const WS_STORAGE_KEY = 'quickcheck_workspace_id';

// Workspace state (populated by workspace.js)
let workspaces        = [];
let activeWorkspace   = null;
let sharedChecklists  = [];
let workspaceMembers  = [];
let workspaceActivity = [];
let workspaceRealtime = null;

// ─── Supabase Init ────────────────────────────────────────────────────────

function initSupabase() {
  if (
    SUPABASE_URL  === 'https://YOUR_PROJECT.supabase.co' ||
    SUPABASE_ANON === 'YOUR_ANON_KEY_HERE'
  ) {
    showAuthError('Supabase is not configured. Please set your API keys.');
    return false;
  }

  try {
    sb = createClient(SUPABASE_URL, SUPABASE_ANON, SUPABASE_OPTIONS);
    return true;
  } catch (e) {
    showAuthError('Failed to initialize Supabase: ' + e.message);
    return false;
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────────
// Called once on page load — starts auth detection then either enters the
// app or leaves the user on the sign-in screen.

async function init() {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app-screen').style.display  = 'none';

  const ok = initSupabase();
  if (!ok) return;

  await handleAuthCallback();

  const { data: { session } } = await sb.auth.getSession();

  if (session?.user) {
    currentUser = session.user;
    await enterApp();
  }

  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      currentUser = session.user;
      await enterApp();
    }
    if (event === 'SIGNED_OUT') {
      currentUser = null;
      document.getElementById('auth-screen').style.display = 'flex';
      document.getElementById('app-screen').style.display  = 'none';
    }
  });
}

init();

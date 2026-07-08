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

// Universal visited checklists (tracked via loadChecklist)
let visitedChecklists = []; // [{ id, title, total, checked, lastVisitedAt }]

// Universal cache of ALL checklists (personal + all workspaces) for cross-context search
let universalChecklists = []; // [{ id, title, data, _workspace, _workspaceId }]

// TOTP 2FA — prevents enterApp() race when TOTP verification is required after login
let _totpInProgress = false;
let _pendingTotpLoginUser = null;

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

  // Register auth listener early — before any early return — so it always
  // captures SIGNED_IN/SIGNED_OUT events, even when an invite token is present.
  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      currentUser = session.user;
      if (_totpInProgress) return;
      const token = window.pendingInviteToken || sessionStorage.getItem('quickcheck_invite_token');
      if (token) {
        window.pendingInviteToken = null;
        sessionStorage.removeItem('quickcheck_invite_token');
        await handleInviteToken(token);
        return;
      }
      await enterApp();
    }
    if (event === 'SIGNED_OUT') {
      currentUser = null;
      document.getElementById('auth-screen').style.display = 'flex';
      document.getElementById('app-screen').style.display  = 'none';
      const token = window.pendingInviteToken || sessionStorage.getItem('quickcheck_invite_token');
      if (token) {
        await handleInviteToken(token);
      }
    }
  });

  // Check for workspace invite token in URL (path or query param)
  const inviteMatch = window.location.pathname.match(/\/auth\/invite\/(.+)/);
  const inviteParam = new URLSearchParams(window.location.search).get('invite');
  const token = inviteMatch?.[1] || inviteParam;
  if (token) {
    window.history.replaceState({}, document.title, '/auth/');
    sessionStorage.setItem('quickcheck_invite_token', token);
    window.pendingInviteToken = token;
    if (session?.user) {
      currentUser = session.user;
    }
    await handleInviteToken(token);
    return;
  }

  // Restore pending invite token after OAuth redirect (page reload)
  const savedToken = sessionStorage.getItem('quickcheck_invite_token');
  if (savedToken && !window.pendingInviteToken) {
    window.pendingInviteToken = savedToken;
    if (session?.user) {
      currentUser = session.user;
      await handleInviteToken(savedToken);
      return;
    }
  }

  if (session?.user) {
    var view = new URLSearchParams(window.location.search).get('view');
    if (view === 'recovery' || view === 'forgot' || view === 'forgot-sent') {
      return;
    }
    currentUser = session.user;
    await enterApp();
  }
}

init();

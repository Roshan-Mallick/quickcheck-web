// ─── Auth Views ───────────────────────────────────────────────────────────

/**
 * Switch between auth form panels: login, register, forgot, forgot-sent.
 */
function switchAuthView(view) {
  authView = view;
  const views = ['login', 'register', 'forgot', 'forgot-sent'];
  views.forEach(v => {
    const el = document.getElementById('auth-view-' + v);
    if (el) el.hidden = v !== view;
  });
  const isLoginFlow = view === 'login' || view === 'forgot' || view === 'forgot-sent';
  document.getElementById('auth-tab-login').classList.toggle('active', isLoginFlow);
  document.getElementById('auth-tab-register').classList.toggle('active', view === 'register');
  clearAuthMessages();
}

// ─── Password field helpers ───────────────────────────────────────────────

function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  const show  = input.type === 'password';
  input.type  = show ? 'text' : 'password';
  btn.classList.toggle('showing', show);
  btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
}

function getPasswordStrength(pw) {
  if (!pw.length) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pw.length >= 8)                                 score++;
  if (pw.length >= 12)                                score++;
  if (/[A-Z]/.test(pw) && /[0-9]/.test(pw))          score++;
  if (/[^A-Za-z0-9]/.test(pw))                       score++;
  const labels = ['Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['#f7768e', '#e0af68', '#9ece6a', '#27c93f'];
  return { score, label: labels[score - 1] ?? 'Weak', color: colors[score - 1] ?? colors[0] };
}

function updatePasswordStrength() {
  const pw   = document.getElementById('register-password').value;
  const wrap = document.getElementById('password-strength');
  if (!pw.length) { wrap.hidden = true; return; }
  const s = getPasswordStrength(pw);
  wrap.hidden = false;
  wrap.querySelectorAll('.auth-strength-bars span').forEach((bar, i) => {
    bar.style.background = i < s.score ? s.color : 'rgba(255,255,255,0.08)';
  });
  const lbl      = wrap.querySelector('.auth-strength-label');
  lbl.textContent = s.label;
  lbl.style.color = s.color;
}

function updateRegisterBtn() {
  document.getElementById('register-btn').disabled =
    !document.getElementById('register-agreed').checked;
}

// ─── Session helpers ──────────────────────────────────────────────────────

async function clearStaleAuth() {
  // Do nothing
  return;
}

/**
 * Exchange the OAuth callback code for a session on redirect back from
 * Google / GitHub.
 */
async function handleAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const code   = params.get('code');
  if (!code) return;

  const { error } = await sb.auth.exchangeCodeForSession(code);
  window.history.replaceState({}, document.title, window.location.pathname);

  if (error) {
    await clearStaleAuth();
    showAuthError('GitHub sign-in failed: ' + error.message);
  }
}

// ─── OAuth sign-in ────────────────────────────────────────────────────────

async function signInWithGoogle() {
  if (!sb) {
    showAuthError('Supabase is not configured.');
    return;
  }

  clearAuthMessages();

  const { data, error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: AUTH_REDIRECT() },
  });

  if (error) {
    showAuthError(error.message);
    return;
  }

  if (data?.url) window.location.assign(data.url);
}

async function signInWithGitHub() {
  if (!sb) {
    showAuthError('Supabase is not configured.');
    return;
  }

  clearAuthMessages();

  const { data, error } = await sb.auth.signInWithOAuth({
    provider: 'github',
    options: { redirectTo: AUTH_REDIRECT() },
  });

  if (error) {
    showAuthError(error.message);
    return;
  }

  if (data?.url) window.location.assign(data.url);
}
// ─── Email/password login ─────────────────────────────────────────────────

async function handleLoginSubmit(e) {
  e.preventDefault();
  if (!sb) { showAuthError('Supabase is not configured.'); return; }

  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-password').value;
  if (!email || !pass) { showAuthError('Please fill in all fields.'); return; }

  const btn = document.getElementById('login-btn');
  btn.disabled    = true;
  btn.textContent = 'Signing in…';
  clearAuthMessages();

  try {
    // Check email exists first to give a friendlier error
    const { data: emailExists, error: rpcError } = await sb.rpc('check_email_exists', { input_email: email });
    if (rpcError) { showAuthError('Something went wrong. Please try again.'); return; }
    if (!emailExists) { showAuthError('Email does not exist. Please create a new account.'); return; }

    const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });

    if (error) {
      const msg = error.message?.toLowerCase() || '';
      if (msg.includes('invalid login credentials')) {
        showAuthError('Incorrect password.');
      } else if (msg.includes('email not confirmed')) {
        showAuthError('Please confirm your email before signing in. Check your inbox.');
      } else {
        showAuthError(error.message || 'Authentication failed.');
      }
      return;
    }

    currentUser = data.user;
    await enterApp();

  } catch (err) {
    showAuthError(err.message || 'Authentication failed.');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Sign in';
  }
}

// ─── Register ─────────────────────────────────────────────────────────────

async function handleRegisterSubmit(e) {
  e.preventDefault();
  if (!sb) { showAuthError('Supabase is not configured.'); return; }
  if (!document.getElementById('register-agreed').checked) return;

  const name  = document.getElementById('register-name').value.trim();
  const email = document.getElementById('register-email').value.trim();
  const pass  = document.getElementById('register-password').value;

  if (!name || !email || !pass) { showAuthError('Please fill in all fields.'); return; }
  if (pass.length < 8) { showAuthError('Password must be at least 8 characters.'); return; }

  const btn = document.getElementById('register-btn');
  btn.disabled    = true;
  btn.textContent = 'Creating account…';
  clearAuthMessages();

  try {
    const { data: emailExists, error: rpcError } = await sb.rpc('check_email_exists', { input_email: email });
    if (rpcError) { showAuthError('Something went wrong. Please try again.'); return; }
    if (emailExists) { showAuthError('This email is already registered. Please log in.'); return; }

    const { data, error } = await sb.auth.signUp({
      email,
      password: pass,
      options: {
        emailRedirectTo: AUTH_REDIRECT(),
        data: { full_name: name },
      },
    });

    if (error) { showAuthError(error.message); return; }

    if (data?.user && !data?.session) {
      showAuthMsg('Confirmation email has been sent. Please check your inbox and verify your email.');
      return;
    }

    if (data?.user && data?.session) {
      currentUser = data.user;
      await enterApp();
      return;
    }

    showAuthError('Unexpected registration response.');
  } catch (err) {
    showAuthError(err.message || 'Registration failed.');
  } finally {
    btn.textContent = 'Create account';
    updateRegisterBtn();
  }
}

// ─── Forgot password ──────────────────────────────────────────────────────

async function handleForgotSubmit(e) {
  e.preventDefault();
  if (!sb) { showAuthError('Supabase is not configured.'); return; }

  const email = document.getElementById('forgot-email').value.trim();
  if (!email) { showAuthError('Please enter your email.'); return; }

  const btn = document.getElementById('forgot-btn');
  btn.disabled    = true;
  btn.textContent = 'Sending…';
  clearAuthMessages();

  try {
    const { data: emailExists, error: rpcError } = await sb.rpc('check_email_exists', { input_email: email });
    if (rpcError) { showAuthError('Something went wrong. Please try again.'); return; }
    if (!emailExists) { showAuthError('No account exists with this email address.'); return; }

    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: AUTH_REDIRECT(),
    });
    if (error) throw error;

    switchAuthView('forgot-sent');
  } catch (err) {
    showAuthError(err.message || 'Failed to send reset link.');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Send reset link';
  }
}

// ─── Sign out ─────────────────────────────────────────────────────────────

async function signOut() {
  closeModal('account-modal');
  closeSidebar();
  if (sb) await sb.auth.signOut();
  currentUser = null;
  activeId    = null;
  checklists  = [];
  document.getElementById('app-screen').style.display  = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
  switchAuthView('login');
}

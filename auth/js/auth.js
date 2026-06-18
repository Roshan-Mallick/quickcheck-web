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
  // Update URL param without reloading
  const url = new URL(window.location);
  if (view === 'login') url.searchParams.delete('view');
  else url.searchParams.set('view', view);
  history.replaceState(null, '', url);
}

// On load, respect ?view=register URL param
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');
  if (view && ['login','register','forgot'].includes(view)) {
    switchAuthView(view);
  }
});

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

/**
 * Exchange the OAuth callback code for a session on redirect back from
 * Google / GitHub.
 *
 * If the exchange fails because the email already belongs to a different
 * identity provider, show a clear message so the user knows what to do.
 */
async function handleAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const code   = params.get('code');
  const error  = params.get('error');
  if (!code) {
    if (error) showAuthError('Sign-in was cancelled or failed.');
    return;
  }

  const { error: xcodeError } = await sb.auth.exchangeCodeForSession(code);
  window.history.replaceState({}, document.title, window.location.pathname);

  if (xcodeError) {
    const msg = (xcodeError.message || '').toLowerCase();

    // Detect identity conflict: the email is already used by a different
    // provider and identity linking could not be performed automatically.
    if (msg.includes('identity') || msg.includes('already linked') || msg.includes('already exists') || msg.includes('conflict')) {
      // Try to figure out which provider the user originally signed up from.
      // We extract the email from the code-flow hint or redirect params.
      const email = params.get('email') || '';

      if (email) {
        const providers = await getIdentityProviders(email);
        const hasGoogle = providers.includes('google');
        const hasGithub = providers.includes('github');
        const hasEmail  = providers.includes('email');

        if (hasEmail && !hasGoogle && !hasGithub) {
          showAuthError(
            'An account with this email already exists with email/password. Please sign in with your email and password.'
          );
        } else if (hasGoogle && !hasEmail) {
          showAuthError(
            'This Google account is already linked to a different Quickcheck account. Please sign in with Google.'
          );
        } else if (hasGithub && !hasEmail) {
          showAuthError(
            'This GitHub account is already linked to a different Quickcheck account. Please sign in with GitHub.'
          );
        } else {
          showAuthError(
            'An account with this email already exists. Please sign in with your existing sign-in method (Google, GitHub, or email/password).'
          );
        }
      } else {
        showAuthError(
          'The sign-in attempt failed because this email is already linked to a different sign-in method. Please sign in using the original method (Google, GitHub, or email/password).'
        );
      }
    } else {
      showAuthError('Authentication failed: ' + xcodeError.message);
    }
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

  if (data?.url && data.url.startsWith(SUPABASE_URL)) window.location.assign(data.url);
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

  if (data?.url && data.url.startsWith(SUPABASE_URL)) window.location.assign(data.url);
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
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });

    if (error) {
      const msg = error.message?.toLowerCase() || '';

      if (msg.includes('invalid login credentials')) {
        // Could be wrong password for existing user, or user doesn't exist,
        // or user exists but with OAuth-only. Check if there's a different
        // provider linked to this email.
        const providers = await getIdentityProviders(email);

        if (providers.includes('google')) {
          showAuthError(
            'This email is linked to Google Sign-In. Please continue with Google.'
          );
        } else if (providers.includes('github')) {
          showAuthError(
            'This email is linked to GitHub Sign-In. Please continue with GitHub.'
          );
        } else {
          showAuthError('Invalid email or password.');
        }
      } else if (msg.includes('email not confirmed')) {
        showAuthError('Please confirm your email before signing in. Check your inbox.');
      } else {
        showAuthError('Invalid email or password.');
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

// ─── Provider detection ───────────────────────────────────────────────────
// Checks whether an email already has identities linked to it and returns
// the list of providers (e.g. ["google"], ["github"], ["email"]).
// Falls back to an empty array if the RPC is not available.

async function getIdentityProviders(email) {
  try {
    const { data, error } = await sb.rpc('get_identity_providers', {
      input_email: email,
    });
    if (error) return [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
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
    // ── Check for existing account before attempting signup ──────────
    const { data: emailExists, error: existsError } = await sb.rpc(
      'check_email_exists', { input_email: email }
    );

    if (!existsError && emailExists) {
      const providers = await getIdentityProviders(email);

      const hasEmail  = providers.includes('email');
      const hasGoogle = providers.includes('google');
      const hasGithub = providers.includes('github');

      if (hasGoogle && !hasEmail && !hasGithub) {
        showAuthError(
          'An account with this email already exists and is linked to Google Sign-In. Please continue with Google.'
        );
        return;
      }
      if (hasGithub && !hasEmail && !hasGoogle) {
        showAuthError(
          'An account with this email already exists and is linked to GitHub Sign-In. Please continue with GitHub.'
        );
        return;
      }
      if (hasGoogle && hasEmail) {
        showAuthError(
          'An account with this email already exists. You can sign in with your password or continue with Google.'
        );
        return;
      }
      if (hasGithub && hasEmail) {
        showAuthError(
          'An account with this email already exists. You can sign in with your password or continue with GitHub.'
        );
        return;
      }
      // Generic fallback
      showAuthError(
        'An account with this email already exists. Please sign in instead.'
      );
      return;
    }

    // ── Proceed with signup ─────────────────────────────────────────
    const { data, error } = await sb.auth.signUp({
      email,
      password: pass,
      options: {
        emailRedirectTo: AUTH_REDIRECT(),
        data: { full_name: name },
      },
    });

    if (error) {
      const msg = error.message || '';
      if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already exists')) {
        showAuthError(
          'An account with this email already exists. Please sign in with Google, GitHub, or your password.'
        );
      } else {
        showAuthError(error.message);
      }
      return;
    }

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
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: AUTH_REDIRECT(),
    });
    if (error) throw error;

    switchAuthView('forgot-sent');
  } catch (err) {
    showAuthError('Failed to send reset link. Please try again.');
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

// ─── Auth Views ───────────────────────────────────────────────────────────

/**
 * Switch between auth form panels: login, register, forgot, forgot-sent.
 */
function switchAuthView(view) {
  authView = view;
  const views = ['login', 'register', 'forgot', 'forgot-sent', 'invite', 'recovery', 'recovery-verify', 'recovery-otp', 'recovery-password', 'recovery-success'];
  views.forEach(v => {
    const el = document.getElementById('auth-view-' + v);
    if (el) el.hidden = v !== view;
  });
  const isLoginFlow = view === 'login' || view === 'forgot' || view === 'forgot-sent';
  const isInviteFlow = view === 'invite';
  const isRecoveryFlow = view === 'recovery' || view === 'recovery-verify' || view === 'recovery-otp' || view === 'recovery-password' || view === 'recovery-success';
  document.getElementById('auth-tab-login').classList.toggle('active', isLoginFlow);
  document.getElementById('auth-tab-register').classList.toggle('active', view === 'register');
  document.getElementById('auth-tab-login').style.display = (isInviteFlow || isRecoveryFlow) ? 'none' : '';
  document.getElementById('auth-tab-register').style.display = (isInviteFlow || isRecoveryFlow) ? 'none' : '';
  clearAuthMessages();
  if (!isInviteFlow && !isRecoveryFlow) {
    const url = new URL(window.location);
    if (view === 'login') url.searchParams.delete('view');
    else url.searchParams.set('view', view);
    history.replaceState(null, '', url);
  }
}

// On load, respect ?view=register URL param
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');
  if (view && ['login','register','forgot','recovery'].includes(view)) {
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

    // ── Admin emails cannot use the QuickCheck dashboard ──────────────
    const { data: isAdminLogin } = await sb.rpc('is_admin_email', {
      check_email: currentUser.email,
    });
    if (isAdminLogin) {
      await sb.auth.signOut();
      currentUser = null;
      showAuthError('This email is registered as an admin and cannot sign in to Quickcheck. Please use the Admin Panel instead.');
      btn.disabled = false;
      btn.textContent = 'Sign in';
      return;
    }

    if (window.pendingInviteToken) {
      const token = window.pendingInviteToken;
      window.pendingInviteToken = null;
      sessionStorage.removeItem('quickcheck_invite_token');
      await handleInviteToken(token);
      return;
    }

    // Check if TOTP 2FA is enabled
    let totpEnabled = false;
    try {
      const { data } = await sb.rpc('has_totp_enabled');
      totpEnabled = !!data;
    } catch {}
    if (totpEnabled) {
      // Skip TOTP if device was trusted within the last 30 days
      const trusted = localStorage.getItem('quickcheck_totp_trusted');
      if (trusted) {
        try {
          const parsed = JSON.parse(trusted);
          if (parsed.expires > Date.now()) {
            await enterApp();
            return;
          }
        } catch {}
      }

      _totpInProgress = true;
      _pendingTotpLoginUser = currentUser;
      document.getElementById('totp-login-token').value = '';
      document.getElementById('totp-login-error').textContent = '';
      document.getElementById('totp-login-error').style.display = 'none';
      document.getElementById('totp-login-recovery-group').style.display = 'none';
      document.getElementById('totp-login-verify-btn').style.display = '';
      document.getElementById('totp-login-recover-btn').style.display = '';
      document.getElementById('totp-login-desc').textContent = 'Enter the 6-digit code from your authenticator app.';
      document.getElementById('totp-login-modal').classList.add('open');
      document.getElementById('totp-login-token').focus();
      return;
    }

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
    // ── Check if this email is the admin email — admins cannot register ──
    const { data: isAdmin } = await sb.rpc('is_admin_email', {
      check_email: email,
    });

    if (isAdmin) {
      showAuthError('This email is registered as an admin and cannot create a Quickcheck account.');
      return;
    }

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
      if (window.pendingInviteToken) {
        const token = window.pendingInviteToken;
        window.pendingInviteToken = null;
        await handleInviteToken(token);
        return;
      }
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

// ─── Account Recovery ───────────────────────────────────────────────────

let _recoveryPrimaryEmail = null;
let _recoveryResetToken = null;

function backToRecoveryStep1() {
  switchAuthView('recovery');
}

function backToRecoveryVerify() {
  switchAuthView('recovery-verify');
}

async function handleRecoverySubmit(e) {
  e.preventDefault();
  const email = document.getElementById('recovery-email').value.trim();
  const btn = document.getElementById('recovery-submit-btn');

  if (!email) return;

  btn.disabled = true;
  btn.textContent = 'Checking…';

  try {
    const { data, error } = await sb.rpc('check_recovery_email_exists', { primary_email: email });
    if (error) throw error;

    if (!data?.[0]?.has_recovery) {
      showAuthError('No recovery email found for this account. Please use the standard password reset.');
      btn.disabled = false;
      btn.textContent = 'Recover Account';
      return;
    }

    _recoveryPrimaryEmail = email;
    switchAuthView('recovery-verify');
  } catch (err) {
    showAuthError(err.message || 'Failed to check account.');
    btn.disabled = false;
    btn.textContent = 'Recover Account';
  }
}

async function handleRecoveryVerify(e) {
  e.preventDefault();
  const recoveryEmail = document.getElementById('recovery-verify-email').value.trim();
  const errEl = document.getElementById('recovery-verify-error');
  const btn = document.getElementById('recovery-verify-btn');

  if (!recoveryEmail || !_recoveryPrimaryEmail) return;

  errEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Verifying…';

  try {
    const { data: match, error: matchError } = await sb.rpc('verify_recovery_email_match', {
      primary_email: _recoveryPrimaryEmail,
      recovery_email: recoveryEmail,
    });
    if (matchError) throw matchError;

    if (!match) {
      errEl.textContent = 'The recovery email does not match our records.';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Verify Recovery Email';
      return;
    }

    // Initiate recovery — sends OTP to the recovery email
    const { data: initResult, error: initError } = await sb.rpc('initiate_recovery', {
      primary_email: _recoveryPrimaryEmail,
      recovery_email: recoveryEmail,
    });
    if (initError) throw initError;

    if (!initResult.success) {
      errEl.textContent = initResult.error || 'Failed to send OTP.';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Verify Recovery Email';
      return;
    }

    document.getElementById('recovery-otp-email-display').textContent = recoveryEmail;
    switchAuthView('recovery-otp');
  } catch (err) {
    errEl.textContent = err.message || 'Verification failed.';
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Verify Recovery Email';
  }
}

async function handleRecoveryOtp(e) {
  e.preventDefault();
  const otp = document.getElementById('recovery-otp-code').value.trim();
  const errEl = document.getElementById('recovery-otp-error');
  const btn = document.getElementById('recovery-otp-btn');

  if (!otp || !_recoveryPrimaryEmail) return;

  errEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Verifying…';

  try {
    const { data, error } = await sb.rpc('verify_recovery_otp', {
      primary_email: _recoveryPrimaryEmail,
      otp,
    });
    if (error) throw error;

    if (!data.success) {
      errEl.textContent = data.error || 'Invalid or expired code.';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Verify Code';
      return;
    }

    _recoveryResetToken = data.reset_token;
    switchAuthView('recovery-password');
  } catch (err) {
    errEl.textContent = err.message || 'Verification failed.';
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Verify Code';
  }
}

async function handleRecoveryPassword(e) {
  e.preventDefault();
  const pw = document.getElementById('recovery-new-password').value;
  const confirmPw = document.getElementById('recovery-confirm-password').value;
  const errEl = document.getElementById('recovery-password-error');
  const btn = document.getElementById('recovery-password-btn');

  errEl.style.display = 'none';

  if (pw.length < 6) {
    errEl.textContent = 'Password must be at least 6 characters.';
    errEl.style.display = 'block';
    return;
  }

  if (pw !== confirmPw) {
    errEl.textContent = 'Passwords do not match.';
    errEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Resetting…';

  try {
    const { data, error } = await sb.rpc('reset_password_with_token', {
      p_reset_token: _recoveryResetToken,
      new_password: pw,
    });
    if (error) throw error;

    if (!data.success) {
      errEl.textContent = data.error || 'Failed to reset password.';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Reset Password';
      return;
    }

    _recoveryPrimaryEmail = null;
    _recoveryResetToken = null;
    switchAuthView('recovery-success');
  } catch (err) {
    errEl.textContent = err.message || 'Failed to reset password.';
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Reset Password';
  }
}

// ─── TOTP Login Verification ───────────────────────────────────────────

async function handleTotpLoginVerify() {
  const token = document.getElementById('totp-login-token').value.trim();
  const errEl = document.getElementById('totp-login-error');
  errEl.style.display = 'none';

  if (!token || token.length !== 6) {
    errEl.textContent = 'Enter your 6-digit code.';
    errEl.style.display = 'block';
    return;
  }

  const btn = document.getElementById('totp-login-verify-btn');
  btn.disabled = true;
  btn.textContent = 'Verifying…';

  try {
    const { data: valid, error } = await sb.rpc('verify_totp_token', { token });
    if (error) throw error;

    if (!valid) {
      errEl.textContent = 'Invalid code. Try again or use a backup code.';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Verify';
      return;
    }

    document.getElementById('totp-login-modal').classList.remove('open');
    _totpInProgress = false;
    const user = _pendingTotpLoginUser;
    _pendingTotpLoginUser = null;
    currentUser = user;
    localStorage.setItem('quickcheck_totp_trusted', JSON.stringify({ expires: Date.now() + 30 * 24 * 60 * 60 * 1000 }));
    await enterApp();
  } catch (err) {
    errEl.textContent = err.message || 'Verification failed.';
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Verify';
  }
}

function showTotpLoginRecovery() {
  document.getElementById('totp-login-verify-btn').style.display = 'none';
  document.getElementById('totp-login-show-recover-btn').style.display = 'none';
  document.getElementById('totp-login-recovery-group').style.display = 'block';
  document.getElementById('totp-login-desc').textContent = 'Enter one of your backup recovery codes.';
  document.getElementById('totp-login-recovery-code').value = '';
  document.getElementById('totp-login-recovery-code').focus();
  document.getElementById('totp-login-recovery-error').style.display = 'none';
}

function backToTotpLogin() {
  document.getElementById('totp-login-recovery-group').style.display = 'none';
  document.getElementById('totp-login-verify-btn').style.display = '';
  document.getElementById('totp-login-show-recover-btn').style.display = '';
  document.getElementById('totp-login-desc').textContent = 'Enter the 6-digit code from your authenticator app.';
  document.getElementById('totp-login-token').value = '';
  document.getElementById('totp-login-token').focus();
}

async function handleTotpLoginRecover() {
  const code = document.getElementById('totp-login-recovery-code').value.trim();
  const errEl = document.getElementById('totp-login-recovery-error');
  errEl.style.display = 'none';

  if (!code) {
    errEl.textContent = 'Enter a backup recovery code.';
    errEl.style.display = 'block';
    return;
  }

  const btn = document.getElementById('totp-login-recover-btn');
  btn.disabled = true;
  btn.textContent = 'Verifying…';

  try {
    const { data: valid, error } = await sb.rpc('use_recovery_code', { code });
    if (error) throw error;

    if (!valid) {
      errEl.textContent = 'Invalid or already used backup code.';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Verify Recovery Code';
      return;
    }

    document.getElementById('totp-login-modal').classList.remove('open');
    _totpInProgress = false;
    const user = _pendingTotpLoginUser;
    _pendingTotpLoginUser = null;
    currentUser = user;
    localStorage.setItem('quickcheck_totp_trusted', JSON.stringify({ expires: Date.now() + 30 * 24 * 60 * 60 * 1000 }));
    await enterApp();
  } catch (err) {
    errEl.textContent = err.message || 'Verification failed.';
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Verify Recovery Code';
  }
}

async function closeTotpLoginModal() {
  document.getElementById('totp-login-modal').classList.remove('open');
  _totpInProgress = false;
  _pendingTotpLoginUser = null;
  if (sb) await sb.auth.signOut();
}

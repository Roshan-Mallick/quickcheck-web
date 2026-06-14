// ─── User display helpers ─────────────────────────────────────────────────

function getDisplayName(user) {
  if (!user) return 'Account';
  const meta = user.user_metadata || {};
  return meta.full_name || meta.name || user.email?.split('@')[0] || 'Account';
}

function getAvatarLetter(user) {
  const name = getDisplayName(user);
  return name[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?';
}

/**
 * Refresh every element that shows the user's name, email, or avatar
 * initial after login or a profile update.
 */
function updateUserDisplay() {
  if (!currentUser) return;
  const name   = getDisplayName(currentUser);
  const email  = currentUser.email || '';
  const letter = getAvatarLetter(currentUser);

  document.getElementById('user-name-display').textContent  = name;
  document.getElementById('user-email-display').textContent = email;
  document.getElementById('user-avatar').textContent        = letter;

  const topAvatar = document.getElementById('user-avatar-top');
  if (topAvatar) topAvatar.textContent = letter;
}

// ─── Account modal ────────────────────────────────────────────────────────

/**
 * Open the account settings modal, pre-fill fields, and show the
 * Profile section by default.
 */
function showAccountModal() {
  if (!currentUser) return;
  clearAccountMsg();

  const name   = getDisplayName(currentUser);
  const email  = currentUser.email || '';
  const letter = getAvatarLetter(currentUser);

  // Desktop header avatar (may not exist in all layouts)
  const avatarEl = document.getElementById('account-modal-avatar');
  if (avatarEl) avatarEl.textContent = letter;

  // Pre-fill form fields
  const nameInput = document.getElementById('account-name-input');
  if (nameInput) nameInput.value = currentUser.user_metadata?.full_name || name;

  const emailInput = document.getElementById('account-email-input');
  if (emailInput) emailInput.value = '';

  const newPasswordInput = document.getElementById('account-new-password');
  if (newPasswordInput) newPasswordInput.value = '';

  const confirmPasswordInput = document.getElementById('account-confirm-password');
  if (confirmPasswordInput) confirmPasswordInput.value = '';

  const inviteInput = document.getElementById('invite-email-input');
  if (inviteInput) inviteInput.value = '';

  // Mobile header
  const mobileTitle = document.getElementById('account-modal-title-mobile');
  if (mobileTitle) mobileTitle.textContent = name;

  const mobileEmail = document.getElementById('account-modal-email-mobile');
  if (mobileEmail) mobileEmail.textContent = email;

  const mobileAvatar = document.getElementById('account-modal-avatar-mobile');
  if (mobileAvatar) mobileAvatar.textContent = letter;

  // Always open on Profile
  showAccountSection('profile');

  const modal = document.getElementById('account-modal');
  if (modal) modal.classList.add('open');
}

function showAccountSection(section) {
  const sections = ['profile', 'email', 'password', 'invite', 'danger'];

  // Show only the selected section panel
  sections.forEach(s => {
    const el = document.getElementById('account-sec-' + s);
    if (el) el.style.display = s === section ? 'block' : 'none';
  });

  // Update sidebar nav active state by positional index
  document.querySelectorAll('.account-nav-item').forEach((btn, i) => {
    btn.classList.toggle('active', sections[i] === section);
  });
}

// ─── Profile ──────────────────────────────────────────────────────────────

async function handleUpdateName(e) {
  e.preventDefault();
  if (!sb || !currentUser) return;

  const nameInput = document.getElementById('account-name-input');
  const btn       = document.getElementById('account-name-btn');
  if (!nameInput || !btn) return;

  const name = nameInput.value.trim();
  if (!name) { showAccountMsg('Please enter a name.', 'error'); return; }

  btn.disabled    = true;
  btn.textContent = 'Saving…';

  try {
    const { data, error } = await sb.auth.updateUser({ data: { full_name: name } });
    if (error) throw error;

    currentUser = data.user;
    updateUserDisplay();

    const modalTitle = document.getElementById('account-modal-title');
    if (modalTitle) modalTitle.textContent = name;

    const modalTitleMobile = document.getElementById('account-modal-title-mobile');
    if (modalTitleMobile) modalTitleMobile.textContent = name;

    const modalAvatar = document.getElementById('account-modal-avatar');
    if (modalAvatar) modalAvatar.textContent = getAvatarLetter(currentUser);

    const modalAvatarMobile = document.getElementById('account-modal-avatar-mobile');
    if (modalAvatarMobile) modalAvatarMobile.textContent = getAvatarLetter(currentUser);

    showAccountMsg('Name updated successfully.');
    showToast('Profile updated.');
  } catch (err) {
    showAccountMsg(err.message || 'Failed to update name.', 'error');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Save name';
  }
}

// ─── Email ────────────────────────────────────────────────────────────────

async function handleChangeEmail(e) {
  e.preventDefault();
  if (!sb || !currentUser) return;

  const email = document.getElementById('account-email-input').value.trim();
  if (!email) { showAccountMsg('Please enter a new email.', 'error'); return; }

  const btn = document.getElementById('account-email-btn');
  btn.disabled    = true;
  btn.textContent = 'Sending…';

  try {
    const { error } = await sb.auth.updateUser({ email });
    if (error) throw error;
    showAccountMsg('Confirmation sent — check your new inbox (and spam folder).');
    showToast('Email confirmation sent.');
  } catch (err) {
    showAccountMsg(err.message || 'Failed to update email.', 'error');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Update email';
  }
}

// ─── Password ─────────────────────────────────────────────────────────────

async function handleChangePassword(e) {
  e.preventDefault();
  if (!sb || !currentUser) return;

  const pw      = document.getElementById('account-new-password').value;
  const confirm = document.getElementById('account-confirm-password').value;

  if (pw.length < 8)  { showAccountMsg('Password must be at least 8 characters.', 'error'); return; }
  if (pw !== confirm) { showAccountMsg('Passwords do not match.', 'error'); return; }

  const btn = document.getElementById('account-password-btn');
  btn.disabled    = true;
  btn.textContent = 'Updating…';

  try {
    const { error } = await sb.auth.updateUser({ password: pw });
    if (error) throw error;
    document.getElementById('account-new-password').value    = '';
    document.getElementById('account-confirm-password').value = '';
    showAccountMsg('Password updated successfully.');
    showToast('Password changed.');
  } catch (err) {
    showAccountMsg(err.message || 'Failed to change password.', 'error');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Change password';
  }
}

async function handleAccountPasswordReset() {
  if (!sb || !currentUser?.email) return;
  clearAccountMsg();
  try {
    const { error } = await sb.auth.resetPasswordForEmail(currentUser.email, {
      redirectTo: AUTH_REDIRECT(),
    });
    if (error) throw error;
    showAccountMsg('Reset link sent to ' + currentUser.email);
    showToast('Password reset email sent.');
  } catch (err) {
    showAccountMsg(err.message || 'Failed to send reset link.', 'error');
  }
}

// ─── Invite ───────────────────────────────────────────────────────────────

function copyInviteLink() {
  const url = window.location.origin + '/auth/';
  navigator.clipboard.writeText(url).then(() => {
    showToast('Invite link copied.');
  }).catch(() => {
    showToast('Failed to copy link.', 'error');
  });
}

async function handleSendInvite(e) {
  e.preventDefault();
  const to = document.getElementById('invite-email-input').value.trim();
  if (!to) { showAccountMsg('Enter an email address to invite.', 'error'); return; }

  const inviteBtn = e.target.querySelector('[type="submit"]');
  inviteBtn.disabled = true;
  inviteBtn.textContent = 'Checking…';

  try {
    // Reuse the same RPC you already have in login
    const { data: emailExists, error: rpcError } = await sb.rpc('check_email_exists', {
      input_email: to
    });

    if (rpcError) {
      showAccountMsg('Something went wrong. Please try again.', 'error');
      return;
    }

    if (emailExists) {
      showAccountMsg(`${to} already has a Quickcheck account.`, 'error');
      return;
    }

    // User doesn't exist — send magic link
    inviteBtn.textContent = 'Sending…';

    const { error: inviteError } = await sb.auth.signInWithOtp({
      email: to,
      options: {
        emailRedirectTo: window.location.origin,
        shouldCreateUser: true,
      }
    });

    if (inviteError) {
      showAccountMsg('Failed to send invite: ' + inviteError.message, 'error');
      return;
    }

    showAccountMsg(`Invite sent to ${to} — they'll receive a magic link to sign up.`);
    showToast('Invite sent.');
    document.getElementById('invite-email-input').value = '';

  } catch (err) {
    showAccountMsg(err.message || 'Something went wrong.', 'error');
  } finally {
    inviteBtn.disabled = false;
    inviteBtn.textContent = 'Send invite';
  }
}
// ─── Delete account ───────────────────────────────────────────────────────

async function handleDeleteAccount() {
  if (!sb || !currentUser) return;

  const btn = document.querySelector('.btn-danger-outline');
  btn.disabled    = true;
  btn.textContent = 'Sending email…';

  try {
    const { data: { session } } = await sb.auth.getSession();

    const res = await fetch(
      SUPABASE_URL + '/functions/v1/delete-account',
      {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      }
    );

    if (!res.ok) throw new Error('Failed to send confirmation email.');

    showAccountMsg('Confirmation email sent. Check your inbox.', 'success');
    btn.textContent = 'Email sent';

  } catch (err) {
    showAccountMsg(err.message || 'Failed to send confirmation email.', 'error');
    btn.disabled    = false;
    btn.textContent = 'Delete my account';
  }
}

// ─── App entry point ──────────────────────────────────────────────────────
// Called after a successful sign-in or session restore.

async function enterApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app-screen').style.display  = 'block';
  updateUserDisplay();
  await loadWorkspaces();

  const savedId = localStorage.getItem(WS_STORAGE_KEY);
  if (savedId && workspaces.find(w => w.id === savedId)) {
    if (DEV) console.log('[account] restoring workspace:', savedId);
    await switchWorkspace(savedId);
  } else {
    if (savedId) localStorage.removeItem(WS_STORAGE_KEY);
    await loadChecklists();
  }

  renderWorkspaceSwitcher();
}

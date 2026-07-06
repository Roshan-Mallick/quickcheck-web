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

  applyAvatarColor(getAvatarColor(currentUser));
}

const AVATAR_COLORS = [
  '#e07a7a', '#e8a87c', '#e8c87c', '#6daf82',
  '#5cb8b8', '#5c8db8', '#7c8ce8', '#b87ce8',
  '#e87cb8', '#c97c7c', '#8cb87c', '#7ca8b8',
];

function getAvatarColor(user) {
  if (!user) return null;
  const meta = user.user_metadata || {};
  return meta.avatar_color || null;
}

function avatarColorForUser(userId, storedColor) {
  if (storedColor) return storedColor;
  if (!userId) return '#7c8ce8';
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function applyAvatarColor(color) {
  const els = [
    document.getElementById('user-avatar'),
    document.getElementById('user-avatar-top'),
    document.getElementById('account-modal-avatar'),
    document.getElementById('account-modal-avatar-mobile'),
  ];
  els.forEach(el => {
    if (!el) return;
    if (color) {
      el.style.background = color;
      el.style.borderColor = color;
      el.style.color = '#fff';
    } else {
      el.style.background = '';
      el.style.borderColor = '';
      el.style.color = '';
    }
  });
}

function renderAvatarColors() {
  const container = document.getElementById('avatar-colors');
  if (!container) return;
  const current = getAvatarColor(currentUser);
  container.innerHTML = AVATAR_COLORS.map(c =>
    `<button type="button" class="avatar-color-swatch${c === current ? ' active' : ''}" style="background:${c};color:${c}" data-color="${c}" onclick="selectAvatarColor('${c}')" title="${c}"></button>`
  ).join('');
}

async function selectAvatarColor(color) {
  if (!sb || !currentUser) return;
  document.querySelectorAll('.avatar-color-swatch').forEach(el => {
    el.classList.toggle('active', el.dataset.color === color);
  });
  applyAvatarColor(color);
  try {
    const meta = { ...(currentUser.user_metadata || {}), avatar_color: color };
    const { data, error } = await sb.auth.updateUser({ data: meta });
    if (error) throw error;
    currentUser = data.user;
  } catch (err) {
    showAccountMsg(err.message || 'Failed to save avatar color.', 'error');
  }
}

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

  // Reset email-change OTP state
  _pendingNewUserEmail = null;
  document.getElementById('account-email-otp').value = '';
  document.getElementById('email-change-otp-group').style.display = 'none';
  document.getElementById('email-change-step1').style.display = 'block';
  const emailBtn = document.getElementById('account-email-btn');
  if (emailBtn) { emailBtn.style.display = 'flex'; emailBtn.disabled = false; emailBtn.textContent = 'Update email'; }
  document.getElementById('account-email-verify-btn').style.display = 'none';
  document.getElementById('email-change-hint').textContent = 'Enter a new email, then verify with a code sent to your current email.';

  const newPasswordInput = document.getElementById('account-new-password');
  if (newPasswordInput) newPasswordInput.value = '';

  const confirmPasswordInput = document.getElementById('account-confirm-password');
  if (confirmPasswordInput) confirmPasswordInput.value = '';

  // Mobile header
  const mobileTitle = document.getElementById('account-modal-title-mobile');
  if (mobileTitle) mobileTitle.textContent = name;

  const mobileEmail = document.getElementById('account-modal-email-mobile');
  if (mobileEmail) mobileEmail.textContent = email;

  const mobileAvatar = document.getElementById('account-modal-avatar-mobile');
  if (mobileAvatar) mobileAvatar.textContent = letter;

  applyAvatarColor(getAvatarColor(currentUser));
  renderAvatarColors();

  // Always open on Profile
  showAccountSection('profile');

  const modal = document.getElementById('account-modal');
  if (modal) modal.classList.add('open');
}

function showAccountSection(section) {
  const sections = ['profile', 'email', 'password', 'plan', 'danger'];
  const isMobile = window.innerWidth <= 640;

  // On mobile: show all sections stacked (scrollable). On desktop: show only the selected one.
  sections.forEach(s => {
    const el = document.getElementById('account-sec-' + s);
    if (el) el.style.display = isMobile ? 'block' : (s === section ? 'block' : 'none');
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
    const existingMeta = currentUser.user_metadata || {};
    const { data, error } = await sb.auth.updateUser({ data: { ...existingMeta, full_name: name } });
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

let _pendingNewUserEmail = null;

async function handleChangeEmail(e) {
  e.preventDefault();
  if (!sb || !currentUser) return;

  const email = document.getElementById('account-email-input').value.trim();
  if (!email) { showAccountMsg('Please enter a new email.', 'error'); return; }
  if (email === currentUser.email) { showAccountMsg('New email is the same as current.', 'error'); return; }

  _pendingNewUserEmail = email;

  const btn = document.getElementById('account-email-btn');
  btn.disabled    = true;
  btn.textContent = 'Sending code…';

  try {
    const { error } = await sb.auth.signInWithOtp({
      email: currentUser.email,
      options: { shouldCreateUser: false },
    });
    if (error) throw error;

    document.getElementById('email-change-step1').style.display = 'none';
    document.getElementById('email-change-otp-group').style.display = 'block';
    document.getElementById('account-email-verify-btn').style.display = 'flex';
    document.getElementById('account-email-btn').style.display = 'none';
    document.getElementById('email-change-hint').textContent = 'A code was sent to your current email. Enter it below to verify and update your email.';

    showAccountMsg('Verification code sent to your current email.', 'success');
  } catch (err) {
    showAccountMsg(err.message || 'Failed to send code.', 'error');
    btn.disabled    = false;
    btn.textContent = 'Update email';
  }
}

async function verifyEmailChangeOtp() {
  if (!sb || !currentUser || !_pendingNewUserEmail) return;

  const otp = document.getElementById('account-email-otp').value.trim();
  if (!otp) { showAccountMsg('Enter the verification code.', 'error'); return; }

  const btn = document.getElementById('account-email-verify-btn');
  btn.disabled    = true;
  btn.textContent = 'Verifying…';

  try {
    const { data: verifyData, error } = await sb.auth.verifyOtp({
      email: currentUser.email,
      token: otp,
      type: 'email',
    });
    if (error) throw error;

    // OTP verified — update auth.users directly via RPC
    const { error: rpcError } = await sb.rpc('update_my_email', {
      new_email: _pendingNewUserEmail,
    });
    if (rpcError) throw rpcError;

    const changedEmail = _pendingNewUserEmail;
    _pendingNewUserEmail = null;

    // Refresh session so the stored JWT and user object reflect the new email
    const { data: refreshData, error: refreshError } = await sb.auth.refreshSession();
    if (!refreshError && refreshData?.user) {
      currentUser = refreshData.user;
    } else {
      const { data: userData } = await sb.auth.getUser();
      if (userData?.user) {
        currentUser = userData.user;
      } else {
        currentUser = { ...currentUser, email: changedEmail };
      }
    }
    updateUserDisplay();

    document.getElementById('account-email-input').value = '';
    document.getElementById('account-email-otp').value = '';
    document.getElementById('email-change-otp-group').style.display = 'none';
    document.getElementById('email-change-step1').style.display = 'block';
    const emailBtn = document.getElementById('account-email-btn');
    emailBtn.style.display = 'flex';
    emailBtn.disabled = false;
    emailBtn.textContent = 'Update email';
    document.getElementById('account-email-verify-btn').style.display = 'none';
    document.getElementById('email-change-hint').textContent = 'Enter a new email, then verify with a code sent to your current email.';
    showAccountMsg('Email changed to ' + changedEmail + '.');
    showToast('Email updated.');

  } catch (err) {
    showAccountMsg(err.message || 'Verification failed.', 'error');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Verify & Change';
  }
}

function resendEmailOtp() {
  if (!sb || !currentUser) return;
  const btn = document.getElementById('resend-email-otp-btn');
  btn.disabled = true;
  btn.textContent = 'Sending…';
  sb.auth.signInWithOtp({
    email: currentUser.email,
    options: { shouldCreateUser: false },
  }).then(() => {
    btn.disabled = false;
    btn.textContent = 'Resend code';
    showAccountMsg('Code resent to your current email.', 'success');
  }).catch(() => {
    btn.disabled = false;
    btn.textContent = 'Resend code';
  });
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

// ─── Invite (workspace-level only) ────────────────────────────────────────
// ─── Delete account ───────────────────────────────────────────────────────

async function handleDeleteAccount() {
  if (!sb || !currentUser) return;

  // Check if this user is the admin — admin_config RLS only lets the admin read it
  const { data: adminRows } = await sb
    .from('admin_config')
    .select('value')
    .eq('key', 'admin_email');

  if (adminRows && adminRows.length > 0 && adminRows[0].value === currentUser.email) {
    showAccountMsg('This account is the admin and cannot be deleted via this dashboard. Go to the Admin Panel to transfer the admin role first.', 'error');
    return;
  }

  showConfirmModal({
    label: 'Delete account',
    title: 'Delete your account?',
    message: 'This permanently deletes your account and all data. This cannot be undone.',
    onConfirm: sendDeleteOtp,
  });
}

async function sendDeleteOtp() {
  if (!sb || !currentUser?.email) return;

  const btn = document.querySelector('.btn-danger-outline');
  btn.disabled    = true;
  btn.textContent = 'Sending code…';

  try {
    const { error } = await sb.auth.signInWithOtp({
      email: currentUser.email,
      options: { shouldCreateUser: false },
    });
    if (error) throw error;

    document.getElementById('delete-otp-email').textContent = currentUser.email;
    document.getElementById('delete-otp-msg').textContent  = '';
    document.getElementById('delete-otp-input').value       = '';
    document.getElementById('delete-otp-modal').classList.add('open');

    btn.textContent = 'Code sent';

  } catch (err) {
    showAccountMsg(err.message || 'Failed to send verification code.', 'error');
    btn.disabled    = false;
    btn.textContent = 'Delete my account';
  }
}

async function handleDeleteOtpSubmit(e) {
  e.preventDefault();
  if (!sb || !currentUser?.email) return;

  const otp = document.getElementById('delete-otp-input').value.trim();
  if (!otp || otp.length < 8) return;

  const btn = document.getElementById('delete-otp-btn');
  btn.disabled    = true;
  btn.textContent = 'Verifying…';

  try {
    const { data: verifyData, error } = await sb.auth.verifyOtp({
      email: currentUser.email,
      token: otp,
      type: 'email',
    });
    if (error) throw error;

    if (verifyData?.session) {
      await sb.auth.setSession(verifyData.session);
    }

    btn.textContent = 'Deleting account…';

    // Secondary guard — ensure this user is not the admin
    const { data: adminRows } = await sb
      .from('admin_config')
      .select('value')
      .eq('key', 'admin_email');

    if (adminRows && adminRows.length > 0 && adminRows[0].value === currentUser.email) {
      throw new Error('Cannot delete the admin account.');
    }

    const { error: deleteError } = await sb.rpc('delete_my_account');
    if (deleteError) throw deleteError;

    closeModal('delete-otp-modal');
    window.location.href = '/account-deleted.html';

  } catch (err) {
    const msgEl = document.getElementById('delete-otp-msg');
    msgEl.textContent = err.message || 'OTP is wrong, enter the correct one.';
    msgEl.className   = 'account-msg error';
    btn.disabled    = false;
    btn.textContent = 'Verify & Delete';
  }
}

function resendDeleteOtp() {
  const btn = document.getElementById('resend-delete-otp-btn');
  btn.disabled = true;
  btn.textContent = 'Sending…';
  sendDeleteOtp().then(() => {
    btn.disabled = false;
    btn.textContent = 'Resend code';
  }).catch(() => {
    btn.disabled = false;
    btn.textContent = 'Resend code';
  });
}

// ─── Subscription ─────────────────────────────────────────────────────────

const PLAN_HIERARCHY = { free: 0, pro: 1, team: 2 };

async function getUserSubscription() {
  if (!sb || !currentUser) return { plan: 'free', workspace_limit: 1 };
  try {
    const { data, error } = await sb.rpc('get_user_subscription');
    if (error || !data || data.length === 0) {
      return { plan: 'free', workspace_limit: 1 };
    }
    return data[0];
  } catch (err) {
    console.error('getUserSubscription error:', err);
    return { plan: 'free', workspace_limit: 1 };
  }
}

function getSubscription() {
  return window.userSubscription || { plan: 'free', workspace_limit: 1 };
}

function requirePlan(minPlan, featureName) {
  const sub = getSubscription();
  const current = PLAN_HIERARCHY[sub.plan] ?? 0;
  const required = PLAN_HIERARCHY[minPlan] ?? 0;
  if (current >= required) return true;

  const msgs = {
    free: {
      pro: 'Upgrade to Pro for 5 workspaces, team collaboration, and more.',
      team: 'Upgrade to Team for unlimited workspaces and members.',
    },
    pro: {
      team: 'Upgrade to Team for unlimited workspaces and members.',
    },
  };
  const msg = (msgs[sub.plan] && msgs[sub.plan][minPlan]) || `Upgrade to ${minPlan.charAt(0).toUpperCase() + minPlan.slice(1)} to access this feature.`;
  const feature = featureName ? `"${featureName}"` : 'This feature';

  showToast(`${feature} is not available on your plan. ${msg}`, 'error');
  setTimeout(() => window.location.href = '/#pricing', 2000);
  return false;
}

function updateAccountPlanDisplay() {
  const sub = getSubscription();
  const badge = document.getElementById('account-plan-badge');
  const detail = document.getElementById('account-plan-detail');
  const membersRow = document.getElementById('account-plan-members-row');
  const membersDetail = document.getElementById('account-plan-members-detail');
  if (!badge) return;
  const labels = { free: 'Free', pro: 'Pro', team: 'Team' };
  badge.textContent = labels[sub.plan] || 'Free';
  badge.className = 'plan-badge plan-badge--' + (sub.plan || 'free');
  if (detail) {
    const limits = { free: '1 Workspace', pro: '5 Workspaces', team: 'Unlimited Workspaces' };
    detail.textContent = limits[sub.plan] || '1 Workspace';
  }
  if (membersRow && membersDetail) {
    if (sub.plan === 'free') {
      membersRow.style.display = 'none';
    } else {
      membersRow.style.display = '';
      membersDetail.textContent = sub.plan === 'pro' ? '5 Members / Workspace' : 'Unlimited Members';
    }
  }
}

// ─── App entry point ──────────────────────────────────────────────────────
// Called after a successful sign-in or session restore.

async function enterApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app-screen').style.display  = 'block';
  updateUserDisplay();

  window.userSubscription = await getUserSubscription();
  if (DEV) console.log('[account] subscription:', window.userSubscription);
  updateAccountPlanDisplay();

  await loadWorkspaces();

  // Always load personal checklists first — needed for universal search
  await loadChecklists();

  const savedId = localStorage.getItem(WS_STORAGE_KEY);
  if (savedId) {
    const ws = workspaces.find(w => w.id === savedId);
    if (ws) {
      if (DEV) console.log('[account] restoring workspace:', savedId);
      await switchWorkspace(savedId);
    } else if (workspaces.length > 0) {
      localStorage.removeItem(WS_STORAGE_KEY);
    }
  }

  // Load shared checklists from ALL workspaces into a universal cache for cross-context search
  await loadAllSharedChecklists();

  renderWorkspaceSwitcher();
}

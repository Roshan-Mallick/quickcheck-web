// ─── Invite Module ────────────────────────────────────────────────────────
// Handles workspace invitation verification, display, and acceptance.
// Dependencies: auth.js (switchAuthView), state.js (currentUser, sb)

let _inviteToken = null;
let _inviteData = null;

function getInviteToken() {
  return _inviteToken;
}

// ─── Verify invite token via RPC ──────────────────────────────────────────

async function verifyInviteToken(token) {
  if (!sb) return null;
  console.log('[invite] verifyInviteToken called with token:', token);
  const { data, error } = await sb.rpc('get_invite_by_token', { input_token: token });
  console.log('[invite] RPC raw response:', { data, error });
  console.log('[invite] data type:', typeof data, 'isArray:', Array.isArray(data));
  if (error) {
    console.error('[invite] RPC error:', error);
    return null;
  }
  if (!data) {
    console.log('[invite] data is null/undefined');
    return null;
  }
  if (Array.isArray(data)) {
    console.log('[invite] data is array, length:', data.length);
    if (data.length > 0) {
      console.log('[invite] first element:', data[0]);
      return data[0];
    }
    console.log('[invite] array empty');
    return null;
  }
  console.log('[invite] data is single object:', data);
  return data;
}

// ─── Main entry point — called from state.js ──────────────────────────────

async function handleInviteToken(token) {
  _inviteToken = token;

  showInviteLoading();

  const data = await verifyInviteToken(token);
  if (!data) {
    showInviteError('This invitation link is invalid or could not be verified.');
    return;
  }

  _inviteData = data;

  if (data.status === 'accepted') {
    showInviteAlreadyAccepted(data);
    return;
  }
  if (data.status === 'cancelled' || data.status === 'revoked') {
    showInviteCancelled(data);
    return;
  }
  if (data.status === 'expired' || isExpired(data.expires_at)) {
    showInviteExpired(data);
    return;
  }
  if (data.status === 'rejected') {
    showInviteError('This invitation was declined.');
    return;
  }
  if (data.status !== 'pending') {
    showInviteError('This invitation is no longer valid.');
    return;
  }
  if (!data.workspace_exists) {
    showInviteError('The workspace for this invitation no longer exists.');
    return;
  }

  const isLoggedIn = !!currentUser;

  if (!isLoggedIn) {
    showInviteLoginRequired(data);
    return;
  }

  if (currentUser.email.toLowerCase() !== data.invited_email.toLowerCase()) {
    showInviteEmailMismatch(data);
    return;
  }

  if (data.already_member) {
    showInviteAlreadyMember(data);
    return;
  }

  showInviteCard(data);
}

// ─── UI — Loading ─────────────────────────────────────────────────────────

function showInviteLoading() {
  const container = document.getElementById('invite-container');
  if (container) container.style.display = 'block';
  document.getElementById('invite-loading').style.display = 'flex';
  document.getElementById('invite-card').style.display = 'none';
  document.getElementById('invite-error').style.display = 'none';
  switchAuthView('invite');
}

// ─── UI — Invite Card ─────────────────────────────────────────────────────

function showInviteCard(data) {
  document.getElementById('invite-loading').style.display = 'none';
  document.getElementById('invite-card').style.display = 'block';
  document.getElementById('invite-error').style.display = 'none';

  document.getElementById('invite-workspace-name').textContent = data.workspace_name || 'Unknown Workspace';
  document.getElementById('invite-inviter-name').textContent = data.inviter_name || 'Someone';
  document.getElementById('invite-role-name').textContent = formatRole(data.role);
  document.getElementById('invite-email-address').textContent = data.invited_email || '';

  const hasTz = data.expires_at?.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(data.expires_at || '');
  const expires = data.expires_at ? new Date(hasTz ? data.expires_at : data.expires_at + 'Z') : null;
  const expiresEl = document.getElementById('invite-expires');
  if (expires && expires > new Date()) {
    expiresEl.textContent = 'Expires ' + expires.toLocaleDateString();
    expiresEl.style.display = 'block';
  } else if (expires) {
    expiresEl.textContent = 'Expired ' + expires.toLocaleDateString();
    expiresEl.style.display = 'block';
  } else {
    expiresEl.style.display = 'none';
  }

  document.getElementById('invite-accept-section').style.display = 'block';
  const btn = document.getElementById('accept-invite-btn');
  btn.disabled = false;
  btn.textContent = 'Accept Invite';
  btn.onclick = acceptInviteFromToken;

  switchAuthView('invite');
}

// ─── UI — States ───────────────────────────────────────────────────────────

function showInviteError(msg) {
  document.getElementById('invite-loading').style.display = 'none';
  document.getElementById('invite-card').style.display = 'none';
  document.getElementById('invite-error').style.display = 'block';
  document.getElementById('invite-error-icon').innerHTML = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
  document.getElementById('invite-error-title').textContent = 'Invitation Error';
  document.getElementById('invite-error-msg').textContent = msg;
  document.getElementById('invite-error-action').style.display = 'none';
  switchAuthView('invite');
}

function showInviteLoginRequired(data) {
  document.getElementById('invite-loading').style.display = 'none';
  document.getElementById('invite-card').style.display = 'block';
  document.getElementById('invite-error').style.display = 'none';

  document.getElementById('invite-workspace-name').textContent = data.workspace_name || 'Unknown Workspace';
  document.getElementById('invite-inviter-name').textContent = data.inviter_name || 'Someone';
  document.getElementById('invite-role-name').textContent = formatRole(data.role);
  document.getElementById('invite-email-address').textContent = data.invited_email || '';

  document.getElementById('invite-expires').style.display = 'none';
  document.getElementById('invite-accept-section').style.display = 'none';
  document.getElementById('invite-login-required').style.display = 'block';

  switchAuthView('invite');
}

function showInviteEmailMismatch(data) {
  document.getElementById('invite-loading').style.display = 'none';
  document.getElementById('invite-card').style.display = 'none';
  document.getElementById('invite-error').style.display = 'block';
  document.getElementById('invite-error-icon').innerHTML = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
  document.getElementById('invite-error-title').textContent = 'Wrong Account';
  document.getElementById('invite-error-msg').textContent =
    'This invitation was sent to ' + data.invited_email + '. Please sign out and log in with that email address to accept.';
  document.getElementById('invite-error-action').style.display = 'block';
  document.getElementById('invite-error-action').innerHTML = '<button class="btn-outline" onclick="signOut(); showInviteLoginRequired(_inviteData)">Sign out</button>';
  switchAuthView('invite');
}

function showInviteAlreadyMember(data) {
  document.getElementById('invite-loading').style.display = 'none';
  document.getElementById('invite-card').style.display = 'none';
  document.getElementById('invite-error').style.display = 'block';
  document.getElementById('invite-error-icon').innerHTML = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="1.5" stroke-linecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/><polyline points="9 11 12 14 17 9"/></svg>';
  document.getElementById('invite-error-title').textContent = 'Already a Member';
  document.getElementById('invite-error-msg').textContent =
    "You're already a member of \u201c" + data.workspace_name + '.\u201d';
  document.getElementById('invite-error-action').style.display = 'block';
  document.getElementById('invite-error-action').innerHTML =
    '<button class="btn-primary" onclick="closeInviteAndShowApp()">Go to Workspace</button>';
  switchAuthView('invite');
}

function showInviteAlreadyAccepted(data) {
  document.getElementById('invite-loading').style.display = 'none';
  document.getElementById('invite-card').style.display = 'none';
  document.getElementById('invite-error').style.display = 'block';
  document.getElementById('invite-error-icon').innerHTML = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="1.5" stroke-linecap="round"><polyline points="9 11 12 14 17 9"/><path d="M20 6L9 17l-5-5"/></svg>';
  document.getElementById('invite-error-title').textContent = 'Already Joined';
  document.getElementById('invite-error-msg').textContent =
    'You\u2019ve already joined \u201c' + data.workspace_name + '.\u201d';
  document.getElementById('invite-error-action').style.display = 'block';
  document.getElementById('invite-error-action').innerHTML =
    '<button class="btn-primary" onclick="closeInviteAndShowApp()">Open Workspace</button>';
  switchAuthView('invite');
}

function showInviteExpired(data) {
  document.getElementById('invite-loading').style.display = 'none';
  document.getElementById('invite-card').style.display = 'none';
  document.getElementById('invite-error').style.display = 'block';
  document.getElementById('invite-error-icon').innerHTML = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
  document.getElementById('invite-error-title').textContent = 'Invitation Expired';
  document.getElementById('invite-error-msg').textContent =
    'This invitation to \u201c' + data.workspace_name + '\u201d has expired. Please ask the workspace owner to send a new invitation.';
  document.getElementById('invite-error-action').style.display = 'none';
  switchAuthView('invite');
}

function showInviteCancelled(data) {
  document.getElementById('invite-loading').style.display = 'none';
  document.getElementById('invite-card').style.display = 'none';
  document.getElementById('invite-error').style.display = 'block';
  document.getElementById('invite-error-icon').innerHTML = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>';
  document.getElementById('invite-error-title').textContent = 'Invitation Cancelled';
  document.getElementById('invite-error-msg').textContent =
    'This invitation to \u201c' + data.workspace_name + '\u201d has been cancelled.';
  document.getElementById('invite-error-action').style.display = 'none';
  switchAuthView('invite');
}

// ─── Accept Invite ─────────────────────────────────────────────────────────

async function acceptInviteFromToken() {
  if (!sb || !currentUser || !_inviteToken) return;

  const btn = document.getElementById('accept-invite-btn');
  btn.disabled = true;
  btn.textContent = 'Joining…';

  try {
    console.log('[invite] Accepting invite with token:', _inviteToken);
    console.log('[invite] Current user:', currentUser?.email);
    const { data: wsId, error } = await sb.rpc('accept_workspace_invite_by_token', { input_token: _inviteToken });
    console.log('[invite] RPC result:', { wsId, error });
    if (error) {
      console.error('[invite] Accept error:', error);
      showToast(error.message || 'Failed to accept invitation.', 'error');
      btn.disabled = false;
      btn.textContent = 'Accept Invite';
      return;
    }
    sessionStorage.removeItem('quickcheck_invite_token');
    window.pendingInviteToken = null;
    showToast('You joined the workspace!');
    await loadWorkspaces();
    console.log('[invite] Workspaces after load:', workspaces);
    if (wsId) {
      localStorage.setItem(WS_STORAGE_KEY, wsId);
      await switchWorkspace(wsId);
    } else {
      console.error('[invite] wsId is null/undefined after successful RPC');
    }
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'flex';
  } catch (err) {
    console.error('[invite] Catch error:', err);
    showToast(err.message || 'Failed to accept invitation.', 'error');
    btn.disabled = false;
    btn.textContent = 'Accept Invite';
  }
}

// ─── Cleanup ───────────────────────────────────────────────────────────────

function closeInviteAndShowApp() {
  _inviteToken = null;
  _inviteData = null;
  window.pendingInviteToken = null;
  sessionStorage.removeItem('quickcheck_invite_token');
  document.getElementById('invite-container').style.display = 'none';
  if (currentUser) {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'flex';
  } else {
    switchAuthView('login');
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatRole(role) {
  const labels = { admin: 'Admin', editor: 'Member', viewer: 'Viewer', owner: 'Owner' };
  return labels[role] || role || 'Member';
}

function isExpired(expiresAt) {
  if (!expiresAt) return false;
  const hasTz = expiresAt.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(expiresAt);
  const d = hasTz ? new Date(expiresAt) : new Date(expiresAt + 'Z');
  return d < new Date();
}

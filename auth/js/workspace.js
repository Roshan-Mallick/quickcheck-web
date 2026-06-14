// ─── Workspace data layer ──────────────────────────────────────────────────
// State variables are declared in state.js (workspaces, activeWorkspace,
// sharedChecklists, workspaceMembers, workspaceActivity, workspaceRealtime).

// ─── CRUD ─────────────────────────────────────────────────────────────────

async function loadWorkspaces() {
  if (!sb || !currentUser) return;
  const { data, error } = await sb.rpc('get_user_workspaces');
  if (error) { console.error('loadWorkspaces error:', error); return; }
  workspaces = data || [];
  if (activeWorkspace) {
    const still = workspaces.find(w => w.id === activeWorkspace.id);
    if (!still) activeWorkspace = null;
  }
  renderWorkspaceSwitcher();
}

async function createWorkspace(name) {
  name = name.trim();
  if (!name) { showToast('Workspace name is required.', 'error'); return null; }
  if (!sb || !currentUser) return null;
  const btn = document.querySelector('#create-ws-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Creating…'; }
  try {
    const { data, error } = await sb.rpc('create_workspace', { ws_name: name });
    if (error) { showToast(error.message, 'error'); return null; }
    showToast('Workspace created.');
    await loadWorkspaces();
    await switchWorkspace(data);
    closeModal('create-workspace-modal');
    return data;
  } catch (err) {
    showToast(err.message || 'Failed to create workspace.', 'error');
    return null;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Create workspace'; }
  }
}

async function renameWorkspace(wsId, name) {
  name = name.trim();
  if (!name) { showToast('Name is required.', 'error'); return; }
  if (!sb || !currentUser) return;
  const { error } = await sb.from('workspaces').update({ name, updated_at: new Date().toISOString() }).eq('id', wsId);
  if (error) { showToast(error.message, 'error'); return; }
  if (activeWorkspace && activeWorkspace.id === wsId) activeWorkspace.name = name;
  await loadWorkspaces();
  showToast('Workspace renamed.');
}

async function deleteWorkspace(wsId) {
  if (!sb || !currentUser) return;
  const { error } = await sb.from('workspaces').delete().eq('id', wsId);
  if (error) { showToast(error.message, 'error'); return; }
  if (activeWorkspace && activeWorkspace.id === wsId) {
    activeWorkspace = null;
    sharedChecklists = [];
    await loadChecklists();
    renderSidebar();
  }
  await loadWorkspaces();
  showToast('Workspace deleted.');
  closeModal('workspace-settings-modal');
}

// ─── Workspace switching ─────────────────────────────────────────────────

async function switchWorkspace(wsId) {
  if (!wsId) { await switchToPersonal(); return; }
  const ws = workspaces.find(w => w.id === wsId);
  if (!ws) { showToast('Workspace not found.', 'error'); return; }
  activeWorkspace = ws;
  await Promise.all([
    loadSharedChecklists(wsId),
    loadWorkspaceMembers(wsId),
    loadWorkspaceActivity(wsId),
  ]);
  subscribeWorkspaceRealtime(wsId);
  renderSidebar();
  if (!sharedChecklists.length) showEmptyState();
  document.querySelectorAll('.workspace-switcher-item').forEach(el => {
    el.classList.toggle('active', el.dataset.ws === wsId);
  });
}

async function switchToPersonal() {
  const prev = activeWorkspace;
  activeWorkspace = null;
  sharedChecklists = [];
  workspaceMembers = [];
  workspaceActivity = [];
  if (workspaceRealtime) { sb.removeChannel(workspaceRealtime); workspaceRealtime = null; }
  await loadChecklists();
  renderSidebar();
  if (prev) {
    const first = document.querySelector('.workspace-switcher-item:first-child');
    if (first) first.classList.add('active');
  }
}

// ─── Shared checklists ────────────────────────────────────────────────────

async function loadSharedChecklists(wsId) {
  if (!sb || !currentUser) return;
  const { data, error } = await sb
    .from('workspace_checklists')
    .select('id, checklist_id, shared_by, created_at, checklists!inner(id, title, data, user_id)')
    .eq('workspace_id', wsId);
  if (error) { console.error('loadSharedChecklists:', error); sharedChecklists = []; return; }
  sharedChecklists = (data || []).map(r => ({
    id: r.checklist_id,
    title: r.checklists.title,
    data: r.checklists.data,
    _shared: true,
    _owner_id: r.checklists.user_id,
    _shared_by: r.shared_by,
    _shared_at: r.created_at,
  }));
}

async function shareChecklist(wsId, checklistId) {
  if (!sb || !currentUser) return;
  const { error } = await sb.rpc('share_checklist_to_workspace', {
    chk_id: checklistId,
    ws_id: wsId,
  });
  if (error) { showToast(error.message, 'error'); return; }
  showToast('Checklist shared to workspace.');
  if (activeWorkspace && activeWorkspace.id === wsId) {
    await loadSharedChecklists(wsId);
    renderSidebar();
  }
}

async function unshareChecklist(wsId, checklistId) {
  if (!sb || !currentUser) return;
  showConfirmModal({
    label: 'Unshare checklist',
    title: 'Remove from workspace?',
    message: 'The checklist will be removed from this workspace but remains in your personal checklists.',
    onConfirm: async () => {
      const { error } = await sb.rpc('unshare_checklist_from_workspace', {
        chk_id: checklistId,
        ws_id: wsId,
      });
      if (error) { showToast(error.message, 'error'); return; }
      showToast('Checklist removed from workspace.');
      if (activeWorkspace && activeWorkspace.id === wsId) {
        if (activeId === checklistId) { activeId = null; showEmptyState(); }
        await loadSharedChecklists(wsId);
        renderSidebar();
      }
    }
  });
}

// ─── Members ──────────────────────────────────────────────────────────────

async function loadWorkspaceMembers(wsId) {
  if (!sb || !currentUser) return;
  const { data, error } = await sb
    .from('workspace_members')
    .select('id, user_id, role, status, created_at, users!inner(email, raw_user_meta_data)')
    .eq('workspace_id', wsId);
  if (error) { console.error('loadWorkspaceMembers:', error); workspaceMembers = []; return; }
  workspaceMembers = (data || []).map(m => ({
    id: m.id,
    user_id: m.user_id,
    role: m.role,
    status: m.status,
    email: m.users.email || '',
    name: m.users.raw_user_meta_data?.full_name || m.users.email?.split('@')[0] || 'Unknown',
    created_at: m.created_at,
  }));
  renderWorkspaceMembers();
}

async function inviteToWorkspace(wsId, email, role) {
  if (!sb || !currentUser) return;
  if (!email) { showToast('Enter an email address.', 'error'); return; }
  const btn = document.querySelector('#invite-ws-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
  try {
    const { data, error } = await sb.rpc('invite_to_workspace', {
      ws_id: wsId,
      invite_email: email.trim(),
      invite_role: role || 'viewer',
    });
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Invitation sent.');
    await loadWorkspaceMembers(wsId);
    closeModal('invite-member-modal');
  } catch (err) {
    showToast(err.message || 'Failed to send invitation.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Send invite'; }
  }
}

async function removeWorkspaceMember(wsId, userId) {
  if (!sb || !currentUser) return;
  showConfirmModal({
    label: 'Remove member',
    title: 'Remove member?',
    message: 'They will lose access to all shared checklists in this workspace.',
    onConfirm: async () => {
      const { error } = await sb
        .from('workspace_members')
        .delete()
        .eq('workspace_id', wsId)
        .eq('user_id', userId);
      if (error) { showToast(error.message, 'error'); return; }
      showToast('Member removed.');
      await loadWorkspaceMembers(wsId);
    }
  });
}

async function changeMemberRole(wsId, userId, role) {
  if (!sb || !currentUser) return;
  const { error } = await sb
    .from('workspace_members')
    .update({ role })
    .eq('workspace_id', wsId)
    .eq('user_id', userId);
  if (error) { showToast(error.message, 'error'); return; }
  showToast('Role updated.');
  await loadWorkspaceMembers(wsId);
}

async function acceptInvitation(wsId) {
  if (!sb || !currentUser) return;
  const { error } = await sb.rpc('accept_workspace_invitation', { ws_id: wsId });
  if (error) { showToast(error.message, 'error'); return; }
  showToast('Invitation accepted.');
  await loadWorkspaces();
  await switchWorkspace(wsId);
}

async function declineInvitation(wsId) {
  if (!sb || !currentUser) return;
  const { error } = await sb.rpc('decline_workspace_invitation', { ws_id: wsId });
  if (error) { showToast(error.message, 'error'); return; }
  await loadWorkspaces();
  renderSidebar();
}

// ─── Activity ────────────────────────────────────────────────────────────

async function loadWorkspaceActivity(wsId) {
  if (!sb || !currentUser) return;
  const { data, error } = await sb.rpc('get_workspace_activity', {
    ws_id: wsId,
    max_results: 50,
  });
  if (error) { console.error('loadWorkspaceActivity:', error); workspaceActivity = []; return; }
  workspaceActivity = data || [];
  renderWorkspaceActivity();
}

// ─── Realtime ─────────────────────────────────────────────────────────────

function subscribeWorkspaceRealtime(wsId) {
  if (workspaceRealtime) sb.removeChannel(workspaceRealtime);

  workspaceRealtime = sb.channel(`workspace-${wsId}`, {
    config: { broadcast: { self: false }, presence: { key: '' } }
  });

  workspaceRealtime
    .on('presence', { event: 'sync' }, () => {
      const state = workspaceRealtime.presenceState();
      renderWorkspacePresence(state);
    })
    .on('presence', { event: 'join' }, ({ key, newPresences }) => {
      if (newPresences.length) showToast(`${newPresences[0].name || 'Someone'} joined the workspace.`);
    })
    .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
      if (leftPresences.length) {
        renderWorkspacePresence(workspaceRealtime.presenceState());
      }
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await workspaceRealtime.track({
          user_id: currentUser.id,
          name: getDisplayName(currentUser),
          online_at: new Date().toISOString(),
        });
      }
    });
}

function renderWorkspacePresence(state) {
  const el = document.getElementById('workspace-presence');
  if (!el) return;
  const users = Object.values(state).flat().filter(Boolean);
  el.innerHTML = users.map(u =>
    `<span class="presence-dot" title="${esc(u.name || 'User')}"></span>`
  ).join('');
}

// ─── UI — Workspace Switcher ──────────────────────────────────────────────

function renderWorkspaceSwitcher() {
  const container = document.getElementById('workspace-switcher');
  if (!container) return;

  let html = `
    <div class="workspace-switcher-header">
      <div class="ws-switcher-label">Workspace</div>
      ${activeWorkspace ? `<button class="ws-settings-btn" onclick="showWorkspaceSettings()" title="Workspace settings"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg></button>` : ''}
    </div>
    <div class="workspace-switcher-current" onclick="toggleWorkspaceDropdown()">
      <span class="ws-current-name">${activeWorkspace ? esc(activeWorkspace.name) : 'Personal'}</span>
      ${activeWorkspace ? `<span id="workspace-presence"></span>` : ''}
      <svg class="ws-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
    </div>
    <div class="workspace-switcher-dropdown" id="ws-dropdown">
      <div class="ws-dropdown-item ${!activeWorkspace ? 'active' : ''}" onclick="switchToPersonal()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        Personal
      </div>
  `;

  for (const ws of workspaces) {
    const hasPending = workspaceMembers.some(m => m.status === 'pending' && m.user_id === currentUser?.id && m.workspace_id === ws.id);
    html += `
      <div class="ws-dropdown-item ${activeWorkspace && activeWorkspace.id === ws.id ? 'active' : ''}" onclick="switchWorkspace('${ws.id}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>
        ${esc(ws.name)}
        <span class="ws-member-count">${ws.member_count}</span>
      </div>
    `;
  }

  // Check for pending invitations (workspaces where user is pending but not yet in activeWorkspace)
  // We show them as separate invitation items if loadWorkspaces doesn't include pending ones
  // For now, pending invitations are shown in workspaceMembers when viewing workspace settings

  html += `
      <div class="ws-dropdown-divider"></div>
      <div class="ws-dropdown-item ws-create-item" onclick="showCreateWorkspaceModal()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        New workspace
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function toggleWorkspaceDropdown() {
  const dd = document.getElementById('ws-dropdown');
  if (!dd) return;
  dd.classList.toggle('open');
  document.addEventListener('click', closeWsDropdown, { once: true });
}

function closeWsDropdown(e) {
  const dd = document.getElementById('ws-dropdown');
  if (!dd) return;
  if (e && e.target.closest('.workspace-switcher-current, .ws-dropdown-item')) return;
  dd.classList.remove('open');
}

// ─── UI — Workspace Members ──────────────────────────────────────────────

function renderWorkspaceMembers() {
  const el = document.getElementById('workspace-members-list');
  if (!el) return;
  if (!workspaceMembers.length) {
    el.innerHTML = '<p class="ws-empty">No members yet.</p>';
    return;
  }
  const currentUserId = currentUser?.id;
  const isOwner = workspaceMembers.some(m => m.user_id === currentUserId && m.role === 'owner' && m.status === 'active');

  el.innerHTML = workspaceMembers.map(m => {
    const isMe = m.user_id === currentUserId;
    const statusLabel = m.status === 'pending' ? ' (pending)' : '';
    return `
      <div class="ws-member-row ${m.status}">
        <div class="ws-member-avatar">${(m.name?.[0] || m.email?.[0] || '?').toUpperCase()}</div>
        <div class="ws-member-info">
          <span class="ws-member-name">${esc(m.name || m.email)}${isMe ? ' <span class="ws-member-you">(you)</span>' : ''}</span>
          <span class="ws-member-email">${esc(m.email)}${statusLabel}</span>
        </div>
        <select class="ws-member-role" ${isOwner && !isMe && m.status === 'active' ? '' : 'disabled'} onchange="changeMemberRole('${activeWorkspace?.id}', '${m.user_id}', this.value)">
          <option value="viewer" ${m.role === 'viewer' ? 'selected' : ''}>Viewer</option>
          <option value="editor" ${m.role === 'editor' ? 'selected' : ''}>Editor</option>
          <option value="owner" ${m.role === 'owner' ? 'selected' : ''}>Owner</option>
        </select>
        ${isOwner && !isMe && m.status === 'active'
          ? `<button class="ws-member-remove" onclick="removeWorkspaceMember('${activeWorkspace?.id}', '${m.user_id}')" title="Remove"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`
          : ''}
        ${m.status === 'pending' && isMe
          ? `<div class="ws-pending-actions">
               <button class="btn-primary btn-xs" onclick="acceptInvitation('${activeWorkspace?.id}')">Accept</button>
               <button class="btn-outline btn-xs" onclick="declineInvitation('${activeWorkspace?.id}')">Decline</button>
             </div>`
          : ''}
      </div>
    `;
  }).join('');
}

// ─── UI — Activity Feed ──────────────────────────────────────────────────

function renderWorkspaceActivity() {
  const el = document.getElementById('workspace-activity-list');
  if (!el) return;
  if (!workspaceActivity.length) {
    el.innerHTML = '<p class="ws-empty">No activity yet.</p>';
    return;
  }
  el.innerHTML = workspaceActivity.map(a => {
    const time = timeAgo(a.created_at);
    return `
      <div class="ws-activity-item">
        <span class="ws-activity-user">${esc(a.user_name)}</span>
        <span class="ws-activity-action">${esc(formatAction(a.action, a.metadata))}</span>
        <span class="ws-activity-time">${time}</span>
      </div>
    `;
  }).join('');
}

function formatAction(action, meta) {
  if (!meta) meta = {};
  switch (action) {
    case 'workspace_created': return 'created this workspace';
    case 'member_invited': return `invited ${meta.email || 'a member'}`;
    case 'member_accepted': return 'joined the workspace';
    case 'invitation_sent': return `sent invitation to ${meta.email || 'email'}`;
    case 'checklist_shared': return 'shared a checklist';
    case 'checklist_unshared': return 'removed a checklist';
    default: return action.replace(/_/g, ' ');
  }
}

function timeAgo(dateStr) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h';
  if (diff < 2592000) return Math.floor(diff / 86400) + 'd';
  return new Date(dateStr).toLocaleDateString();
}

// ─── UI — Share Modal ────────────────────────────────────────────────────

function showShareModal(checklistId) {
  if (!workspaces.length) {
    showToast('Create a workspace first to share checklists.', 'error');
    return;
  }
  const modal = document.getElementById('share-checklist-modal');
  if (!modal) return;
  modal.dataset.clId = checklistId;
  const list = document.getElementById('share-ws-list');
  list.innerHTML = workspaces.filter(w => {
    const m = workspaceMembers.find(m2 => m2.workspace_id === w.id && m2.user_id === currentUser?.id);
    return m && (m.role === 'owner' || m.role === 'editor') && m.status === 'active';
  }).map(ws => `
    <button type="button" class="share-ws-option" onclick="shareChecklist('${ws.id}', '${checklistId}'); closeModal('share-checklist-modal')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>
      ${esc(ws.name)}
    </button>
  `).join('') || '<p class="ws-empty">No workspaces where you can share checklists.</p>';
  modal.classList.add('open');
}

// ─── UI — Create workspace modal ──────────────────────────────────────────

function showCreateWorkspaceModal() {
  closeWsDropdown();
  const modal = document.getElementById('create-workspace-modal');
  if (!modal) return;
  document.getElementById('create-ws-name').value = '';
  modal.classList.add('open');
  setTimeout(() => document.getElementById('create-ws-name').focus(), 100);
}

// ─── UI — Invite member modal ────────────────────────────────────────────

function showInviteMemberModal() {
  const modal = document.getElementById('invite-member-modal');
  if (!modal) return;
  document.getElementById('invite-member-email').value = '';
  document.getElementById('invite-member-role').value = 'editor';
  modal.classList.add('open');
  setTimeout(() => document.getElementById('invite-member-email').focus(), 100);
}

// ─── UI — Workspace Settings Modal ────────────────────────────────────────

function showWorkspaceSettings() {
  if (!activeWorkspace) return;
  const modal = document.getElementById('workspace-settings-modal');
  if (!modal) return;
  document.getElementById('ws-settings-name').value = activeWorkspace.name;
  document.getElementById('ws-settings-plan').textContent = activeWorkspace.plan || 'free';
  updateWorkspaceBillingInfo();
  renderWorkspaceMembers();
  renderWorkspaceActivity();
  showWsSettingsTab('general');
  modal.classList.add('open');
}

function updateWorkspaceBillingInfo() {
  const el = document.getElementById('ws-billing-info');
  if (!el) return;
  const plan = activeWorkspace?.plan || 'free';
  const limits = plan === 'team'
    ? { members: 10, checklists: 500 }
    : { members: 1, checklists: 50 };
  el.innerHTML = `
    <div class="ws-billing-row">
      <span>Plan</span>
      <span class="ws-billing-value">${plan === 'team' ? 'Team' : 'Free'}</span>
    </div>
    <div class="ws-billing-row">
      <span>Max members</span>
      <span class="ws-billing-value">${limits.members}</span>
    </div>
    <div class="ws-billing-row">
      <span>Max checklists</span>
      <span class="ws-billing-value">${limits.checklists}</span>
    </div>
    <div class="ws-billing-row">
      <span>Activity log</span>
      <span class="ws-billing-value">${plan === 'team' ? 'Enabled' : 'N/A'}</span>
    </div>
    <p class="ws-billing-note">${plan === 'free' ? 'Contact us to upgrade to Team plan.' : ''}</p>
  `;
}

// ─── UI — Workspace Settings Tab Switching ───────────────────────────────

function showWsSettingsTab(tab) {
  const tabs = ['general', 'members', 'activity', 'billing', 'danger'];
  tabs.forEach(t => {
    const el = document.getElementById('ws-sec-' + t);
    if (el) el.style.display = t === tab ? 'block' : 'none';
  });
  document.querySelectorAll('#workspace-settings-modal .account-nav-item').forEach((btn, i) => {
    btn.classList.toggle('active', tabs[i] === tab);
  });
}



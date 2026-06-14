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
    if (!still) { activeWorkspace = null; localStorage.removeItem(WS_STORAGE_KEY); }
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
  if (DEV) console.log('[workspace] switchWorkspace:', ws.name, ws.id);
  activeWorkspace = ws;
  localStorage.setItem(WS_STORAGE_KEY, ws.id);
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
  if (window.innerWidth <= 900) closeSidebar();
}

async function switchToPersonal() {
  if (DEV) console.log('[workspace] switchToPersonal');
  const prev = activeWorkspace;
  activeWorkspace = null;
  localStorage.removeItem(WS_STORAGE_KEY);
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
  if (window.innerWidth <= 900) closeSidebar();
}

// ─── Shared checklists ────────────────────────────────────────────────────

async function loadSharedChecklists(wsId) {
  if (!sb || !currentUser) return;
  if (DEV) console.log('[workspace] loadSharedChecklists for ws:', wsId);
  const { data: links, error } = await sb
    .from('workspace_checklists')
    .select('id, checklist_id, shared_by, created_at')
    .eq('workspace_id', wsId);
  if (error) { console.error('[workspace] loadSharedChecklists error:', error); return; }
  if (!links || !links.length) { sharedChecklists = []; if (DEV) console.log('[workspace] no shared checklists found'); return; }
  const ids = links.map(l => l.checklist_id);
  if (DEV) console.log('[workspace] shared checklist ids:', ids);
  const { data: checklistsData, error: clError } = await sb
    .from('checklists')
    .select('id, title, data, user_id')
    .in('id', ids);
  if (clError) { console.error('[workspace] loadSharedChecklists (checklists):', clError); return; }
  const checklistMap = {};
  for (const cl of (checklistsData || [])) checklistMap[cl.id] = cl;
  sharedChecklists = links
    .filter(l => checklistMap[l.checklist_id])
    .map(l => ({
      id: l.checklist_id,
      title: checklistMap[l.checklist_id].title,
      data: checklistMap[l.checklist_id].data,
      _shared: true,
      _owner_id: checklistMap[l.checklist_id].user_id,
      _shared_by: l.shared_by,
      _shared_at: l.created_at,
    }));
  if (DEV) console.log('[workspace] loaded shared checklists:', sharedChecklists.length);
}

async function shareChecklist(wsId, checklistId) {
  if (!sb || !currentUser) return;
  if (DEV) console.log('[workspace] shareChecklist:', checklistId, 'to ws:', wsId);
  const { error } = await sb.rpc('share_checklist_to_workspace', {
    chk_id: checklistId,
    ws_id: wsId,
  });
  if (error) { console.error('[workspace] shareChecklist error:', error); showToast(error.message, 'error'); return; }
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
      <button class="ws-settings-btn" onclick="showWorkspaceManagementModal()" title="Workspace management"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg></button>
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

  const gearSvg = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>';

  for (const ws of workspaces) {
    const hasPending = workspaceMembers.some(m => m.status === 'pending' && m.user_id === currentUser?.id && m.workspace_id === ws.id);
    html += `
      <div class="ws-dropdown-item ${activeWorkspace && activeWorkspace.id === ws.id ? 'active' : ''}">
        <div class="ws-dropdown-item-main" onclick="switchWorkspace('${ws.id}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>
          <span class="ws-dropdown-name">${esc(ws.name)}</span>
        </div>
        <span class="ws-member-count">${ws.member_count}</span>
        <button class="ws-gear-btn" onclick="event.stopPropagation(); showWorkspaceSettingsMenu(event, '${ws.id}')" title="Workspace settings">${gearSvg}</button>
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
}

function closeWsDropdown(e) {
  const dd = document.getElementById('ws-dropdown');
  if (!dd || !dd.classList.contains('open')) return;
  if (e && (e.target.closest('.workspace-switcher-current') || e.target.closest('.workspace-switcher-dropdown'))) return;
  dd.classList.remove('open');
  if (!activeWorkspace) switchToPersonal();
}

document.addEventListener('click', closeWsDropdown);
document.addEventListener('touchstart', closeWsDropdown, { passive: true });

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

let _prevWorkspaceId = undefined; // undefined=no restore, null=restore Personal, string=restore workspace
let _settingsObserver = null;

async function showWorkspaceSettings(wsId) {
  const ws = wsId ? workspaces.find(w => w.id === wsId) : activeWorkspace;
  if (!ws) return;
  const modal = document.getElementById('workspace-settings-modal');
  if (!modal) return;

  const isDifferent = wsId && wsId !== activeWorkspace?.id;

  if (isDifferent) {
    _prevWorkspaceId = activeWorkspace?.id ?? null; // null means Personal
    activeWorkspace = ws;
    await loadWorkspaceMembers(wsId);
    await loadWorkspaceActivity(wsId);
  } else if (activeWorkspace) {
    _prevWorkspaceId = undefined;
    renderWorkspaceMembers();
    renderWorkspaceActivity();
  } else {
    _prevWorkspaceId = undefined;
  }

  document.getElementById('ws-settings-name').value = ws.name;
  document.getElementById('ws-settings-plan').textContent = ws.plan || 'free';
  updateWorkspaceBillingInfo();
  showWsSettingsTab('general');

  const onClose = () => {
    if (!modal.classList.contains('open')) {
      if (_prevWorkspaceId !== undefined) {
        activeWorkspace = _prevWorkspaceId !== null
          ? workspaces.find(w => w.id === _prevWorkspaceId) || null
          : null;
        _prevWorkspaceId = undefined;
        renderWorkspaceSwitcher();
      }
      observer.disconnect();
    }
  };
  if (_settingsObserver) _settingsObserver.disconnect();
  const observer = new MutationObserver(onClose);
  _settingsObserver = observer;
  observer.observe(modal, { attributes: true, attributeFilter: ['class'] });

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

// ─── UI — Workspace Management Modal ────────────────────────────────────

function showWorkspaceManagementModal() {
  closeWsDropdown();
  const modal = document.getElementById('workspace-management-modal');
  if (!modal) return;
  const list = document.getElementById('ws-management-list');
  const gearSvg = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>';

  list.innerHTML = workspaces.map(ws => `
    <div class="ws-management-item">
      <div class="ws-management-item-main" onclick="event.stopPropagation(); closeModal('workspace-management-modal'); switchWorkspace('${ws.id}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>
        <span class="ws-management-name">${esc(ws.name)}</span>
      </div>
      <span class="ws-management-count">${ws.member_count || 0}</span>
      <button class="ws-management-gear" onclick="event.stopPropagation(); closeModal('workspace-management-modal'); showWorkspaceSettingsMenu(event, '${ws.id}')" title="Workspace settings">${gearSvg}</button>
    </div>
  `).join('') || '<p class="ws-empty">No workspaces yet.</p>';

  modal.classList.add('open');
}

// ─── UI — Workspace Settings Context Menu ─────────────────────────────

let _settingsMenuActiveWsId = null;

function showWorkspaceSettingsMenu(e, wsId) {
  closeWsDropdown();
  closeWorkspaceSettingsMenu();
  const ws = workspaces.find(w => w.id === wsId);
  if (!ws) return;
  _settingsMenuActiveWsId = wsId;

  // Create backdrop for mobile
  let backdrop = document.getElementById('ws-settings-menu-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'ws-settings-menu-backdrop';
    backdrop.className = 'ws-settings-menu-backdrop';
    backdrop.addEventListener('click', closeWorkspaceSettingsMenu);
    document.body.appendChild(backdrop);
  }

  // Create or reuse menu element
  let menu = document.getElementById('ws-settings-menu');
  if (!menu) {
    menu = document.createElement('div');
    menu.id = 'ws-settings-menu';
    menu.className = 'ws-settings-menu';
    document.body.appendChild(menu);
  }

  const svgRename = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
  const svgLink = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>';
  const svgUsers = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>';
  const svgDesc = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>';
  const svgLeave = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>';
  const svgDelete = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>';

  menu.innerHTML = `
    <div class="ws-settings-menu-header">${esc(ws.name)}</div>
    <button class="ws-settings-menu-item" onclick="event.stopPropagation(); showRenameModal('${wsId}')">${svgRename} Rename Workspace</button>
    <button class="ws-settings-menu-item" onclick="event.stopPropagation(); copyInviteLink('${wsId}')">${svgLink} Copy Invite Link</button>
    <button class="ws-settings-menu-item" onclick="event.stopPropagation(); showManageMembers('${wsId}')">${svgUsers} Manage Members</button>
    <button class="ws-settings-menu-item" onclick="event.stopPropagation(); showDescriptionModal('${wsId}')">${svgDesc} Change Description</button>
    <div class="ws-settings-menu-divider"></div>
    <button class="ws-settings-menu-item danger" onclick="event.stopPropagation(); confirmLeaveWorkspace('${wsId}')">${svgLeave} Leave Workspace</button>
    <button class="ws-settings-menu-item danger" onclick="event.stopPropagation(); confirmDeleteWorkspace('${wsId}')">${svgDelete} Delete Workspace</button>
  `;

  // On mobile (<600px), the menu becomes a bottom sheet, so positioning is handled by CSS
  if (window.innerWidth < 600) {
    backdrop.classList.add('open');
  } else {
    // Position near click coordinates (dropdown/gear is hidden by now, so use clientX/Y)
    const menuWidth = 240;
    let left = e.clientX;
    let top = e.clientY;

    if (left + menuWidth + 8 > window.innerWidth) {
      left = window.innerWidth - menuWidth - 8;
    }
    if (top + 40 > window.innerHeight) {
      top = window.innerHeight - 310;
    }
    if (top < 8) top = 8;

    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
  }
  menu.classList.add('open');
}

function closeWorkspaceSettingsMenu() {
  const menu = document.getElementById('ws-settings-menu');
  const backdrop = document.getElementById('ws-settings-menu-backdrop');
  if (menu) menu.classList.remove('open');
  if (backdrop) backdrop.classList.remove('open');
  _settingsMenuActiveWsId = null;
}

document.addEventListener('click', function(e) {
  const menu = document.getElementById('ws-settings-menu');
  if (menu && menu.classList.contains('open') && !menu.contains(e.target)) {
    closeWorkspaceSettingsMenu();
  }
});

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeWorkspaceSettingsMenu();
});

// ─── UI — Rename Workspace ─────────────────────────────────────────────

function showRenameModal(wsId) {
  closeWorkspaceSettingsMenu();
  const ws = workspaces.find(w => w.id === wsId);
  if (!ws) return;
  const modal = document.getElementById('workspace-rename-modal');
  if (!modal) return;
  document.getElementById('ws-rename-input').value = ws.name;
  modal.dataset.wsId = wsId;
  modal.classList.add('open');
  setTimeout(() => document.getElementById('ws-rename-input').focus(), 100);
}

function submitRenameWorkspace() {
  const modal = document.getElementById('workspace-rename-modal');
  const wsId = modal.dataset.wsId;
  const name = document.getElementById('ws-rename-input').value.trim();
  if (!name) { showToast('Name is required.', 'error'); return; }
  const btn = document.getElementById('ws-rename-btn');
  btn.disabled = true; btn.textContent = 'Saving…';
  renameWorkspace(wsId, name).then(() => {
    closeModal('workspace-rename-modal');
    btn.disabled = false; btn.textContent = 'Save';
  }).catch(() => {
    btn.disabled = false; btn.textContent = 'Save';
  });
}

// ─── UI — Workspace Description ────────────────────────────────────────

function showDescriptionModal(wsId) {
  closeWorkspaceSettingsMenu();
  const ws = workspaces.find(w => w.id === wsId);
  if (!ws) return;
  const modal = document.getElementById('workspace-description-modal');
  if (!modal) return;
  document.getElementById('ws-description-input').value = ws.description || '';
  modal.dataset.wsId = wsId;
  modal.classList.add('open');
  setTimeout(() => document.getElementById('ws-description-input').focus(), 100);
}

async function submitWorkspaceDescription() {
  const modal = document.getElementById('workspace-description-modal');
  const wsId = modal.dataset.wsId;
  const description = document.getElementById('ws-description-input').value.trim();
  const btn = document.getElementById('ws-desc-btn');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    if (!sb || !currentUser) { showToast('Not authenticated.', 'error'); return; }
    const { error } = await sb.from('workspaces').update({
      description: description || null,
      updated_at: new Date().toISOString(),
    }).eq('id', wsId);
    if (error) { showToast(error.message, 'error'); return; }
    const ws = workspaces.find(w => w.id === wsId);
    if (ws) ws.description = description;
    showToast('Description updated.');
    closeModal('workspace-description-modal');
  } catch (err) {
    showToast(err.message || 'Failed to update description.', 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Save';
  }
}

// ─── UI — Copy Invite Link ─────────────────────────────────────────────

async function copyInviteLink(wsId) {
  closeWorkspaceSettingsMenu();
  const ws = workspaces.find(w => w.id === wsId);
  if (!ws) return;
  try {
    let token = ws.invite_token;
    if (!token) {
      const { data, error } = await sb.rpc('generate_workspace_invite_code', { ws_id: wsId });
      if (error) { showToast(error.message, 'error'); return; }
      token = data;
      ws.invite_token = token;
    }
    const url = `${window.location.origin}/auth/invite/${token}`;
    await navigator.clipboard.writeText(url);
    showToast('Invite link copied');
  } catch (err) {
    showToast('Failed to copy invite link.', 'error');
  }
}

// ─── UI — Manage Members ───────────────────────────────────────────────

async function showManageMembers(wsId) {
  closeWorkspaceSettingsMenu();
  // Load this workspace's data if not already active
  const ws = workspaces.find(w => w.id === wsId);
  if (!ws) return;
  await showWorkspaceSettings(wsId);
  showWsSettingsTab('members');
}

// ─── UI — Leave Workspace ──────────────────────────────────────────────

function confirmLeaveWorkspace(wsId) {
  closeWorkspaceSettingsMenu();
  showConfirmModal({
    label: 'Leave workspace',
    title: 'Leave this workspace?',
    message: 'You will lose access to all shared checklists in this workspace.',
    onConfirm: () => leaveWorkspace(wsId),
  });
}

async function leaveWorkspace(wsId) {
  if (!sb || !currentUser) return;
  const { error } = await sb
    .from('workspace_members')
    .delete()
    .eq('workspace_id', wsId)
    .eq('user_id', currentUser.id);
  if (error) { showToast(error.message, 'error'); return; }
  showToast('You left the workspace.');
  if (activeWorkspace && activeWorkspace.id === wsId) {
    activeWorkspace = null;
    sharedChecklists = [];
    await loadChecklists();
    renderSidebar();
  }
  await loadWorkspaces();
  closeModal('workspace-settings-modal');
}

// ─── UI — Delete Workspace from context menu ──────────────────────────

function confirmDeleteWorkspace(wsId) {
  closeWorkspaceSettingsMenu();
  showConfirmModal({
    label: 'Delete workspace',
    title: 'Delete this workspace?',
    message: 'This action cannot be undone.',
    onConfirm: () => deleteWorkspace(wsId),
  });
}



// ─── Create / Import ──────────────────────────────────────────────────────

async function createBlankChecklist() {
  const cl = {
    id:    uid(),
    title: 'Untitled checklist',
    data:  [{ id: uid(), title: 'Section 1', items: [{ id: uid(), label: 'First item', checked: false }] }],
  };
  if (DEV) console.log('[checklist] createBlankChecklist ws mode:', !!activeWorkspace, 'id:', cl.id);
  if (activeWorkspace) {
    sharedChecklists.unshift(cl);
  } else {
    checklists.unshift(cl);
  }
  renderSidebar();
  loadChecklist(cl.id);
  setTimeout(() => startEditTitle(), 50);
  await persistChecklist(cl);
}

function importChecklist() {
  if (!parsedData || !parsedData.sections.length) return;
  const cl = { id: uid(), title: parsedData.title, data: parsedData.sections };
  checklists.unshift(cl);
  persistChecklist(cl);
  renderSidebar();
  closeModal('upload-modal');
  loadChecklist(cl.id);
  showToast('Checklist imported ✓', 'success');
}

// ─── Sidebar ──────────────────────────────────────────────────────────────

function renderSidebar() {
  renderWorkspaceSwitcher();

  const el = document.getElementById('sidebar-lists');
  el.innerHTML = '';

  const source = activeWorkspace ? sharedChecklists : checklists;

  if (DEV) console.log('[checklist] renderSidebar mode:', activeWorkspace ? 'workspace' : 'personal', 'source length:', source.length);

  if (activeWorkspace) {
    const label = document.getElementById('sidebar-section-label');
    if (label) label.textContent = 'Shared with workspace';
  } else {
    const label = document.getElementById('sidebar-section-label');
    if (label) label.textContent = 'My checklists';
  }

  if (!source.length) {
    el.innerHTML = '<p style="padding:12px 16px;font-size:12px;color:var(--text3);">No checklists yet.</p>';
    return;
  }

  for (const cl of source) {
    const total   = cl.data.reduce((n, s) => n + s.items.length, 0);
    const checked = cl.data.reduce((n, s) => n + s.items.filter(i => i.checked).length, 0);

    const item = document.createElement('div');
    item.className = 'list-item' + (cl.id === activeId ? ' active' : '');
    const trashSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>';
    item.innerHTML = `
      <span class="list-item-icon">${activeWorkspace ? '🏢' : '☑'}</span>
      <span class="list-item-name">${esc(cl.title)}</span>
      <span class="list-item-count">${checked}/${total}</span>
      <button class="list-item-delete-btn" onclick="event.stopPropagation(); confirmDeleteSidebarItem('${cl.title.replace(/'/g, "\\'")}', '${cl.id}')" title="Delete checklist">${trashSvg}</button>
    `;
    item.onclick = () => loadChecklist(cl.id);
    el.appendChild(item);
  }

  if (currentSearchQuery) {
    var items = el.querySelectorAll('.list-item');
    for (var i = 0; i < items.length; i++) {
      var name = items[i].querySelector('.list-item-name');
      if (name && name.textContent.toLowerCase().indexOf(currentSearchQuery) === -1) {
        items[i].style.display = 'none';
      }
    }
  }
}

async function loadChecklist(id) {
  activeId = id;
  dashListCleared = false;

  // Search in current context first, then fall back to universal cache
  let cl = checklists.find(c => c.id === id) || sharedChecklists.find(c => c.id === id) || universalChecklists.find(c => c.id === id);

  // If found but in wrong context, switch
  if (cl) {
    if (cl._workspaceId && (!activeWorkspace || activeWorkspace.id !== cl._workspaceId)) {
      if (DEV) console.log('[checklist] switching to workspace for checklist:', id, 'ws:', cl._workspaceId);
      await switchWorkspace(cl._workspaceId);
      cl = sharedChecklists.find(c => c.id === id);
    } else if (!cl._workspaceId && activeWorkspace) {
      if (DEV) console.log('[checklist] switching to personal for checklist:', id);
      await switchToPersonal();
      cl = checklists.find(c => c.id === id);
    }
  }

  // Not found — try via visitedChecklists
  if (!cl) {
    const v = visitedChecklists.find(v => v.id === id);
    if (v && v.wsId) {
      if (DEV) console.log('[checklist] switching to workspace for checklist:', id, 'ws:', v.wsId);
      await switchWorkspace(v.wsId);
      cl = sharedChecklists.find(c => c.id === id);
    }
    if (!cl && v && !v.wsId && activeWorkspace) {
      if (DEV) console.log('[checklist] switching to personal for checklist:', id);
      await switchToPersonal();
      cl = checklists.find(c => c.id === id);
    }
  }

  if (!cl) { if (DEV) console.log('[checklist] loadChecklist not found:', id); showDashboard(); return; }
  if (DEV) console.log('[checklist] loadChecklist:', id, cl.title);

  // Track visit in universal list
  const idx = visitedChecklists.findIndex(v => v.id === id);
  const total   = cl.data.reduce((n, s) => n + s.items.length, 0);
  const checked = cl.data.reduce((n, s) => n + s.items.filter(i => i.checked).length, 0);
  const entry = { id, title: cl.title, total, checked, lastVisitedAt: Date.now(), wsId: cl._workspaceId || null };
  if (idx !== -1) visitedChecklists.splice(idx, 1);
  visitedChecklists.unshift(entry);

  showDashboard();
  renderChecklist(cl);
  renderSidebar();
  closeSidebar();
}

// ─── Render ───────────────────────────────────────────────────────────────

const ICON_RESET    = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`;
const ICON_TRASH    = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
const ICON_PLUS     = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
const ICON_DOWN     = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>`;
const ICON_MINUS    = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
const ICON_CLOSE    = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
const ICON_DOWNLOAD = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;

function renderChecklist(cl) {
  const detail = document.getElementById('dash-cl-detail');

  const total   = cl.data.reduce((n, s) => n + s.items.length, 0);
  const checked = cl.data.reduce((n, s) => n + s.items.filter(i => i.checked).length, 0);
  const pct     = total ? Math.round(checked / total * 100) : 0;

  detail.innerHTML = `
    <div class="checklist-meta">
      <div class="progress-bar"><div class="progress-bar-fill" style="width: ${pct}%"></div></div>
      <div class="meta-content">
        <h2 class="checklist-title">
          <span id="checklist-title-display" onclick="startEditTitle()">${esc(cl.title)}</span>
          <input class="checklist-title-input" id="checklist-title-input" value="${esc(cl.title)}"
                 onblur="saveTitle()"
                 onkeydown="if(event.key==='Enter') saveTitle()"
                 style="display:none" />
        </h2>
      </div>
      <div class="meta-actions">
        <div class="meta-action-buttons">
          <button class="btn-icon" title="Download Markdown" onclick="downloadChecklist('${esc(cl.id)}')">${ICON_DOWNLOAD}</button>
          <button class="btn-icon" title="Reset all" onclick="resetAll()">${ICON_RESET}</button>
          <button class="btn-icon danger" title="Delete checklist" onclick="confirmDelete('${esc(cl.id)}')">${ICON_TRASH}</button>
        </div>
        <div class="meta-pill" id="dash-meta-pill">${checked} / ${total} done</div>
      </div>
    </div>
    <div class="sections-container" id="sections"></div>
  `;

  renderSections(cl);
  renderDashboardList();
  renderDashboardStats();
}

function renderSections(cl) {
  const container = document.getElementById('sections');
  if (!container) return;
  container.innerHTML = '';

  for (let si = 0; si < cl.data.length; si++) {
    const section = cl.data[si];
    const secDiv  = document.createElement('div');
    secDiv.className = 'section';
    secDiv.innerHTML = `
      <div class="section-header" data-si="${si}">
        <h3 class="section-title">
          <span id="sec-title-${si}" onclick="startEditSection(${si})">${esc(section.title)}</span>
          <input class="section-title-input" id="sec-input-${si}" value="${esc(section.title)}"
                 onblur="saveSection(${si})"
                 onkeydown="if(event.key==='Enter') saveSection(${si})"
                 style="display:none" />
        </h3>
        <div class="section-count">${section.items.filter(i => i.checked).length}/${section.items.length}</div>
        <button class="btn-icon" title="Add item" onclick="addItem(${si})">${ICON_PLUS}</button>
        <button class="btn-icon" title="Add section below" onclick="addSection()">${ICON_DOWN}</button>
        <button class="btn-icon danger" title="Delete section" onclick="deleteSection(${si})">${ICON_MINUS}</button>
      </div>
      <div class="items" id="items-${si}"></div>
    `;
    container.appendChild(secDiv);

    const itemsDiv = document.getElementById(`items-${si}`);
    for (let ii = 0; ii < section.items.length; ii++) {
      itemsDiv.appendChild(createItemRow(cl, si, ii));
    }
  }
}

// ─── Dashboard rendering ───────────────────────────────────────────────────

let dashListCleared = false;

function clearDashboardList() {
  dashListCleared = true;
  renderDashboardList();
  renderDashboardStats();
  document.getElementById('dash-cl-detail').innerHTML = '<div class="dash-cl-placeholder">Select a checklist to view details</div>';
}

function renderDashboardList() {
  const container = document.getElementById('dash-cl-items');
  if (!container) return;

  if (dashListCleared) {
    container.innerHTML = '<div style="padding:12px;font-size:12px;color:var(--text3);text-align:center;">No recent checklists</div>';
    document.getElementById('dash-cl-clear').textContent = 'Show all';
    document.getElementById('dash-cl-clear').onclick = () => { dashListCleared = false; renderDashboardList(); renderDashboardStats(); };
    return;
  }

  container.innerHTML = '';
  if (!visitedChecklists.length) {
    container.innerHTML = '<p style="padding:12px;font-size:12px;color:var(--text3);text-align:center;">No checklists yet.</p>';
    return;
  }

  for (const v of visitedChecklists) {
    const item = document.createElement('div');
    item.className = 'dash-cl-item' + (v.id === activeId ? ' active' : '') + (v.total && v.checked === v.total ? ' completed' : '') + (!v.total ? ' empty' : '');
    item.innerHTML = `
      <div class="dash-cl-item-left">
        <span class="dash-cl-dot"></span>
        <span>${esc(v.title)}</span>
      </div>
      <span class="dash-cl-progress">${v.checked}/${v.total}</span>
    `;
    item.onclick = () => loadChecklist(v.id);
    container.appendChild(item);
  }
  document.getElementById('dash-cl-clear').textContent = 'Clear';
  document.getElementById('dash-cl-clear').onclick = clearDashboardList;
}

function renderDashboardStats() {
  const source = activeWorkspace ? sharedChecklists : checklists;
  let active = 0, completed = 0, totalChecked = 0, totalItems = 0;
  for (const cl of source) {
    const tc = cl.data.reduce((n, s) => n + s.items.filter(i => i.checked).length, 0);
    const ti = cl.data.reduce((n, s) => n + s.items.length, 0);
    totalChecked += tc;
    totalItems   += ti;
    if (ti > 0 && tc === ti) completed++;
    else if (ti > 0 && tc > 0) active++;
  }
  document.getElementById('ds-active').textContent    = active;
  document.getElementById('ds-completed').textContent  = completed;
  let memberCount = 1;
  if (activeWorkspace) {
    const plan = activeWorkspace.plan || 'free';
    if (plan !== 'free' && workspaceMembers.length) memberCount = workspaceMembers.length;
  }
  document.getElementById('ds-members').textContent    = memberCount;
  document.getElementById('ds-success').textContent    = totalItems ? Math.round(totalChecked / totalItems * 100) + '%' : '—';

  const dashTitle = document.getElementById('dash-title');
  if (dashTitle) dashTitle.textContent = 'Dashboard';
  const badge = document.getElementById('dash-badge');
  const cl = source.find(c => c.id === activeId);
  if (cl) {
    const tc = cl.data.reduce((n, s) => n + s.items.filter(i => i.checked).length, 0);
    const ti = cl.data.reduce((n, s) => n + s.items.length, 0);
    if (ti > 0 && tc === ti) {
      badge.textContent = 'Complete';
      badge.className = 'dash-badge visible';
      badge.style.color = 'var(--green)';
      badge.style.background = 'var(--green-dim)';
    } else if (ti > 0 && tc > 0) {
      badge.textContent = 'In Progress';
      badge.className = 'dash-badge visible';
      badge.style.color = 'var(--accent)';
      badge.style.background = 'var(--accent-dim)';
    } else {
      badge.className = 'dash-badge';
    }
  } else {
    badge.className = 'dash-badge';
  }
}

function renderDashboardActivity() {
  const feed = document.getElementById('dash-activity-feed');
  if (!feed) return;
  if (workspaceActivity && workspaceActivity.length) {
    const recent = workspaceActivity.slice(-20).reverse();
    feed.innerHTML = recent.map(a => {
      const initial = (a.user_name || '?')[0].toUpperCase();
      const hue = a.user_id ? parseInt(a.user_id.charCodeAt(0) * 37, 10) % 360 : 200;
      return `<div class="dash-activity-item">
        <div class="dash-activity-avatar" style="background:hsl(${hue},50%,50%)">${initial}</div>
        <div class="dash-activity-text">
          <strong>${esc(a.user_name || 'Someone')}</strong> ${esc(a.action || 'did something')}
          <span class="dash-activity-time">${timeAgo(a.created_at)}</span>
        </div>
      </div>`;
    }).join('');
  } else {
    feed.innerHTML = '<div class="dash-activity-empty">Activity tracking will appear here as your team works.</div>';
  }
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  const days = Math.floor(hrs / 24);
  return days + 'd ago';
}

function createItemRow(cl, si, ii) {
  const item = cl.data[si].items[ii];
  const row  = document.createElement('label');
  row.className = 'item' + (item.checked ? ' checked' : '');
  row.setAttribute('data-si', si);
  row.setAttribute('data-ii', ii);
  row.innerHTML = `
    <input type="checkbox" ${item.checked ? 'checked' : ''} onchange="toggleItem(${si}, ${ii}, this.checked)" />
    <span class="item-label" id="lbl-${si}-${ii}" onclick="event.preventDefault(); startEditItem(${si},${ii})">${esc(item.label)}</span>
    <input class="item-label-input" id="inp-${si}-${ii}" value="${esc(item.label)}"
           onblur="saveItem(${si}, ${ii})"
           onkeydown="if(event.key==='Enter') saveItem(${si}, ${ii})"
           onclick="event.stopPropagation()"
           style="display:none" />
    <button class="item-del" title="Delete"
            onclick="event.stopPropagation(); deleteItem(${si}, ${ii})">${ICON_CLOSE}</button>
  `;
  return row;
}

// ─── Download Markdown ────────────────────────────────────────────────────

function downloadChecklist(id) {
  const cl = getActive();
  if (!cl) return;
  const md   = checklistToMd(cl);
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${cl.title.replace(/[^a-zA-Z0-9 _-]/g, '')}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Checklist downloaded as Markdown');
}

// ─── Checklist interactions ───────────────────────────────────────────────

function getActive() {
  const source = activeWorkspace ? sharedChecklists : checklists;
  return source.find(c => c.id === activeId)
      || checklists.find(c => c.id === activeId);
}

function toggleItem(si, ii, checked) {
  const cl = getActive(); if (!cl) return;
  cl.data[si].items[ii].checked = checked;
  persistChecklist(cl);
  updateHeader(cl);
  renderSidebar();

  // Update progress in visited list
  const v = visitedChecklists.find(v => v.id === cl.id);
  if (v) {
    v.total   = cl.data.reduce((n, s) => n + s.items.length, 0);
    v.checked = cl.data.reduce((n, s) => n + s.items.filter(i => i.checked).length, 0);
  }

  const row = document.querySelector(`[data-si="${si}"][data-ii="${ii}"]`);
  if (row) row.classList.toggle('checked', checked);

  const sec      = cl.data[si];
  const countEl  = document.querySelector(`[data-si="${si}"] .section-count`);
  if (countEl) countEl.textContent = `${sec.items.filter(i => i.checked).length}/${sec.items.length}`;
}

function updateHeader(cl) {
  const total   = cl.data.reduce((n, s) => n + s.items.length, 0);
  const checked = cl.data.reduce((n, s) => n + s.items.filter(i => i.checked).length, 0);
  const pct     = total ? Math.round(checked / total * 100) : 0;
  const pill    = document.getElementById('dash-meta-pill') || document.querySelector('.checklist-meta .meta-pill');
  const fill    = document.querySelector('.progress-bar-fill');
  if (pill) pill.textContent  = `${checked} / ${total} done`;
  if (fill) fill.style.width  = pct + '%';
  renderDashboardStats();
  renderDashboardList();
}

// ─── Inline title editing ─────────────────────────────────────────────────

function startEditTitle() {
  document.getElementById('checklist-title-display').style.display = 'none';
  const inp = document.getElementById('checklist-title-input');
  inp.style.display = 'block'; inp.focus(); inp.select();
}

function saveTitle() {
  const cl  = getActive(); if (!cl) return;
  const val = document.getElementById('checklist-title-input').value.trim() || 'Untitled';
  cl.title  = val;
  document.getElementById('checklist-title-display').textContent   = val;
  document.getElementById('checklist-title-display').style.display = '';
  document.getElementById('checklist-title-input').style.display   = 'none';
  const v = visitedChecklists.find(v => v.id === cl.id);
  if (v) { v.title = val; v.wsId = cl._workspaceId || null; }
  persistChecklist(cl);
  renderSidebar();
}

// ─── Inline section editing ───────────────────────────────────────────────

function startEditSection(si) {
  document.getElementById('sec-title-' + si).style.display = 'none';
  const inp = document.getElementById('sec-input-' + si);
  inp.style.display = 'block'; inp.focus(); inp.select();
}

function saveSection(si) {
  const cl  = getActive(); if (!cl) return;
  const val = document.getElementById('sec-input-' + si).value.trim() || 'Section';
  cl.data[si].title = val;
  document.getElementById('sec-title-' + si).textContent   = val;
  document.getElementById('sec-title-' + si).style.display = '';
  document.getElementById('sec-input-' + si).style.display = 'none';
  persistChecklist(cl);
}

// ─── Inline item editing ──────────────────────────────────────────────────

function startEditItem(si, ii) {
  document.getElementById(`lbl-${si}-${ii}`).style.display = 'none';
  const inp = document.getElementById(`inp-${si}-${ii}`);
  inp.style.display = 'block'; inp.focus(); inp.select();
}

function saveItem(si, ii) {
  const cl  = getActive(); if (!cl) return;
  const val = document.getElementById(`inp-${si}-${ii}`).value.trim();
  if (!val) { deleteItem(si, ii); return; }
  cl.data[si].items[ii].label = val;
  document.getElementById(`lbl-${si}-${ii}`).textContent   = val;
  document.getElementById(`lbl-${si}-${ii}`).style.display = '';
  document.getElementById(`inp-${si}-${ii}`).style.display = 'none';
  persistChecklist(cl);
}

// ─── Add / delete ─────────────────────────────────────────────────────────

function addItem(si) {
  const cl = getActive(); if (!cl) return;
  cl.data[si].items.push({ id: uid(), label: 'New item', checked: false });
  persistChecklist(cl);
  renderSections(cl); updateHeader(cl); renderSidebar();
  const ii = cl.data[si].items.length - 1;
  setTimeout(() => startEditItem(si, ii), 30);
}

function addSection() {
  const cl = getActive(); if (!cl) return;
  cl.data.push({ id: uid(), title: 'New section', items: [{ id: uid(), label: 'New item', checked: false }] });
  persistChecklist(cl);
  renderSections(cl); renderSidebar();
  const si = cl.data.length - 1;
  setTimeout(() => startEditSection(si), 30);
}

function deleteItem(si, ii) {
  const cl = getActive(); if (!cl) return;
  cl.data[si].items.splice(ii, 1);
  persistChecklist(cl);
  renderSections(cl); updateHeader(cl); renderSidebar();
}

function deleteSection(si) {
  const cl = getActive(); if (!cl) return;
  if (cl.data.length === 1) { showToast('At least one section required.'); return; }
  cl.data.splice(si, 1);
  persistChecklist(cl);
  renderSections(cl); updateHeader(cl); renderSidebar();
}

function resetAll() {
  const cl = getActive();
  if (!cl) return;

  showConfirmModal({
    label: 'Reset checklist',
    title: 'Reset all checkboxes?',
    message: 'All completed items will be unchecked.',
    onConfirm: () => {
      cl.data.forEach(section =>
        section.items.forEach(item => item.checked = false)
      );

      persistChecklist(cl);
      renderChecklist(cl);
      renderSidebar();
      showToast('All checkboxes reset.');
    }
  });
}

function confirmDelete(id) {
  showConfirmModal({
    label: 'Delete checklist',
    title: 'Delete this checklist?',
    message: 'This action cannot be undone.',
    onConfirm: () => {
      deleteChecklist(id);
    }
  });
}

// ─── Search ────────────────────────────────────────────────────────────────

let currentSearchQuery = '';

function highlightText(text, query) {
  var idx = text.toLowerCase().indexOf(query);
  if (idx === -1) return esc(text);
  return esc(text.slice(0, idx)) + '<mark>' + esc(text.slice(idx, idx + query.length)) + '</mark>' + esc(text.slice(idx + query.length));
}

function doSidebarSearch() {
  var q = currentSearchQuery;
  var dropdown = document.getElementById('sidebar-search-dropdown');
  dropdown.innerHTML = '';
  dropdown.classList.remove('open');

  renderSidebar();

  if (!q) {
    clearSearchHighlights();
    return;
  }

  var results = [];

  // Search every checklist (personal + all workspaces) for universal results
  var universalSource = checklists.concat(universalChecklists);

  for (var ci = 0; ci < universalSource.length; ci++) {
    var cl = universalSource[ci];
    if (cl.title.toLowerCase().indexOf(q) !== -1) {
      results.push({ type: 'checklist', clId: cl.id, si: -1, ii: -1, sectionTitle: '', html: highlightText(cl.title, q) });
    }
    for (var si = 0; si < cl.data.length; si++) {
      var section = cl.data[si];
      if (section.title.toLowerCase().indexOf(q) !== -1) {
        results.push({ type: 'section', clId: cl.id, si: si, ii: -1, sectionTitle: '', html: highlightText(section.title, q) });
      }
      for (var ii = 0; ii < section.items.length; ii++) {
        var item = section.items[ii];
        if (item.label.toLowerCase().indexOf(q) !== -1) {
          results.push({ type: 'item', clId: cl.id, si: si, ii: ii, sectionTitle: section.title, html: highlightText(item.label, q) });
        }
      }
    }
  }

  var activeCl = getActive();
  if (activeCl) applySearchHighlights(q);

  if (results.length === 0) {
    dropdown.innerHTML = '<div class="search-empty"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg><p>No results for "' + esc(q) + '"</p></div>';
    dropdown.classList.add('open');
    return;
  }

  var html = '';

  var checklistResults = results.filter(function(r) { return r.type === 'checklist'; });
  if (checklistResults.length) {
    html += '<div class="search-result-group-label">Checklist</div>';
    for (var i = 0; i < checklistResults.length; i++) {
      var r = checklistResults[i];
      html += '<div class="search-result-item" data-cl-id="' + r.clId + '" data-type="checklist"><span class="search-result-type">title</span><span class="search-result-label">' + r.html + '</span></div>';
    }
  }

  var sectionResults = results.filter(function(r) { return r.type === 'section'; });
  if (sectionResults.length) {
    html += '<div class="search-result-group-label">Sections</div>';
    for (var i = 0; i < sectionResults.length; i++) {
      var r = sectionResults[i];
      html += '<div class="search-result-item" data-cl-id="' + r.clId + '" data-si="' + r.si + '" data-ii="-1" data-type="section"><span class="search-result-type">section</span><span class="search-result-label">' + r.html + '</span></div>';
    }
  }

  var itemResults = results.filter(function(r) { return r.type === 'item'; });
  if (itemResults.length) {
    var grouped = {};
    for (var i = 0; i < itemResults.length; i++) {
      var r = itemResults[i];
      if (!grouped[r.sectionTitle]) grouped[r.sectionTitle] = [];
      grouped[r.sectionTitle].push(r);
    }
    var sectionNames = Object.keys(grouped);
    for (var s = 0; s < sectionNames.length; s++) {
      html += '<div class="search-result-group-label">' + esc(sectionNames[s]) + '</div>';
      var items = grouped[sectionNames[s]];
      for (var j = 0; j < items.length; j++) {
        var r = items[j];
        html += '<div class="search-result-item" data-cl-id="' + r.clId + '" data-si="' + r.si + '" data-ii="' + r.ii + '" data-type="item"><span class="search-result-label">' + r.html + '</span></div>';
      }
    }
  }

  dropdown.innerHTML = html;
  dropdown.classList.add('open');

  var resultItems = dropdown.querySelectorAll('.search-result-item');
  for (var i = 0; i < resultItems.length; i++) {
    resultItems[i].addEventListener('click', function() {
      var type = this.dataset.type;
      var clId = this.dataset.clId;
      var si = this.dataset.si !== undefined ? parseInt(this.dataset.si) : -1;
      var ii = this.dataset.ii !== undefined ? parseInt(this.dataset.ii) : -1;
      handleSearchResult(type, clId, si, ii);
    });
  }

  if (resultItems.length) {
    resultItems[0].classList.add('highlighted');
  }
}

function applySearchHighlights(q) {
  var cl = getActive();
  if (!cl) return;

  for (var si = 0; si < cl.data.length; si++) {
    var section = cl.data[si];
    if (section.title.toLowerCase().indexOf(q) !== -1) {
      var secEl = document.getElementById('sec-title-' + si);
      if (secEl) secEl.innerHTML = highlightText(section.title, q);
    }
    for (var ii = 0; ii < section.items.length; ii++) {
      var item = section.items[ii];
      if (item.label.toLowerCase().indexOf(q) !== -1) {
        var lblEl = document.getElementById('lbl-' + si + '-' + ii);
        if (lblEl) lblEl.innerHTML = highlightText(item.label, q);
      }
    }
  }
}

function clearSearchHighlights() {
  var cl = getActive();
  if (!cl) return;

  for (var si = 0; si < cl.data.length; si++) {
    var section = cl.data[si];
    var secEl = document.getElementById('sec-title-' + si);
    if (secEl) secEl.textContent = section.title;

    for (var ii = 0; ii < section.items.length; ii++) {
      var item = section.items[ii];
      var lblEl = document.getElementById('lbl-' + si + '-' + ii);
      if (lblEl) lblEl.textContent = item.label;
    }
  }
}

function closeAllSearch() {
  var sidebarInput = document.getElementById('sidebar-search-input');
  if (sidebarInput) {
    sidebarInput.value = '';
    var sidebarDropdown = document.getElementById('sidebar-search-dropdown');
    sidebarDropdown.innerHTML = '';
    sidebarDropdown.classList.remove('open');
  }

  var modal = document.getElementById('search-modal');
  if (modal) {
    modal.classList.remove('open');
    document.getElementById('search-input').value = '';
    document.getElementById('search-results').innerHTML = '';
    document.getElementById('search-empty').style.display = 'none';
  }

  currentSearchQuery = '';
  clearSearchHighlights();
  renderSidebar();
}

function handleSearchResult(type, clId, si, ii) {
  closeAllSearch();

  if (type === 'checklist') {
    if (clId) loadChecklist(clId);
    return;
  }

  if (clId && (type === 'section' || type === 'item')) {
    loadChecklist(clId).then(function() {
      setTimeout(function() {
        if (type === 'section') {
          var el = document.querySelector('.section-header[data-si="' + si + '"]');
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('search-highlight-flash');
            setTimeout(function() { el.classList.remove('search-highlight-flash'); }, 1500);
          }
        } else {
          var el = document.querySelector('[data-si="' + si + '"][data-ii="' + ii + '"]');
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('search-highlight-flash');
            setTimeout(function() { el.classList.remove('search-highlight-flash'); }, 1500);
          }
        }
      }, 50);
    });
  }
}

// ─── Mobile modal search ────────────────────────────────────────────────────

function openSearch() {
  document.getElementById('search-modal').classList.add('open');
  var input = document.getElementById('search-input');
  input.value = '';
  var container = document.getElementById('search-results');
  container.innerHTML = '';
  document.getElementById('search-empty').style.display = 'none';
  setTimeout(function() { input.focus(); }, 50);
}

function closeSearch() {
  document.getElementById('search-modal').classList.remove('open');
  document.getElementById('search-input').blur();
}

function doModalSearch() {
  var q = document.getElementById('search-input').value.trim().toLowerCase();
  var container = document.getElementById('search-results');
  var empty = document.getElementById('search-empty');

  if (!q) {
    container.innerHTML = '';
    empty.style.display = 'none';
    return;
  }

  var results = [];

  // Search every checklist (personal + all workspaces) for universal results
  var universalSource = checklists.concat(universalChecklists);

  for (var ci = 0; ci < universalSource.length; ci++) {
    var cl = universalSource[ci];
    if (cl.title.toLowerCase().indexOf(q) !== -1) {
      results.push({ type: 'checklist', clId: cl.id, si: -1, ii: -1, sectionTitle: '', html: highlightText(cl.title, q) });
    }
    for (var si = 0; si < cl.data.length; si++) {
      var section = cl.data[si];
      if (section.title.toLowerCase().indexOf(q) !== -1) {
        results.push({ type: 'section', clId: cl.id, si: si, ii: -1, sectionTitle: '', html: highlightText(section.title, q) });
      }
      for (var ii = 0; ii < section.items.length; ii++) {
        var item = section.items[ii];
        if (item.label.toLowerCase().indexOf(q) !== -1) {
          results.push({ type: 'item', clId: cl.id, si: si, ii: ii, sectionTitle: section.title, html: highlightText(item.label, q) });
        }
      }
    }
  }

  if (results.length === 0) {
    container.innerHTML = '';
    document.getElementById('search-query-display').textContent = q;
    empty.style.display = 'flex';
    return;
  }

  empty.style.display = 'none';
  var html = '';

  var checklistResults = results.filter(function(r) { return r.type === 'checklist'; });
  if (checklistResults.length) {
    html += '<div class="search-result-group-label">Checklist</div>';
    for (var i = 0; i < checklistResults.length; i++) {
      var r = checklistResults[i];
      html += '<div class="search-result-item" data-cl-id="' + r.clId + '" data-type="checklist"><span class="search-result-type">title</span><span class="search-result-label">' + r.html + '</span></div>';
    }
  }

  var sectionResults = results.filter(function(r) { return r.type === 'section'; });
  if (sectionResults.length) {
    html += '<div class="search-result-group-label">Sections</div>';
    for (var i = 0; i < sectionResults.length; i++) {
      var r = sectionResults[i];
      html += '<div class="search-result-item" data-cl-id="' + r.clId + '" data-si="' + r.si + '" data-ii="-1" data-type="section"><span class="search-result-type">section</span><span class="search-result-label">' + r.html + '</span></div>';
    }
  }

  var itemResults = results.filter(function(r) { return r.type === 'item'; });
  if (itemResults.length) {
    var grouped = {};
    for (var i = 0; i < itemResults.length; i++) {
      var r = itemResults[i];
      if (!grouped[r.sectionTitle]) grouped[r.sectionTitle] = [];
      grouped[r.sectionTitle].push(r);
    }
    var sectionNames = Object.keys(grouped);
    for (var s = 0; s < sectionNames.length; s++) {
      html += '<div class="search-result-group-label">' + esc(sectionNames[s]) + '</div>';
      var items = grouped[sectionNames[s]];
      for (var j = 0; j < items.length; j++) {
        var r = items[j];
        html += '<div class="search-result-item" data-cl-id="' + r.clId + '" data-si="' + r.si + '" data-ii="' + r.ii + '" data-type="item"><span class="search-result-label">' + r.html + '</span></div>';
      }
    }
  }

  container.innerHTML = html;

  var resultItems = container.querySelectorAll('.search-result-item');
  for (var i = 0; i < resultItems.length; i++) {
    resultItems[i].addEventListener('click', function() {
      var type = this.dataset.type;
      var clId = this.dataset.clId;
      var si = this.dataset.si !== undefined ? parseInt(this.dataset.si) : -1;
      var ii = this.dataset.ii !== undefined ? parseInt(this.dataset.ii) : -1;
      handleSearchResult(type, clId, si, ii);
    });
  }

  if (resultItems.length) {
    resultItems[0].classList.add('highlighted');
  }
}

// ─── Event listeners ────────────────────────────────────────────────────────

document.getElementById('sidebar-search-input').addEventListener('input', function() {
  currentSearchQuery = this.value.trim().toLowerCase();
  doSidebarSearch();
});

document.getElementById('sidebar-search-input').addEventListener('keydown', function(e) {
  var dropdown = document.getElementById('sidebar-search-dropdown');
  var items = dropdown.querySelectorAll('.search-result-item');

  if (e.key === 'Escape') {
    this.value = '';
    currentSearchQuery = '';
    dropdown.innerHTML = '';
    dropdown.classList.remove('open');
    clearSearchHighlights();
    renderSidebar();
    this.blur();
    return;
  }

  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!items.length) return;
    e.preventDefault();
    var current = -1;
    for (var i = 0; i < items.length; i++) {
      if (items[i].classList.contains('highlighted')) { current = i; break; }
    }
    items.forEach(function(el) { el.classList.remove('highlighted'); });
    var next = e.key === 'ArrowDown' ? current + 1 : (current <= 0 ? items.length - 1 : current - 1);
    if (next < 0) next = 0;
    if (next >= items.length) next = items.length - 1;
    items[next].classList.add('highlighted');
    items[next].scrollIntoView({ block: 'nearest' });
    return;
  }

  if (e.key === 'Enter') {
    if (!items.length) return;
    e.preventDefault();
    var target = dropdown.querySelector('.search-result-item.highlighted') || items[0];
    var type = target.dataset.type;
    var si = target.dataset.si !== undefined ? parseInt(target.dataset.si) : -1;
    var ii = target.dataset.ii !== undefined ? parseInt(target.dataset.ii) : -1;
    var clId = target.dataset.clId;
    handleSearchResult(type, clId, si, ii);
  }
});

document.addEventListener('click', function(e) {
  var dropdown = document.getElementById('sidebar-search-dropdown');
  if (!dropdown.classList.contains('open')) return;
  if (e.target.closest('.sidebar-search')) return;
  dropdown.classList.remove('open');
});

function ensureExpanded(si, callback) {
  var section = document.querySelector('.section-header[data-si="' + si + '"]');
  if (section && section.classList.contains('collapsed')) {
    toggleSection2(si);
    setTimeout(callback, 50);
  } else {
    callback();
  }
}

document.addEventListener('keydown', function(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    var sidebarInput = document.getElementById('sidebar-search-input');
    if (sidebarInput.offsetParent !== null) {
      sidebarInput.focus();
    } else {
      openSearch();
    }
  }
});

document.getElementById('search-input').addEventListener('input', function() {
  currentSearchQuery = this.value.trim().toLowerCase();
  doSidebarSearch();
  doModalSearch();
});

document.getElementById('search-modal').addEventListener('click', function(e) {
  if (e.target === this) closeSearch();
});

document.getElementById('search-input').addEventListener('keydown', function(e) {
  var container = document.getElementById('search-results');
  var items = container.querySelectorAll('.search-result-item');

  if (e.key === 'Escape') {
    closeSearch();
    e.preventDefault();
    return;
  }

  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!items.length) return;
    e.preventDefault();
    var current = -1;
    for (var i = 0; i < items.length; i++) {
      if (items[i].classList.contains('highlighted')) { current = i; break; }
    }
    items.forEach(function(el) { el.classList.remove('highlighted'); });
    var next = e.key === 'ArrowDown' ? current + 1 : (current <= 0 ? items.length - 1 : current - 1);
    if (next < 0) next = 0;
    if (next >= items.length) next = items.length - 1;
    items[next].classList.add('highlighted');
    items[next].scrollIntoView({ block: 'nearest' });
    return;
  }

  if (e.key === 'Enter') {
    if (!items.length) return;
    e.preventDefault();
    var target = container.querySelector('.search-result-item.highlighted') || items[0];
    var type = target.dataset.type;
    var si = target.dataset.si !== undefined ? parseInt(target.dataset.si) : -1;
    var ii = target.dataset.ii !== undefined ? parseInt(target.dataset.ii) : -1;
    var clId = target.dataset.clId;
    handleSearchResult(type, clId, si, ii);
  }
});

function confirmDeleteSidebarItem(name, id) {
  showConfirmModal({
    label: 'Delete Checklist',
    title: 'Delete Checklist',
    message: 'Are you sure you want to delete "' + name + '"?\nThis action cannot be undone.',
    onConfirm: () => deleteChecklist(id),
  });
}
// ─── Config — replace with your Supabase project values ─────────────────
// Get these from: supabase.com → your project → Settings → API
const SUPABASE_URL  = 'https://gnzkwjzssumrnafqrmof.supabase.co';
const SUPABASE_ANON = 'sb_publishable_4O8Oegbf4JCx1nynZiHPlA_N41BvOpR';

// ─── State ───────────────────────────────────────────────────────────────
const { createClient } = supabase;
let sb          = null;
let currentUser = null;
let parsedData  = null;
let checklists  = [];   // [{ id, title, data: [{id, title, items: [{id, label, checked}]}] }]
let activeId    = null;
let authMode    = 'login';
let saving      = false;

// ─── Init ─────────────────────────────────────────────────────────────────
function initSupabase() {
  if (SUPABASE_URL === 'https://YOUR_PROJECT.supabase.co' || SUPABASE_ANON === 'YOUR_ANON_KEY_HERE') {
    console.error('[CheckOps] Supabase configuration required. Please update SUPABASE_URL and SUPABASE_ANON.');
    showAuthError('Supabase is not configured. Please set your API keys.');
    return false;
  }
  try {
    sb = createClient(SUPABASE_URL, SUPABASE_ANON);
    return true;
  } catch(e) {
    console.error('[CheckOps] Supabase init failed:', e.message);
    showAuthError('Failed to initialize Supabase: ' + e.message);
    return false;
  }
}

async function init() {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app-screen').style.display = 'none';

  const ok = initSupabase();
  if (!ok) return;

  const { data: { session } } = await sb.auth.getSession();

  if (session?.user) {
    currentUser = session.user;
    await enterApp();
  }

  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      currentUser = session.user;
      await enterApp();
    }

    if (event === 'SIGNED_OUT') {
      currentUser = null;
      document.getElementById('auth-screen').style.display = 'flex';
      document.getElementById('app-screen').style.display = 'none';
    }
  });
}

// ─── Auth ─────────────────────────────────────────────────────────────────
function switchTab(mode) {
  authMode = mode;
  document.querySelectorAll('.auth-tab').forEach((t, i) => {
    t.classList.toggle('active', (mode === 'login' && i === 0) || (mode === 'signup' && i === 1));
  });
  document.getElementById('auth-btn').textContent = mode === 'login' ? 'Sign in' : 'Create account';
  document.querySelector('.auth-title').textContent = mode === 'login' ? 'Welcome back' : 'Create your account';
  clearAuthMessages();
}

async function doAuth() {
  if (!sb) {
    showAuthError('Supabase is not configured. This app requires Supabase authentication.');
    return;
  }

  const email = document.getElementById('auth-email').value.trim();
  const pass  = document.getElementById('auth-password').value;
  if (!email || !pass) { showAuthError('Please fill in all fields.'); return; }

if (pass.length < 8) {
  showAuthError('Password must be at least 8 characters.');
  return;
}

  const btn = document.getElementById('auth-btn');
  btn.disabled    = true;
  btn.textContent = 'Please wait...';
  clearAuthMessages();

  try {
    let result;
    if (authMode === 'login') {
      result = await sb.auth.signInWithPassword({ email, password: pass });
    } else {
       result = await sb.auth.signUp({
          email,
          password: pass,
          options: {
    emailRedirectTo: 'https://check-ops.netlify.app'
  }
});
      if (!result.error && result.data.user && !result.data.session) {
        showAuthMsg('Check your email (and spam folder) to confirm your account.');
        btn.disabled = false;
        btn.textContent = authMode === 'login' ? 'Sign in' : 'Create account';
        return;
      }
    }
    if (result.error) throw result.error;
    currentUser = result.data.user;
    await enterApp();
  } catch (err) {
    showAuthError(err.message || 'Authentication failed.');
  } finally {
    btn.disabled    = false;
    btn.textContent = authMode === 'login' ? 'Sign in' : 'Create account';
  }
}

async function enterApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app-screen').style.display  = 'block';
  const email = currentUser.email || '';
  document.getElementById('user-email-display').textContent = email;
  document.getElementById('user-avatar').textContent        = email[0]?.toUpperCase() || '?';
  await loadChecklists();
}

async function signOut() {
  if (sb) await sb.auth.signOut();
  currentUser = null;
  activeId    = null;
  checklists  = [];
  document.getElementById('app-screen').style.display  = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
}

// ─── Supabase DB ──────────────────────────────────────────────────────────
async function loadChecklists() {
  if (!sb || !currentUser) {
    showToast('Cannot load checklists: Supabase not configured or user not authenticated.', 'error');
    return;
  }
  const { data, error } = await sb
    .from('checklists')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });
  if (error) { showToast('Load failed: ' + error.message, 'error'); return; }
  checklists = (data || []).map(r => ({ id: r.id, title: r.title, data: r.data }));
  renderSidebar();
}

async function persistChecklist(cl) {
  if (!sb || !currentUser) {
    showToast('Cannot save: Supabase not configured or user not authenticated.', 'error');
    return;
  }
  if (saving) return;
  saving = true;
  try {
    const { error } = await sb.from('checklists').upsert(
      { id: cl.id, user_id: currentUser.id, title: cl.title, data: cl.data, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    );
    if (error) showToast('Save failed: ' + error.message, 'error');
  } finally {
    saving = false;
  }
}

async function deleteChecklist(id) {
  if (!sb || !currentUser) {
    showToast('Cannot delete: Supabase not configured or user not authenticated.', 'error');
    return;
  }
  checklists = checklists.filter(c => c.id !== id);
  await sb.from('checklists').delete().eq('id', id);
  if (activeId === id) { activeId = null; showEmptyState(); }
  renderSidebar();
  showToast('Checklist deleted.');
}

// ─── Markdown Parser ──────────────────────────────────────────────────────
function parseMd(text) {
  const lines    = text.split('\n');
  const sections = [];
  let current    = null;

  for (const raw of lines) {
    const line = raw.trimEnd();

    const hMatch = line.match(/^#{1,6}\s+(.+)/);
    if (hMatch) {
      current = { id: uid(), title: hMatch[1].trim(), items: [] };
      sections.push(current);
      continue;
    }

    const cbMatch = line.match(/^[-*+]\s+\[([ xX])\]\s+(.*)/);
    if (cbMatch) {
      if (!current) { current = { id: uid(), title: 'General', items: [] }; sections.push(current); }
      current.items.push({ id: uid(), label: cbMatch[2].trim(), checked: cbMatch[1].toLowerCase() === 'x' });
      continue;
    }

    const listMatch = line.match(/^[-*+]\s+(?!\[)(.*)/);
    if (listMatch && listMatch[1].trim()) {
      if (!current) { current = { id: uid(), title: 'General', items: [] }; sections.push(current); }
      current.items.push({ id: uid(), label: listMatch[1].trim(), checked: false });
    }
  }

  return sections.filter(s => s.items.length > 0);
}

// ─── Create / Import ──────────────────────────────────────────────────────
function createBlankChecklist() {
  const cl = {
    id:    uid(),
    title: 'Untitled checklist',
    data:  [{ id: uid(), title: 'Section 1', items: [{ id: uid(), label: 'First item', checked: false }] }],
  };
  checklists.unshift(cl);
  persistChecklist(cl);
  renderSidebar();
  loadChecklist(cl.id);
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
  const el = document.getElementById('sidebar-lists');
  el.innerHTML = '';

  if (!checklists.length) {
    el.innerHTML = '<p style="padding:12px 16px;font-size:12px;color:var(--text3);">No checklists yet.</p>';
    return;
  }

  for (const cl of checklists) {
    const total   = cl.data.reduce((n, s) => n + s.items.length, 0);
    const checked = cl.data.reduce((n, s) => n + s.items.filter(i => i.checked).length, 0);
    const item = document.createElement('div');
    item.className = 'list-item' + (cl.id === activeId ? ' active' : '');
    item.innerHTML = `
      <span class="list-item-icon">☑</span>
      <span class="list-item-name">${esc(cl.title)}</span>
      <span class="list-item-count">${checked}/${total}</span>
    `;
    item.onclick = () => loadChecklist(cl.id);
    el.appendChild(item);
  }
}

function loadChecklist(id) {
  activeId = id;
  const cl = checklists.find(c => c.id === id);
  if (!cl) { showEmptyState(); return; }
  renderChecklist(cl);
  renderSidebar();
}

function renderChecklist(cl) {
  const checklist = document.getElementById('checklist-view');
  const emptyState = document.getElementById('empty-state');

  const total   = cl.data.reduce((n, s) => n + s.items.length, 0);
  const checked = cl.data.reduce((n, s) => n + s.items.filter(i => i.checked).length, 0);
  const pct = total ? Math.round(checked / total * 100) : 0;

  checklist.innerHTML = `
    <div class="checklist-meta">
      <div class="progress-bar"><div class="progress-bar-fill" style="width: ${pct}%"></div></div>
      <div class="meta-content">
        <h2 class="checklist-title">
          <span id="checklist-title-display" ondblclick="startEditTitle()">${esc(cl.title)}</span>
          <input class="checklist-title-input" id="checklist-title-input" value="${esc(cl.title)}" onblur="saveTitle()" onkeydown="if(event.key==='Enter') saveTitle()" style="display:none" />
        </h2>
        <div class="meta-pill">${checked} / ${total} done</div>
      </div>
      <button class="btn-icon" title="Reset all" onclick="resetAll()">↻</button>
      <button class="btn-icon danger" title="Delete" onclick="confirmDelete('${cl.id}')">🗑</button>
    </div>
    <div class="sections-container" id="sections"></div>
  `;

  document.getElementById('empty-state').style.display = 'none';
  checklist.style.display = 'block';

  renderSections(cl);
}

function renderSections(cl) {
  const container = document.getElementById('sections');
  if (!container) return;
  container.innerHTML = '';

  for (let si = 0; si < cl.data.length; si++) {
    const section = cl.data[si];
    const secDiv = document.createElement('div');
    secDiv.className = 'section';
    secDiv.innerHTML = `
      <div class="section-header" data-si="${si}">
        <h3 class="section-title">
          <span id="sec-title-${si}" ondblclick="startEditSection(${si})">${esc(section.title)}</span>
          <input class="section-title-input" id="sec-input-${si}" value="${esc(section.title)}" onblur="saveSection(${si})" onkeydown="if(event.key==='Enter') saveSection(${si})" style="display:none" />
        </h3>
        <div class="section-count">${section.items.filter(i => i.checked).length}/${section.items.length}</div>
        <button class="btn-icon" title="Add item" onclick="addItem(${si})">+</button>
        <button class="btn-icon" title="Add section below" onclick="addSection()">↓</button>
        <button class="btn-icon danger" title="Delete section" onclick="deleteSection(${si})">−</button>
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

function createItemRow(cl, si, ii) {
  const item = cl.data[si].items[ii];
  const row = document.createElement('label');
  row.className = 'item' + (item.checked ? ' checked' : '');
  row.setAttribute('data-si', si);
  row.setAttribute('data-ii', ii);
  row.innerHTML = `
    <input type="checkbox" ${item.checked ? 'checked' : ''} onchange="toggleItem(${si}, ${ii}, this.checked)" />
    <span class="item-label" id="lbl-${si}-${ii}" ondblclick="startEditItem(${si},${ii})">${esc(item.label)}</span>
    <input class="item-label-input" id="inp-${si}-${ii}" value="${esc(item.label)}"
           onblur="saveItem(${si}, ${ii})"
           onkeydown="if(event.key==='Enter') saveItem(${si}, ${ii})"
           onclick="event.stopPropagation()" style="display:none" />
    <button class="item-del" title="Delete"
            onclick="event.stopPropagation(); deleteItem(${si}, ${ii})">✕</button>
  `;
  return row;
}

// ─── Interactions ─────────────────────────────────────────────────────────
function getActive() { return checklists.find(c => c.id === activeId); }

function toggleItem(si, ii, checked) {
  const cl = getActive(); if (!cl) return;
  cl.data[si].items[ii].checked = checked;
  persistChecklist(cl);
  updateHeader(cl);
  renderSidebar();
  const row = document.querySelector(`[data-si="${si}"][data-ii="${ii}"]`)
  if (row) row.classList.toggle('checked', checked);
  const sec     = cl.data[si];
  const countEl = document.querySelector(`[data-si="${si}"] .section-count`);
  if (countEl) countEl.textContent = `${sec.items.filter(i => i.checked).length}/${sec.items.length}`;
}

function updateHeader(cl) {
  const total   = cl.data.reduce((n, s) => n + s.items.length, 0);
  const checked = cl.data.reduce((n, s) => n + s.items.filter(i => i.checked).length, 0);
  const pct     = total ? Math.round(checked / total * 100) : 0;
  const pill    = document.querySelector('.checklist-meta .meta-pill');
  const fill    = document.querySelector('.progress-bar-fill');
  if (pill) pill.textContent     = `${checked} / ${total} done`;
  if (fill) fill.style.width     = pct + '%';
}

function startEditTitle() {
  document.getElementById('checklist-title-display').style.display = 'none';
  const inp = document.getElementById('checklist-title-input');
  inp.style.display = 'block'; inp.focus(); inp.select();
}
function saveTitle() {
  const cl  = getActive(); if (!cl) return;
  const val = document.getElementById('checklist-title-input').value.trim() || 'Untitled';
  cl.title  = val;
  document.getElementById('checklist-title-display').textContent  = val;
  document.getElementById('checklist-title-display').style.display = '';
  document.getElementById('checklist-title-input').style.display   = 'none';
  persistChecklist(cl); renderSidebar();
}

function startEditSection(si) {
  document.getElementById('sec-title-' + si).style.display = 'none';
  const inp = document.getElementById('sec-input-' + si);
  inp.style.display = 'block'; inp.focus(); inp.select();
}
function saveSection(si) {
  const cl  = getActive(); if (!cl) return;
  const val = document.getElementById('sec-input-' + si).value.trim() || 'Section';
  cl.data[si].title = val;
  document.getElementById('sec-title-' + si).textContent  = val;
  document.getElementById('sec-title-' + si).style.display = '';
  document.getElementById('sec-input-' + si).style.display = 'none';
  persistChecklist(cl);
}

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
  document.getElementById(`lbl-${si}-${ii}`).textContent  = val;
  document.getElementById(`lbl-${si}-${ii}`).style.display = '';
  document.getElementById(`inp-${si}-${ii}`).style.display = 'none';
  persistChecklist(cl);
}

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
  const cl = getActive(); if (!cl) return;
  if (!confirm('Reset all checkboxes? This cannot be undone.')) return;
  cl.data.forEach(s => s.items.forEach(i => i.checked = false));
  persistChecklist(cl);
  renderChecklist(cl); renderSidebar();
  showToast('All checkboxes reset.');
}

function confirmDelete(id) {
  if (confirm('Delete this checklist?')) deleteChecklist(id);
}

// ─── File Upload ──────────────────────────────────────────────────────────
function showUploadModal() {
  document.getElementById('upload-modal').classList.add('open');
  parsedData = null;
  document.getElementById('import-btn').style.display    = 'none';
  document.getElementById('parse-preview').style.display = 'none';
}
function showNewListModal() { showUploadModal(); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function handleDragOver(e)  { e.preventDefault(); document.getElementById('upload-zone').classList.add('drag'); }
function handleDragLeave()  { document.getElementById('upload-zone').classList.remove('drag'); }
function handleDrop(e)      { e.preventDefault(); handleDragLeave(); const f = e.dataTransfer.files[0]; if (f) readMdFile(f); }
function handleFileSelect(inp) { if (inp.files[0]) readMdFile(inp.files[0]); }

function readMdFile(file) {
  if (!file.name.match(/\.(md|markdown)$/i) && file.type !== 'text/markdown') {
    showToast('Please upload a .md file.', 'error'); return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    const text     = e.target.result;
    const sections = parseMd(text);
    if (!sections.length) { showToast('No checklist items found in this file.', 'error'); return; }
    const title = (text.match(/^#\s+(.+)/m) || [])[1]?.trim()
                || file.name.replace(/\.(md|markdown)$/i, '');
    parsedData = { title, sections };

    const prev = document.getElementById('parse-preview');
    prev.style.display = 'block';
    prev.innerHTML = `<strong style="color:var(--accent)">${esc(title)}</strong><br><br>` +
      sections.map(s =>
        `<span style="color:var(--text3)">## ${esc(s.title)}</span><br>` +
        s.items.map(i => `&nbsp;&nbsp;- [ ] ${esc(i.label)}`).join('<br>')
      ).join('<br><br>');

    document.getElementById('import-btn').style.display = 'flex';
    document.getElementById('upload-zone').querySelector('.upload-zone-text').textContent = file.name;
  };
  reader.readAsText(file);
}

// ─── UI Helpers ───────────────────────────────────────────────────────────
function showEmptyState() {
  document.getElementById('empty-state').style.display    = 'flex';
  document.getElementById('checklist-view').style.display = 'none';
}

function showToast(msg, type = 'default') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className   = 'toast ' + type;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => {
    t.style.opacity    = '0';
    t.style.transition = 'opacity 0.3s';
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  el.style.display = 'block';
  document.getElementById('auth-msg').style.display = 'none';
}
function showAuthMsg(msg) {
  const el = document.getElementById('auth-msg');
  el.textContent = msg;
  el.style.display = 'block';
  document.getElementById('auth-error').style.display = 'none';
}
function clearAuthMessages() {
  document.getElementById('auth-error').style.display = 'none';
  document.getElementById('auth-msg').style.display   = 'none';
}

// ─── Utilities ────────────────────────────────────────────────────────────

function uid() {
  return crypto.randomUUID();
}
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Boot ─────────────────────────────────────────────────────────────────
init();
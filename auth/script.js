// ─── Config — replace with your Supabase project values ─────────────────
// Get these from: supabase.com → your project → Settings → API

// ─── State ───────────────────────────────────────────────────────────────
const { createClient } = supabase;
let sb          = null;
let currentUser = null;
let parsedData  = null;
let checklists  = [];   // [{ id, title, data: [{id, title, items: [{id, label, checked}]}] }]
let activeId    = null;
let authView    = 'login';
let saving      = false;

// ─── Init ─────────────────────────────────────────────────────────────────
function initSupabase() {
  if (SUPABASE_URL === 'https://YOUR_PROJECT.supabase.co' || SUPABASE_ANON === 'YOUR_ANON_KEY_HERE') {
    console.error('[CheckOps] Supabase configuration required. Please update SUPABASE_URL and SUPABASE_ANON.');
    showAuthError('Supabase is not configured. Please set your API keys.');
    return false;
  }
  try {
    sb = createClient(SUPABASE_URL, SUPABASE_ANON, SUPABASE_OPTIONS);

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

  await handleAuthCallback();

  const { data: { session }, error: sessionError } = await sb.auth.getSession();

  if (sessionError) await clearStaleAuth();

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

function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.classList.toggle('showing', show);
  btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
}

function getPasswordStrength(pw) {
  if (!pw.length) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ['Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['#f7768e', '#e0af68', '#9ece6a', '#27c93f'];
  return { score, label: labels[score - 1] ?? 'Weak', color: colors[score - 1] ?? colors[0] };
}

function updatePasswordStrength() {
  const pw = document.getElementById('register-password').value;
  const wrap = document.getElementById('password-strength');
  if (!pw.length) { wrap.hidden = true; return; }
  const s = getPasswordStrength(pw);
  wrap.hidden = false;
  wrap.querySelectorAll('.auth-strength-bars span').forEach((bar, i) => {
    bar.style.background = i < s.score ? s.color : 'rgba(255,255,255,0.08)';
  });
  const lbl = wrap.querySelector('.auth-strength-label');
  lbl.textContent = s.label;
  lbl.style.color = s.color;
}

function updateRegisterBtn() {
  document.getElementById('register-btn').disabled = !document.getElementById('register-agreed').checked;
}

async function clearStaleAuth() {
  if (!sb) return;
  await sb.auth.signOut({ scope: 'local' });
}

async function handleAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (!code) return;

  const { error } = await sb.auth.exchangeCodeForSession(code);
  window.history.replaceState({}, document.title, window.location.pathname);

  if (error) {
    await clearStaleAuth();
    showAuthError('GitHub sign-in failed: ' + error.message);
    return;
  }
}

async function signInWithGitHub() {
  if (!sb) { showAuthError('Supabase is not configured.'); return; }
  clearAuthMessages();
  await clearStaleAuth();
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

// ─── LOGIN ───────────────────────────────────────────────────────────────
async function handleLoginSubmit(e) {
  e.preventDefault();
  if (!sb) { showAuthError('Supabase is not configured.'); return; }

  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-password').value;
  if (!email || !pass) { showAuthError('Please fill in all fields.'); return; }

  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  btn.textContent = 'Signing in…';
  clearAuthMessages();

  try {
    // Step 1: Check email exists directly in DB
    const { data: emailExists, error: rpcError } = await sb.rpc('check_email_exists', { input_email: email });

    if (rpcError) {
      showAuthError('Something went wrong. Please try again.');
      return;
    }

    if (!emailExists) {
      showAuthError('Email does not exist. Please create a new account.');
      return;
    }

    // Step 2: Email exists — attempt login
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
    btn.disabled = false;
    btn.textContent = 'Sign in';
  }
}

// ─── REGISTER ────────────────────────────────────────────────────────────
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
  btn.disabled = true;
  btn.textContent = 'Creating account…';
  clearAuthMessages();

  try {
    // Step 1: Direct DB check
    const { data: emailExists, error: rpcError } = await sb.rpc('check_email_exists', { input_email: email });

    if (rpcError) {
      showAuthError('Something went wrong. Please try again.');
      return;
    }

    if (emailExists) {
      showAuthError('This email is already registered. Please log in.');
      return;
    }

    // Step 2: Email doesn't exist — create account
    const { data, error } = await sb.auth.signUp({
      email,
      password: pass,
      options: {
        emailRedirectTo: AUTH_REDIRECT(),
        data: { full_name: name }
      }
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

async function handleForgotSubmit(e) {
  e.preventDefault();
  if (!sb) { showAuthError('Supabase is not configured.'); return; }

  const email = document.getElementById('forgot-email').value.trim();
  if (!email) { showAuthError('Please enter your email.'); return; }

  const btn = document.getElementById('forgot-btn');
  btn.disabled = true;
  btn.textContent = 'Sending…';
  clearAuthMessages();

  try {
    // Step 1: Direct DB check
    const { data: emailExists, error: rpcError } = await sb.rpc('check_email_exists', { input_email: email });

    if (rpcError) {
      showAuthError('Something went wrong. Please try again.');
      return;
    }

    if (!emailExists) {
      showAuthError('No account exists with this email address.');
      return;
    }

    // Step 2: Email exists — send reset link
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: AUTH_REDIRECT(),
    });
    if (error) throw error;

    switchAuthView('forgot-sent');

  } catch (err) {
    showAuthError(err.message || 'Failed to send reset link.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send reset link';
  }
}

async function enterApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app-screen').style.display  = 'block';
  updateUserDisplay();
  await loadChecklists();
}

function getDisplayName(user) {
  if (!user) return 'Account';
  const meta = user.user_metadata || {};
  return meta.full_name || meta.name || user.email?.split('@')[0] || 'Account';
}

function getAvatarLetter(user) {
  const name = getDisplayName(user);
  return name[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?';
}

function updateUserDisplay() {
  if (!currentUser) return;
  const name  = getDisplayName(currentUser);
  const email = currentUser.email || '';
  const letter = getAvatarLetter(currentUser);
  document.getElementById('user-name-display').textContent   = name;
  document.getElementById('user-email-display').textContent  = email;
  document.getElementById('user-avatar').textContent           = letter;
}

function showAccountMsg(msg, type = 'success') {
  const el = document.getElementById('account-msg');
  el.textContent = msg;
  el.className = 'account-msg ' + type;
}

function clearAccountMsg() {
  const el = document.getElementById('account-msg');
  el.textContent = '';
  el.className = 'account-msg';
}

function showAccountModal() {
  if (!currentUser) return;
  clearAccountMsg();
  const name  = getDisplayName(currentUser);
  const email = currentUser.email || '';
  document.getElementById('account-modal-title').textContent  = name;
  document.getElementById('account-modal-email').textContent = email;
  document.getElementById('account-modal-avatar').textContent  = getAvatarLetter(currentUser);
  document.getElementById('account-name-input').value  = currentUser.user_metadata?.full_name || name;
  document.getElementById('account-email-input').value = '';
  document.getElementById('account-new-password').value = '';
  document.getElementById('account-confirm-password').value = '';
  document.getElementById('invite-email-input').value = '';
  document.getElementById('account-modal').classList.add('open');
}

async function handleUpdateName(e) {
  e.preventDefault();
  if (!sb || !currentUser) return;
  const name = document.getElementById('account-name-input').value.trim();
  if (!name) { showAccountMsg('Please enter a name.', 'error'); return; }

  const btn = document.getElementById('account-name-btn');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  try {
    const { data, error } = await sb.auth.updateUser({ data: { full_name: name } });
    if (error) throw error;
    currentUser = data.user;
    updateUserDisplay();
    document.getElementById('account-modal-title').textContent = name;
    document.getElementById('account-modal-avatar').textContent = getAvatarLetter(currentUser);
    showAccountMsg('Name updated successfully.');
    showToast('Profile updated.');
  } catch (err) {
    showAccountMsg(err.message || 'Failed to update name.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save name';
  }
}

async function handleChangeEmail(e) {
  e.preventDefault();
  if (!sb || !currentUser) return;
  const email = document.getElementById('account-email-input').value.trim();
  if (!email) { showAccountMsg('Please enter a new email.', 'error'); return; }

  const btn = document.getElementById('account-email-btn');
  btn.disabled = true;
  btn.textContent = 'Sending…';

  try {
    const { error } = await sb.auth.updateUser({ email });
    if (error) throw error;
    showAccountMsg('Confirmation sent — check your new inbox (and spam folder).');
    showToast('Email confirmation sent.');
  } catch (err) {
    showAccountMsg(err.message || 'Failed to update email.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Update email';
  }
}

async function handleChangePassword(e) {
  e.preventDefault();
  if (!sb || !currentUser) return;
  const pw  = document.getElementById('account-new-password').value;
  const confirm = document.getElementById('account-confirm-password').value;
  if (pw.length < 8) { showAccountMsg('Password must be at least 8 characters.', 'error'); return; }
  if (pw !== confirm) { showAccountMsg('Passwords do not match.', 'error'); return; }

  const btn = document.getElementById('account-password-btn');
  btn.disabled = true;
  btn.textContent = 'Updating…';

  try {
    const { error } = await sb.auth.updateUser({ password: pw });
    if (error) throw error;
    document.getElementById('account-new-password').value = '';
    document.getElementById('account-confirm-password').value = '';
    showAccountMsg('Password updated successfully.');
    showToast('Password changed.');
  } catch (err) {
    showAccountMsg(err.message || 'Failed to change password.', 'error');
  } finally {
    btn.disabled = false;
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

function handleSendInvite(e) {
  e.preventDefault();
  const to = document.getElementById('invite-email-input').value.trim();
  if (!to) { showAccountMsg('Enter an email address to invite.', 'error'); return; }

  const link = window.location.origin;
  const from = getDisplayName(currentUser);
  const subject = encodeURIComponent(`${from} invited you to CheckOps`);
  const body = encodeURIComponent(
    `Hi,\n\n${from} invited you to join CheckOps — persistent checklists for engineering teams.\n\nSign up here: ${link}\n\nSee you there!`
  );
  window.open(`mailto:${to}?subject=${subject}&body=${body}`, '_blank');
  showAccountMsg('Invite opened in your email app.');
  showToast('Invite email ready to send.');
}

async function copyInviteLink() {
  const link = window.location.origin;
  try {
    await navigator.clipboard.writeText(link);
    showAccountMsg('Invite link copied to clipboard.');
    showToast('Invite link copied.');
  } catch {
    showAccountMsg('Could not copy — link: ' + link, 'error');
  }
}

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
  closeSidebar();
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
  const zone = document.getElementById('upload-zone');
  if (zone) {
    zone.classList.remove('drag');
    zone.querySelector('.upload-zone-text').textContent = 'Drop your .md file here';
  }
  document.getElementById('md-file-input').value = '';
}
function showNewListModal() {
  document.getElementById('new-checklist-modal').classList.add('open');
}
function chooseUploadChecklist() {
  closeModal('new-checklist-modal');
  showUploadModal();
}
function chooseBlankChecklist() {
  closeModal('new-checklist-modal');
  createBlankChecklist();
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-backdrop').classList.toggle('open');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-backdrop').classList.remove('open');
}

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
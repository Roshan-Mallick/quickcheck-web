const { createClient } = supabase;

const SUPABASE_URL  = 'https://gnzkwjzssumrnafqrmof.supabase.co';
const SUPABASE_ANON = 'sb_publishable_4O8Oegbf4JCx1nynZiHPlA_N41BvOpR';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: { detectSessionInUrl: true, flowType: 'pkce', persistSession: true }
});

let ADMIN_EMAIL   = null;
let templates     = [];
let deleteId      = null;
let pendingFile   = null;
let _settingsUser = null;
let _pendingNewEmail = null;
let _otpCooldownTimer = null;

/* ─── TOTP / 2FA Helpers ──────────────────── */
let _totpSecret = null;
let _pendingLoginUser = null;
let _pendingTOTPSecret = null;

function base32Encode(bytes) {
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let r = '', b = 0, bits = 0;
  for (const v of bytes) {
    b = (b << 8) | v; bits += 8;
    while (bits >= 5) { bits -= 5; r += c[(b >> bits) & 31]; }
  }
  if (bits > 0) r += c[(b << (5 - bits)) & 31];
  while (r.length % 8) r += '=';
  return r;
}

function base32Decode(s) {
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  s = s.replace(/=+$/, '').toUpperCase();
  const bytes = [];
  let b = 0, bits = 0;
  for (const ch of s) {
    const idx = c.indexOf(ch);
    if (idx < 0) continue;
    b = (b << 5) | idx; bits += 5;
    if (bits >= 8) { bits -= 8; bytes.push(b >> bits); b &= (1 << bits) - 1; }
  }
  return new Uint8Array(bytes);
}

async function verifyTOTP(secret, token) {
  const key = await crypto.subtle.importKey('raw', base32Decode(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  for (let d = -1; d <= 1; d++) {
    let t = Math.floor(now / 30) + d;
    const buf = new Uint8Array(8);
    for (let i = 7; i >= 0; i--) { buf[i] = t & 0xff; t >>= 8; }
    const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, buf));
    const off = sig[19] & 15;
    const code = ((sig[off] & 127) << 24) | (sig[off + 1] << 16) | (sig[off + 2] << 8) | sig[off + 3];
    if (String(code % 1000000).padStart(6, '0') === token) return true;
  }
  return false;
}

async function loadTOTPSecret() {
  _totpSecret = null;
  const { data, error } = await sb.from('admin_config').select('value').eq('key', 'totp_secret');
  if (error) { console.error('[totp] load error:', error); return null; }
  _totpSecret = data && data.length ? data[0].value : null;
  return _totpSecret;
}

async function saveTOTPSecret(secret) {
  const { data } = await sb.from('admin_config').select('key').eq('key', 'totp_secret');
  if (data && data.length) {
    await sb.from('admin_config').update({ value: secret }).eq('key', 'totp_secret');
  } else {
    await sb.from('admin_config').insert({ key: 'totp_secret', value: secret });
  }
  _totpSecret = secret;
}

function generateTOTPSecret() {
  const b = new Uint8Array(20);
  crypto.getRandomValues(b);
  return base32Encode(b);
}

function updateTOTPButton() {
  const btn = document.getElementById('totp-nav-btn');
  if (!btn) return;
  if (_totpSecret) {
    btn.textContent = 'Manage 2FA';
    btn.style.display = '';
  } else {
    btn.textContent = 'Enable 2FA';
    btn.style.display = '';
  }
}

function openTOTPModal() {
  document.getElementById('totp-modal').style.display = 'flex';
  document.getElementById('totp-setup-msg').className = 'admin-msg';
  document.getElementById('totp-setup-msg').style.display = 'none';
  document.getElementById('totp-remove-msg').className = 'admin-msg';
  document.getElementById('totp-remove-msg').style.display = 'none';

  if (_totpSecret) {
    document.getElementById('totp-setup-view').style.display = 'none';
    document.getElementById('totp-manage-view').style.display = 'block';
    document.getElementById('totp-remove-input').value = '';
    document.getElementById('totp-remove-input').focus();
  } else {
    document.getElementById('totp-setup-view').style.display = 'block';
    document.getElementById('totp-manage-view').style.display = 'none';
    startTOTPSetup();
  }
}

function closeTOTPModal() {
  document.getElementById('totp-modal').style.display = 'none';
  _pendingTOTPSecret = null;
}

function logAuthState(label) {
  sb.auth.getUser().then(({ data }) => {
    console.log(`[auth] ${label}:`, {
      sessionEmail: data.user?.email,
      adminConfigEmail: ADMIN_EMAIL,
    });
  });
}

async function loadAdminConfig() {
  ADMIN_EMAIL = null;
  const { data, error } = await sb
    .from('admin_config')
    .select('key, value')
    .eq('key', 'admin_email');
  if (error) {
    console.error('[admin_config] load error:', error);
    return;
  }
  if (data && data.length > 0) {
    ADMIN_EMAIL = data[0].value;
  }
  console.log('[admin_config] loaded:', { ADMIN_EMAIL });
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('admin-email').value.trim();
  const errEl = document.getElementById('admin-login-error');
  if (!email || !email.includes('@')) {
    errEl.textContent = 'Enter a valid email.';
    errEl.style.display = 'block';
    return;
  }

  await loadAdminConfig();

  if (ADMIN_EMAIL && email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    errEl.textContent = 'Wrong email. Only the current admin email can log in.';
    errEl.style.display = 'block';
    return;
  }

  const btn = document.getElementById('admin-login-btn');
  btn.disabled = true;
  btn.textContent = 'Sending OTP…';

  const { error } = await sb.auth.signInWithOtp({ email });

  btn.disabled = false;
  btn.textContent = 'Send OTP';

  if (error) {
    errEl.textContent = error.message;
    errEl.style.display = 'block';
    return;
  }

  _loginEmail = email;
  document.getElementById('admin-login-btn').style.display = 'none';
  document.getElementById('login-otp-row').style.display = 'flex';
  document.getElementById('login-otp').value = '';
  document.getElementById('login-otp').disabled = false;
  document.getElementById('login-otp').focus();
  document.getElementById('login-otp-verify-btn').style.display = '';
  document.getElementById('login-otp-verify-btn').disabled = false;
  document.getElementById('login-otp-verify-btn').textContent = 'Verify';
  errEl.className = 'admin-error admin-error-success';
  errEl.textContent = 'OTP sent to ' + email + '.';
  errEl.style.display = 'block';

  if (_otpCooldownTimer) clearInterval(_otpCooldownTimer);
  _otpCooldownTimer = null;
  document.getElementById('login-otp-resend-btn').textContent = 'Resend';
  document.getElementById('login-otp-resend-btn').disabled = false;
}

let _loginEmail = null;

async function verifyLoginOtp() {
  const otp = document.getElementById('login-otp').value.trim();
  const errEl = document.getElementById('admin-login-error');
  if (!otp || !_loginEmail) return;

  const btn = document.getElementById('login-otp-verify-btn');
  btn.disabled = true;
  btn.textContent = 'Verifying…';

  try {
    const { data, error } = await sb.auth.verifyOtp({
      email: _loginEmail,
      token: otp,
      type: 'email',
    });
    if (error) throw error;

    if (data?.session) {
      await sb.auth.setSession(data.session);
    }

    await loadAdminConfig();

    const user = data.user;

    if (!ADMIN_EMAIL || user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      errEl.className = 'admin-error';
      errEl.textContent = 'Email mismatch. This account is not the current admin.';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Verify';
      return;
    }

    await loadTOTPSecret();
    if (_totpSecret) {
      _pendingLoginUser = user;
      document.getElementById('totp-verify-modal').style.display = 'flex';
      document.getElementById('totp-verify-input').value = '';
      document.getElementById('totp-verify-input').focus();
      document.getElementById('totp-verify-error').style.display = 'none';
      document.getElementById('totp-verify-error').className = 'admin-error';
      document.getElementById('totp-verify-btn').disabled = false;
      document.getElementById('totp-verify-btn').textContent = 'Verify';
      return;
    }

    enterDashboard(user);

  } catch (err) {
    const msg = (err.message || '').toLowerCase();
    errEl.className = 'admin-error';

    if (msg.includes('expired') || msg.includes('otp_expired')) {
      errEl.textContent = 'OTP has expired. Click "Resend" to get a new code.';
      btn.style.display = 'none';
      document.getElementById('login-otp').value = '';
      document.getElementById('login-otp').disabled = true;
    } else {
      errEl.textContent = err.message;
      btn.disabled = false;
      btn.textContent = 'Verify';
    }

    errEl.style.display = 'block';
  }
}

function resendLoginOtp() {
  if (!_loginEmail) return;
  if (_otpCooldownTimer) return;

  const btn = document.getElementById('login-otp-resend-btn');
  const errEl = document.getElementById('admin-login-error');

  btn.disabled = true;
  btn.textContent = 'Sending…';

  sb.auth.signInWithOtp({ email: _loginEmail }).then(() => {
    let cooldown = 60;
    const verifyBtn = document.getElementById('login-otp-verify-btn');
    const otpInput = document.getElementById('login-otp');

    verifyBtn.style.display = '';
    verifyBtn.disabled = false;
    verifyBtn.textContent = 'Verify';
    otpInput.disabled = false;
    otpInput.value = '';
    otpInput.focus();

    errEl.className = 'admin-error admin-error-success';
    errEl.textContent = 'OTP sent to ' + _loginEmail + '. It expires in 60 seconds.';
    errEl.style.display = 'block';

    if (_otpCooldownTimer) clearInterval(_otpCooldownTimer);
    _otpCooldownTimer = setInterval(() => {
      cooldown--;
      btn.textContent = cooldown + 's';
      btn.disabled = true;
      if (cooldown <= 0) {
        clearInterval(_otpCooldownTimer);
        _otpCooldownTimer = null;
        btn.textContent = 'Resend';
        btn.disabled = false;
      }
    }, 1000);
  }).catch((err) => {
    btn.disabled = false;
    btn.textContent = 'Resend';
    errEl.className = 'admin-error';
    errEl.textContent = err.message || 'Failed to resend.';
    errEl.style.display = 'block';
  });
}

function cancelTOTPVerify() {
  document.getElementById('totp-verify-modal').style.display = 'none';
  _pendingLoginUser = null;
  if (_otpCooldownTimer) { clearInterval(_otpCooldownTimer); _otpCooldownTimer = null; }
  sb.auth.signOut();
  document.getElementById('admin-login-btn').style.display = '';
  document.getElementById('login-otp-row').style.display = 'none';
  document.getElementById('admin-email').value = '';
}

async function verifyTOTPAndLogin() {
  const token = document.getElementById('totp-verify-input').value.trim();
  const errEl = document.getElementById('totp-verify-error');
  try {
    if (!token || token.length !== 6 || !/^\d{6}$/.test(token)) {
      errEl.textContent = 'Enter a valid 6-digit code.';
      errEl.style.display = 'block';
      return;
    }
    const btn = document.getElementById('totp-verify-btn');
    btn.disabled = true;
    btn.textContent = 'Verifying…';
    const valid = await verifyTOTP(_totpSecret, token);
    if (!valid) {
      errEl.textContent = 'Invalid code. Please try again.';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Verify';
      return;
    }
    document.getElementById('totp-verify-modal').style.display = 'none';
    enterDashboard(_pendingLoginUser);
    _pendingLoginUser = null;
  } catch (e) {
    console.error('[totp] verifyTOTPAndLogin error:', e);
    errEl.textContent = 'Error: ' + (e.message || 'Verification failed');
    errEl.style.display = 'block';
  }
}

let _recoveryUser = null;

async function sendRecoveryOtp() {
  if (!_recoveryUser) return;
  const btn = document.getElementById('recovery-send-btn');
  btn.disabled = true;
  btn.textContent = 'Sending…';
  const { error } = await sb.auth.signInWithOtp({
    email: _recoveryUser.email,
    options: { shouldCreateUser: false },
  });
  btn.disabled = false;
  btn.textContent = 'Send OTP';
  if (error) {
    document.getElementById('recovery-error').textContent = error.message;
    document.getElementById('recovery-error').style.display = 'block';
    return;
  }
  document.getElementById('recovery-send-btn').style.display = 'none';
  document.getElementById('recovery-otp').style.display = '';
  document.getElementById('recovery-verify-btn').style.display = '';
  document.getElementById('recovery-info').textContent = 'OTP sent to your email.';
}

async function verifyRecoveryOtp() {
  if (!_recoveryUser) return;
  const otp = document.getElementById('recovery-otp').value.trim();
  if (!otp) return;
  const btn = document.getElementById('recovery-verify-btn');
  btn.disabled = true;
  btn.textContent = 'Verifying…';
  const { data, error } = await sb.auth.verifyOtp({
    email: _recoveryUser.email,
    token: otp,
    type: 'email',
  });
  btn.disabled = false;
  btn.textContent = 'Verify';
  if (error) {
    document.getElementById('recovery-error').textContent = error.message;
    document.getElementById('recovery-error').style.display = 'block';
    return;
  }
  const { error: adminErr } = await sb
    .from('admin_config')
    .update({ value: _recoveryUser.email })
    .eq('key', 'admin_email');
  if (adminErr) {
    console.error('[recovery] update admin_email failed:', adminErr);
    document.getElementById('recovery-error').textContent = 'Failed to update admin email: ' + adminErr.message;
    document.getElementById('recovery-error').style.display = 'block';
    return;
  }
  await loadAdminConfig();
  document.getElementById('recovery-otp').value = '';
  enterDashboard(_recoveryUser);
}

function cancelRecovery() {
  _recoveryUser = null;
  document.getElementById('recovery-section').style.display = 'none';
  document.getElementById('login-form').style.display = 'block';
  document.getElementById('admin-login-error').style.display = 'none';
  document.getElementById('recovery-otp').value = '';
  document.getElementById('recovery-otp').style.display = 'none';
  document.getElementById('recovery-verify-btn').style.display = 'none';
  document.getElementById('recovery-send-btn').style.display = '';
  document.getElementById('recovery-error').style.display = 'none';
  document.getElementById('recovery-info').textContent = '';
}

function enterDashboard(user) {
  if (!ADMIN_EMAIL || user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    logAuthState('enterDashboard REJECTED');
    sb.auth.signOut();
    document.getElementById('admin-login-error').textContent = 'Unauthorized email. Access denied.';
    document.getElementById('admin-login-error').style.display = 'block';
    return;
  }
  _settingsUser = user;
  document.getElementById('login-screen').style.display  = 'none';
  document.getElementById('dashboard-screen').style.display = 'block';
  document.getElementById('admin-email-display').textContent = user.email;
  updateTOTPButton();
  loadTemplates();
}

function handleLogout() {
  if (_otpCooldownTimer) clearInterval(_otpCooldownTimer);
  _otpCooldownTimer = null;
  sb.auth.signOut();
  document.getElementById('login-screen').style.display  = 'flex';
  document.getElementById('dashboard-screen').style.display = 'none';
  document.getElementById('admin-email').value = '';
}

async function loadTemplates() {
  const { data, error } = await sb
    .from('templates')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) { showMsg('error', 'Failed to load: ' + error.message); return; }

  templates = data || [];
  renderTable();
}

function renderTable() {
  const tbody = document.getElementById('templates-tbody');
  const empty = document.getElementById('admin-empty');

  if (templates.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  tbody.innerHTML = templates.map(t => {
    const cat = t.category
      ? `<span class="admin-cat-badge">${esc(t.category)}</span>`
      : '<span style="color:var(--muted-2)">—</span>';
    return `<tr>
      <td><strong>${esc(t.title)}</strong></td>
      <td>${cat}</td>
      <td style="color:var(--muted);font-size:.8rem">${fmtDate(t.created_at)}</td>
      <td style="color:var(--muted);font-size:.8rem">${fmtDate(t.updated_at)}</td>
      <td><div class="admin-actions">
        <button class="admin-btn admin-btn-outline" onclick="editTemplate('${t.id}')">Edit</button>
        <button class="admin-btn admin-btn-danger" onclick="showDeleteModal('${t.id}')">Delete</button>
      </div></td>
    </tr>`;
  }).join('');
}

function showUploadModal() {
  pendingFile = null;
  document.getElementById('admin-file-input').value = '';
  document.getElementById('admin-upload-preview').className = 'admin-upload-preview';
  document.getElementById('admin-upload-preview').innerHTML = '';
  document.getElementById('admin-upload-confirm').style.display = 'none';
  document.getElementById('upload-modal').style.display = 'flex';
}

function handleUploadFile(input) {
  const file = input.files[0];
  if (!file) return;
  parseUploadedFile(file);
}

function handleUploadDrop(e) {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (!file) return;
  parseUploadedFile(file);
}

function parseUploadedFile(file) {
  if (!file.name.endsWith('.md') && !file.name.endsWith('.markdown')) {
    showMsg('error', 'Please select a .md file.');
    return;
  }
  const reader = new FileReader();
  reader.onload = (ev) => {
    const markdown = ev.target.result;
    const title = parseTitle(markdown) || file.name.replace(/\.md$/i, '');
    pendingFile = { title, markdown };
    const preview = document.getElementById('admin-upload-preview');
    preview.className = 'admin-upload-preview show';
    preview.innerHTML = `<strong>${esc(title)}</strong> &middot; ${markdown.length} chars`;
    document.getElementById('admin-upload-confirm').style.display = 'inline-flex';
  };
  reader.readAsText(file);
}

async function confirmUpload() {
  if (!pendingFile) return;
  const { error } = await sb.from('templates').insert({
    title: pendingFile.title,
    markdown: pendingFile.markdown,
  });
  if (error) { showMsg('error', 'Upload failed: ' + error.message); return; }
  closeModal('upload-modal');
  showMsg('success', `"${pendingFile.title}" uploaded.`);
  pendingFile = null;
  loadTemplates();
}

function showCreateModal() {
  document.getElementById('edit-modal-title').textContent = 'Create Template';
  document.getElementById('edit-id').value = '';
  document.getElementById('edit-title').value = '';
  document.getElementById('edit-description').value = '';
  document.getElementById('edit-category').value = '';
  document.getElementById('edit-markdown').value = '';
  document.getElementById('edit-save-btn').textContent = 'Create';
  document.getElementById('edit-modal').style.display = 'flex';
}

function editTemplate(id) {
  const t = templates.find(x => x.id === id);
  if (!t) return;
  document.getElementById('edit-modal-title').textContent = 'Edit Template';
  document.getElementById('edit-id').value = t.id;
  document.getElementById('edit-title').value = t.title;
  document.getElementById('edit-description').value = t.description || '';
  document.getElementById('edit-category').value = t.category || '';
  document.getElementById('edit-markdown').value = t.markdown;
  document.getElementById('edit-save-btn').textContent = 'Save';
  document.getElementById('edit-modal').style.display = 'flex';
}

async function handleSaveTemplate(e) {
  e.preventDefault();
  const id          = document.getElementById('edit-id').value;
  const title       = document.getElementById('edit-title').value.trim();
  const description = document.getElementById('edit-description').value.trim();
  const category    = document.getElementById('edit-category').value.trim();
  const markdown    = document.getElementById('edit-markdown').value;
  const btn         = document.getElementById('edit-save-btn');

  btn.disabled = true;
  btn.textContent = 'Saving…';

  const payload = { title, description: description || null, category: category || null, markdown };

  let error;
  if (id) {
    ({ error } = await sb.from('templates').update(payload).eq('id', id));
  } else {
    ({ error } = await sb.from('templates').insert(payload));
  }

  btn.disabled = false;
  btn.textContent = id ? 'Save' : 'Create';

  if (error) { showMsg('error', 'Save failed: ' + error.message); return; }

  closeModal('edit-modal');
  showMsg('success', id ? `"${title}" updated.` : `"${title}" created.`);
  loadTemplates();
}

function showDeleteModal(id) {
  const t = templates.find(x => x.id === id);
  if (!t) return;
  deleteId = id;
  document.getElementById('delete-title').textContent = t.title;
  document.getElementById('delete-modal').style.display = 'flex';
}

async function confirmDelete() {
  if (!deleteId) return;
  const { error } = await sb.from('templates').delete().eq('id', deleteId);
  if (error) { showMsg('error', 'Delete failed: ' + error.message); return; }
  closeModal('delete-modal');
  showMsg('success', 'Template deleted.');
  deleteId = null;
  loadTemplates();
}

function openSettings() {
  const user = _settingsUser;
  if (!user) return;
  document.getElementById('settings-current-email').value = ADMIN_EMAIL;
  document.getElementById('settings-new-email').value = '';
  document.getElementById('settings-email-otp-group').style.display = 'none';
  document.getElementById('settings-email-totp-group').style.display = 'none';
  document.getElementById('settings-email-otp').value = '';
  document.getElementById('settings-email-send-btn').style.display = 'inline-flex';
  document.getElementById('settings-email-msg').style.display = 'none';
  _pendingNewEmail = null;
  document.getElementById('settings-modal').style.display = 'flex';
}

function closeSettings() {
  document.getElementById('settings-modal').style.display = 'none';
  document.getElementById('settings-email-send-btn').style.display = 'inline-flex';
  document.getElementById('settings-email-otp-group').style.display = 'none';
  document.getElementById('settings-email-totp-group').style.display = 'none';
  document.getElementById('settings-email-otp').value = '';
  _pendingNewEmail = null;
}

async function sendEmailOtp() {
  const user = _settingsUser;
  if (!user) return;
  const newEmail = document.getElementById('settings-new-email').value.trim();
  if (!newEmail || !newEmail.includes('@')) {
    showSettingsMsg('email', 'error', 'Enter a valid new email.');
    return;
  }
  if (newEmail === user.email) {
    showSettingsMsg('email', 'error', 'New email is the same as current.');
    return;
  }
  _pendingNewEmail = newEmail;

  const btn = document.getElementById('settings-email-send-btn');
  btn.disabled = true;
  btn.textContent = 'Sending OTP…';

  console.log('[admin-email] sendEmailOtp — sending OTP to:', user.email, 'new email:', newEmail);

  const { error } = await sb.auth.signInWithOtp({
    email: user.email,
    options: { shouldCreateUser: false },
  });

  btn.disabled = false;
  btn.textContent = 'Update Email';

  if (error) {
    console.error('[admin-email] sendEmailOtp error:', error);
    showSettingsMsg('email', 'error', error.message);
    return;
  }

  console.log('[admin-email] OTP sent successfully to:', user.email);
  document.getElementById('settings-email-send-btn').style.display = 'none';
  document.getElementById('settings-email-otp-group').style.display = 'block';
  document.getElementById('settings-email-otp').value = '';
  document.getElementById('settings-email-otp').focus();
  showSettingsMsg('email', 'success', 'OTP sent to your current email.');
}

async function verifyEmailOtp() {
  if (!_settingsUser || !_pendingNewEmail) return;

  // Refresh user from session to avoid stale email
  const { data: { user } } = await sb.auth.getUser();
  if (!user?.email) {
    showSettingsMsg('email', 'error', 'Session expired. Please log in again.');
    return;
  }
  _settingsUser = user;

  const otp = document.getElementById('settings-email-otp').value.trim();
  if (!otp) return;

  console.log('[admin-email] verifyEmailOtp payload:', {
    email: user.email,
    otpLength: otp.length,
    otpChars: [...otp].map(c => c.charCodeAt(0)),
    type: 'email',
    pendingNewEmail: _pendingNewEmail,
  });

  const btn = document.getElementById('settings-email-verify-btn');
  btn.disabled = true;
  btn.textContent = 'Verifying…';

  try {
    const { data: verifyData, error } = await sb.auth.verifyOtp({
      email: user.email,
      token: otp,
      type: 'email',
    });

    console.log('[admin-email] verifyOtp result:', {
      success: !error,
      error: error ? { message: error.message, code: error.code, status: error.status } : null,
      hasSession: !!verifyData?.session,
      hasUser: !!verifyData?.user,
    });

    if (error) {
      if (error.message?.toLowerCase().includes('expired') || error.code === 'otp_expired') {
        throw new Error('OTP has expired or is invalid. Click "Resend" to get a new code.');
      }
      throw error;
    }

    // OTP verified — check if TOTP is required before completing change
    btn.disabled = false;
    btn.textContent = 'Verify';
    await loadTOTPSecret();
    if (_totpSecret) {
      document.getElementById('settings-email-otp-group').style.display = 'none';
      document.getElementById('settings-email-totp-group').style.display = 'block';
      document.getElementById('settings-email-totp').value = '';
      document.getElementById('settings-email-totp').focus();
      showSettingsMsg('email', 'success', 'OTP verified. Enter your 2FA code.');
      return;
    }

    await completeEmailChange();

  } catch (err) {
    console.error('[admin-email] verifyEmailOtp error:', err);
    showSettingsMsg('email', 'error', err.message || 'Verification failed.');
    btn.disabled = false;
    btn.textContent = 'Verify';
  }
}

function resendEmailOtp() {
  const user = _settingsUser;
  if (!user) return;

  console.log('[admin-email] resendEmailOtp — resending OTP to:', user.email);

  document.getElementById('settings-email-otp').value = '';
  document.getElementById('settings-email-otp').focus();

  const btn = document.getElementById('settings-email-resend-btn');
  btn.disabled = true;
  btn.textContent = 'Sending…';

  sb.auth.signInWithOtp({
    email: user.email,
    options: { shouldCreateUser: false },
  }).then(() => {
    btn.disabled = false;
    btn.textContent = 'Resend code';
    showSettingsMsg('email', 'success', 'OTP resent to your current email.');
    console.log('[admin-email] OTP resent successfully');
  }).catch((err) => {
    btn.disabled = false;
    btn.textContent = 'Resend code';
    console.error('[admin-email] resend failed:', err);
  });
}

async function completeEmailChange() {
  const { error: rpcError } = await sb.rpc('admin_update_auth_email', {
    new_email: _pendingNewEmail,
  });
  if (rpcError) {
    showSettingsMsg('email', 'error', rpcError.message || 'Failed to update email.');
    return;
  }
  const { data: refreshData, error: refreshError } = await sb.auth.refreshSession();
  if (refreshError) {
    console.error('[admin-email] session refresh failed:', refreshError);
    const { data: userData } = await sb.auth.getUser();
    if (userData?.user) _settingsUser = userData.user;
  } else if (refreshData?.user) {
    _settingsUser = refreshData.user;
  }
  await loadAdminConfig();
  _settingsUser = { ..._settingsUser, email: _pendingNewEmail };
  document.getElementById('admin-email-display').textContent = _pendingNewEmail;
  document.getElementById('settings-current-email').value = _pendingNewEmail;
  const changedEmail = _pendingNewEmail;
  _pendingNewEmail = null;
  showSettingsMsg('email', 'success', 'Email changed to ' + changedEmail + '.');
  setTimeout(closeSettings, 1500);
}

async function verifyEmailTOTP() {
  const token = document.getElementById('settings-email-totp').value.trim();
  try {
    if (!token || token.length !== 6 || !/^\d{6}$/.test(token)) {
      showSettingsMsg('email', 'error', 'Enter a valid 6-digit code.');
      return;
    }
    const btn = document.getElementById('settings-email-totp-btn');
    btn.disabled = true;
    btn.textContent = 'Verifying…';
    const valid = await verifyTOTP(_totpSecret, token);
    if (!valid) {
      showSettingsMsg('email', 'error', 'Invalid 2FA code. Try again.');
      btn.disabled = false;
      btn.textContent = 'Verify';
      return;
    }
    document.getElementById('settings-email-totp-group').style.display = 'none';
    btn.disabled = false;
    btn.textContent = 'Verify';
    await completeEmailChange();
  } catch (e) {
    console.error('[totp] verifyEmailTOTP error:', e);
    showSettingsMsg('email', 'error', 'Error: ' + (e.message || 'Unknown error'));
  }
}

/* ─── TOTP Setup ─────────────────────────── */
function startTOTPSetup() {
  _pendingTOTPSecret = generateTOTPSecret();
  const uri = 'otpauth://totp/Quickcheck:Admin?secret=' + _pendingTOTPSecret + '&issuer=Quickcheck&algorithm=SHA1&digits=6&period=30';
  document.getElementById('totp-secret-display').value = _pendingTOTPSecret.match(/.{1,4}/g).join(' ');
  document.getElementById('totp-setup-verify-input').value = '';
  document.getElementById('totp-setup-verify-input').focus();
  document.getElementById('totp-setup-msg').className = 'admin-msg';
  document.getElementById('totp-setup-msg').style.display = 'none';
  console.log('[totp] generating QR for:', uri.slice(0, 60) + '…');
  const img = document.getElementById('totp-qr-img');
  img.src = '';
  try {
    const qr = qrcode(0, 'L');
    qr.addData(uri);
    qr.make();
    const url = qr.createDataURL(4, 4);
    console.log('[totp] QR data URL length:', url.length);
    img.src = url;
  } catch (e) {
    console.error('[totp] QR generation failed:', e);
  }
}

async function confirmTOTPSetup() {
  const token = document.getElementById('totp-setup-verify-input').value.trim();
  const msgEl = document.getElementById('totp-setup-msg');
  try {
    if (!token || token.length !== 6 || !/^\d{6}$/.test(token)) {
      msgEl.className = 'admin-msg error';
      msgEl.textContent = 'Enter a valid 6-digit code.';
      msgEl.style.display = 'block';
      return;
    }
    const valid = await verifyTOTP(_pendingTOTPSecret, token);
    if (!valid) {
      msgEl.className = 'admin-msg error';
      msgEl.textContent = 'Invalid code. Make sure your authenticator app is set up correctly and try again.';
      msgEl.style.display = 'block';
      return;
    }
    await saveTOTPSecret(_pendingTOTPSecret);
    msgEl.className = 'admin-msg success';
    msgEl.textContent = 'Two-factor authentication is now enabled.';
    msgEl.style.display = 'block';
    _pendingTOTPSecret = null;
    updateTOTPButton();
    setTimeout(() => closeTOTPModal(), 1500);
  } catch (e) {
    console.error('[totp] confirmTOTPSetup error:', e);
    msgEl.className = 'admin-msg error';
    msgEl.textContent = 'Error: ' + (e.message || 'Unknown error');
    msgEl.style.display = 'block';
  }
}

function cancelTOTPSetup() {
  _pendingTOTPSecret = null;
}

async function deleteTOTPSecret() {
  await sb.from('admin_config').delete().eq('key', 'totp_secret');
  _totpSecret = null;
}

function removeTOTPStart() {
  document.getElementById('totp-remove-btn').style.display = 'none';
  document.getElementById('totp-remove-area').style.display = 'block';
  document.getElementById('totp-remove-input').value = '';
  document.getElementById('totp-remove-input').focus();
  document.getElementById('totp-remove-msg').className = 'admin-msg';
  document.getElementById('totp-remove-msg').style.display = 'none';
}

async function confirmTOTPRemove() {
  const token = document.getElementById('totp-remove-input').value.trim();
  const msgEl = document.getElementById('totp-remove-msg');
  try {
    if (!token || token.length !== 6 || !/^\d{6}$/.test(token)) {
      msgEl.className = 'admin-msg error';
      msgEl.textContent = 'Enter a valid 6-digit code.';
      msgEl.style.display = 'block';
      return;
    }
    const valid = await verifyTOTP(_totpSecret, token);
    if (!valid) {
      msgEl.className = 'admin-msg error';
      msgEl.textContent = 'Invalid code. Try again.';
      msgEl.style.display = 'block';
      return;
    }
    await deleteTOTPSecret();
    updateTOTPButton();
    closeTOTPModal();
  } catch (e) {
    console.error('[totp] confirmTOTPRemove error:', e);
    msgEl.className = 'admin-msg error';
    msgEl.textContent = 'Error: ' + (e.message || 'Unknown error');
    msgEl.style.display = 'block';
  }
}

function cancelTOTPRemove() {
  document.getElementById('totp-remove-area').style.display = 'none';
  document.getElementById('totp-remove-btn').style.display = '';
}

function showSettingsMsg(section, type, text) {
  const el = document.getElementById('settings-' + section + '-msg');
  el.className = 'admin-msg ' + type;
  el.textContent = text;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 5000);
}

function parseTitle(md) {
  const m = md.match(/^#\s+(.+)/m);
  return m ? m[1].trim() : '';
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function showMsg(type, text) {
  const el = document.getElementById('admin-msg');
  el.className = 'admin-msg ' + type;
  el.textContent = text;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

function closeModal(id) {
  document.getElementById(id).style.display = 'none';
}

(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (!session?.user) return;

  const { data: { user } } = await sb.auth.getUser();
  if (!user?.email) return;

  await loadAdminConfig();

  logAuthState('auto-login');

  if (!ADMIN_EMAIL || user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) return;

  await loadTOTPSecret();
  if (_totpSecret) {
    // Re-prompt for TOTP on every fresh page load
    _pendingLoginUser = user;
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('admin-login-btn').style.display = 'none';
    document.getElementById('login-otp-row').style.display = 'none';
    document.getElementById('totp-verify-modal').style.display = 'flex';
    document.getElementById('totp-verify-input').value = '';
    document.getElementById('totp-verify-input').focus();
    document.getElementById('totp-verify-error').style.display = 'none';
    document.getElementById('totp-verify-error').className = 'admin-error';
    document.getElementById('totp-verify-btn').disabled = false;
    document.getElementById('totp-verify-btn').textContent = 'Verify';
    return;
  }

  enterDashboard(user);
})();

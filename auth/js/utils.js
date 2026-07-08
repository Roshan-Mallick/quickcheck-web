// ─── Utilities ────────────────────────────────────────────────────────────

const show = id => document.getElementById(id).style.display = '';
const hide = id => document.getElementById(id).style.display = 'none';

/**
 * Generate a random UUID for checklist/section/item IDs.
 */
function uid() {
  return crypto.randomUUID();
}

/**
 * HTML-escape a string for safe innerHTML injection.
 */
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/`/g, '&#x60;');
}

// ─── Toast ────────────────────────────────────────────────────────────────

/**
 * Show a brief notification toast.
 * @param {string} msg
 * @param {'default'|'success'|'error'} type
 */
function showToast(msg, type = 'default') {
  const container = document.getElementById('toast-container');
  const toast     = document.createElement('div');
  toast.className   = 'toast ' + type;
  toast.textContent = msg;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity    = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ─── Auth-screen messages ─────────────────────────────────────────────────

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent   = msg;
  el.style.display = 'block';
  document.getElementById('auth-msg').style.display = 'none';
}

function showAuthMsg(msg) {
  const el = document.getElementById('auth-msg');
  el.textContent   = msg;
  el.style.display = 'block';
  document.getElementById('auth-error').style.display = 'none';
}

function clearAuthMessages() {
  document.getElementById('auth-error').style.display = 'none';
  document.getElementById('auth-msg').style.display   = 'none';
}

// ─── Account-modal messages ───────────────────────────────────────────────

function showAccountMsg(msg, type = 'success') {
  const el      = document.getElementById('account-msg');
  el.textContent = msg;
  el.className   = 'account-msg ' + type;
}

function clearAccountMsg() {
  const el      = document.getElementById('account-msg');
  el.textContent = '';
  el.className   = 'account-msg';
}

// ─── Code‑based plan upgrade ─────────────────────────────────────────────
// TEMPORARY: Will be replaced by Stripe/payment integration.
// TODO: Remove this file and all references when Stripe is implemented.
// Codes are validated server-side via the access_codes table.

// The plan being upgraded to (set before opening modal)
let _targetPlan = null;

// TEMPORARY: Opens the access-code modal for the given plan.
// TODO: Replace with Stripe checkout redirect.
function showUpgradeModal(plan) {
  if (!plan || !['pro', 'team'].includes(plan)) return;
  _targetPlan = plan;

  const labels = { pro: 'Pro', team: 'Team' };
  document.getElementById('upgrade-modal-title').textContent =
    'Enter ' + labels[plan] + ' Access Code';
  document.getElementById('upgrade-plan-name').textContent = labels[plan];
  document.getElementById('upgrade-input').value  = '';
  const msg = document.getElementById('upgrade-msg');
  msg.textContent = '';
  msg.className   = 'account-msg';
  document.getElementById('upgrade-modal').classList.add('open');
  setTimeout(() => document.getElementById('upgrade-input').focus(), 100);
}

// TEMPORARY: Handles the access-code form submission.
// TODO: Replace with Stripe webhook handler.
async function handleUpgradeSubmit(e) {
  e.preventDefault();
  if (!sb || !currentUser || !_targetPlan) return;

  const code = document.getElementById('upgrade-input').value.trim();
  const btn  = document.getElementById('upgrade-btn');
  const msg  = document.getElementById('upgrade-msg');

  if (!code) {
    msg.textContent = 'Please enter an access code.';
    msg.className   = 'account-msg error';
    return;
  }

  // Validate and redeem in one atomic server-side call
  try {
    const { data, error } = await sb.rpc('redeem_access_code', { p_code: code, p_plan: _targetPlan });
    if (error) throw error;
    if (data !== true) {
      msg.textContent = 'Invalid access code. Please try again.';
      msg.className   = 'account-msg error';
      return;
    }
  } catch (err) {
    console.error('Access code error:', err);
    msg.textContent = err.message === 'Invalid or already used code' ? 'Invalid access code.' : 'Upgrade unavailable. Try again later.';
    msg.className   = 'account-msg error';
    return;
  }

  btn.disabled     = true;
  btn.textContent  = 'Upgrading…';
  msg.textContent  = '';
  msg.className    = 'account-msg';

  try {
    // Optimistically update local state immediately so UI reflects the change
    const limits = { pro: { plan: 'pro', workspace_limit: 5 }, team: { plan: 'team', workspace_limit: Infinity } };
    window.userSubscription = { ...(window.userSubscription || {}), ...(limits[_targetPlan] || {}) };

    // Also refresh from server (non-blocking: UI already shows the upgrade)
    getUserSubscription().then(sub => {
      window.userSubscription = sub;
      updateAccountPlanDisplay();
    });

    // Update all plan-dependent UI
    updateAccountPlanDisplay();
    renderWorkspaceSwitcher();
    if (typeof renderManageMembersModal === 'function' && activeWorkspace) {
      const ws = workspaces.find(w => w.id === activeWorkspace.id);
      if (ws) renderManageMembersModal(ws);
    }

    showToast('Upgraded to ' + (_targetPlan === 'pro' ? 'Pro' : 'Team') + '!');
    closeModal('upgrade-modal');
  } catch (err) {
    console.error('Upgrade error:', err);
    msg.textContent = err.message || 'Upgrade failed.';
    msg.className   = 'account-msg error';
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Upgrade';
  }
}

// TEMPORARY: Reads ?upgrade= from URL and shows the upgrade modal.
// Called from state.js:init() after login.
// TODO: Remove when Stripe replaces this flow.
function handlePendingUpgrade() {
  const params = new URLSearchParams(window.location.search);
  const plan = params.get('upgrade');
  if (plan && ['pro', 'team'].includes(plan)) {
    // Clean the URL
    const url = new URL(window.location);
    url.searchParams.delete('upgrade');
    window.history.replaceState({}, document.title, url);
    // Show modal after a short delay so the app UI is ready
    setTimeout(() => showUpgradeModal(plan), 300);
  }
}

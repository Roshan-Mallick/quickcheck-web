// ─── Plan upgrade modal ──────────────────────────────────────────────

let _targetPlan = null

function showUpgradeModal(plan) {
  if (!plan || !['pro', 'team'].includes(plan)) return
  _targetPlan = plan
  document.getElementById('upgrade-modal-title').textContent = 'Upgrade to ' + (plan === 'pro' ? 'PRO' : 'TEAM')
  document.getElementById('upgrade-input').value = ''
  document.getElementById('upgrade-msg').textContent = ''
  document.getElementById('upgrade-msg').className = 'account-msg'
  document.getElementById('upgrade-modal').classList.add('open')
  setTimeout(() => document.getElementById('upgrade-input').focus(), 100)
}

async function handleUpgradeSubmit(e) {
  e.preventDefault()
  if (!sb || !currentUser || !_targetPlan) return

  const input = document.getElementById('upgrade-input').value.trim().toUpperCase()
  const btn   = document.getElementById('upgrade-btn')
  const msg   = document.getElementById('upgrade-msg')

  if (!input) {
    msg.textContent = 'Type PRO or TEAM to upgrade.'
    msg.className = 'account-msg error'
    return
  }

  const plan = input === 'PRO' ? 'pro' : input === 'TEAM' ? 'team' : null
  if (!plan) {
    msg.textContent = 'Invalid plan. Type PRO or TEAM.'
    msg.className = 'account-msg error'
    return
  }

  if (plan !== _targetPlan) {
    msg.textContent = 'This button is for ' + (_targetPlan === 'pro' ? 'PRO' : 'TEAM') + '. Click the correct button.'
    msg.className = 'account-msg error'
    return
  }

  btn.disabled = true
  btn.textContent = 'Upgrading…'
  msg.textContent = ''
  msg.className = 'account-msg'

  try {
    const limits = { pro: { plan: 'pro', workspace_limit: 5 }, team: { plan: 'team', workspace_limit: Infinity } }
    window.userSubscription = { ...(window.userSubscription || {}), ...(limits[plan] || {}) }
    updateAccountPlanDisplay()
    renderWorkspaceSwitcher()
    if (typeof renderManageMembersModal === 'function' && activeWorkspace) {
      const ws = workspaces.find(w => w.id === activeWorkspace.id)
      if (ws) renderManageMembersModal(ws)
    }
    showToast('Upgraded to ' + (plan === 'pro' ? 'PRO' : 'TEAM') + '!')
    closeModal('upgrade-modal')
  } catch (err) {
    console.error('Upgrade error:', err)
    msg.textContent = err.message || 'Upgrade failed.'
    msg.className = 'account-msg error'
  } finally {
    btn.disabled = false
    btn.textContent = 'Upgrade'
  }
}

function handlePendingUpgrade() {
  const params = new URLSearchParams(window.location.search)
  const plan = params.get('upgrade')
  if (plan && ['pro', 'team'].includes(plan)) {
    const url = new URL(window.location)
    url.searchParams.delete('upgrade')
    window.history.replaceState({}, document.title, url)
    setTimeout(() => showUpgradeModal(plan), 300)
  }
}

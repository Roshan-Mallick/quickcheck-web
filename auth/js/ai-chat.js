let chatHistory = []
let chatLoading = false
let typingTimer = null
let userScrolledUp = false
let pendingImportContent = null
const CHAT_HISTORY_MAX = 20
const REQUEST_TIMEOUT_MS = 120000

function openAIChat() {
  const overlay = document.getElementById('quickcheck-ai-overlay')
  overlay.classList.add('open', 'maximized')
  document.getElementById('quickcheck-ai-input').focus()
  document.body.style.overflow = 'hidden'
  if (window.innerWidth <= 900) {
    closeSidebar()
  }
}

function closeAIChat() {
  stopTyping()
  document.getElementById('quickcheck-ai-overlay').classList.remove('open', 'minimized', 'maximized')
  document.body.style.overflow = ''
}

function minimizeAIChat() {
  const overlay = document.getElementById('quickcheck-ai-overlay')
  overlay.classList.remove('maximized')
  overlay.classList.add('minimized')
}

function maximizeAIChat() {
  const overlay = document.getElementById('quickcheck-ai-overlay')
  overlay.classList.remove('minimized')
  overlay.classList.toggle('maximized')
}

function stopTyping() {
  if (typingTimer) { clearTimeout(typingTimer); typingTimer = null }
  const el = document.getElementById('ai-typing-msg')
  if (el) el.id = ''
  hideScrollToBottomBtn()
}

function onChatScroll() {
  const scroller = document.getElementById('quickcheck-ai-messages')
  if (!scroller) return
  const atBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 30
  if (atBottom) {
    if (userScrolledUp) {
      userScrolledUp = false
      hideScrollToBottomBtn()
    }
  } else {
    if (!userScrolledUp) {
      userScrolledUp = true
      if (chatLoading || typingTimer) showScrollToBottomBtn()
    }
  }
}

function scrollChatToBottom(el) {
  el.scrollTop = el.scrollHeight
}

function jumpToBottom() {
  const scroller = document.getElementById('quickcheck-ai-messages')
  if (scroller) scroller.scrollTop = scroller.scrollHeight
}

function showScrollToBottomBtn() {
  let btn = document.getElementById('ai-scroll-bottom-btn')
  if (!btn) {
    btn = document.createElement('button')
    btn.id = 'ai-scroll-bottom-btn'
    btn.className = 'ai-scroll-bottom-btn'
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>'
    btn.onclick = jumpToBottom
    const msgs = document.getElementById('quickcheck-ai-messages')
    if (msgs) msgs.parentNode.appendChild(btn)
  }
  btn.classList.add('visible')
}

function hideScrollToBottomBtn() {
  const btn = document.getElementById('ai-scroll-bottom-btn')
  if (btn) btn.classList.remove('visible')
}

function appendMessage(role, content) {
  const inner = document.getElementById('quickcheck-ai-messages-inner')
  const scroller = document.getElementById('quickcheck-ai-messages')
  const div = document.createElement('div')
  div.className = 'quickcheck-ai-msg quickcheck-ai-msg-' + role
  div.textContent = content
  inner.appendChild(div)
  if (!userScrolledUp) scrollChatToBottom(scroller)
}

function appendAssistantMessage(text, done) {
  hideChatLoading()
  const inner = document.getElementById('quickcheck-ai-messages-inner')
  const scroller = document.getElementById('quickcheck-ai-messages')
  const div = document.createElement('div')
  div.className = 'quickcheck-ai-msg quickcheck-ai-msg-assistant'
  div.id = 'ai-typing-msg'
  inner.appendChild(div)

  chatLoading = true
  setInputDisabled(true)

  let i = 0
  div.textContent = ''
  function step() {
    if (i < text.length) {
      div.textContent += text[i]
      i++
      if (!userScrolledUp) scrollChatToBottom(scroller)
      typingTimer = setTimeout(step, 12)
    } else {
      typingTimer = null
      div.id = ''
      chatLoading = false
      setInputDisabled(false)
      chatHistory.push({ role: 'assistant', content: text })
      if (done) {
        const panel = buildChatActions(text)
        div.insertAdjacentElement('afterend', panel)
        setTimeout(() => { if (!userScrolledUp) scrollChatToBottom(scroller) }, 10)
      }
    }
  }
  step()
}

function setInputDisabled(disabled) {
  const input = document.getElementById('quickcheck-ai-input')
  const sendBtn = document.querySelector('.quickcheck-ai-send-btn')
  if (input) input.disabled = disabled
  if (sendBtn) sendBtn.disabled = disabled
}

function showChatLoading() {
  const inner = document.getElementById('quickcheck-ai-messages-inner')
  const scroller = document.getElementById('quickcheck-ai-messages')
  const div = document.createElement('div')
  div.className = 'quickcheck-ai-msg quickcheck-ai-msg-assistant quickcheck-ai-loading'
  div.id = 'quickcheck-ai-loading-indicator'
  div.innerHTML = '<span class="ai-dot-pulse"><span></span><span></span><span></span></span>'
  inner.appendChild(div)
  if (!userScrolledUp) scrollChatToBottom(scroller)
}

function hideChatLoading() {
  const el = document.getElementById('quickcheck-ai-loading-indicator')
  if (el) el.remove()
}

function hideChatActions() {
  document.querySelectorAll('.quickcheck-ai-actions').forEach(el => el.remove())
}

function buildChatActions(content) {
  const normalized = normalizeMd(content)
  let heading = 'Checklist ready!'
  const match = normalized.match(/^#\s+(.+)/m)
  if (match) heading = match[1].trim()
  const phaseRe = /^(?:Phase|Chapter|Part|Step|Section)\s+\d+/i
  if (phaseRe.test(heading)) {
    const phases = [...normalized.matchAll(/^#\s+(?:Phase|Chapter|Part|Step|Section)\s+\d+[.:)\s-]+(.+)/gim)]
    if (phases.length > 1) {
      const topics = phases.map(m => m[1].trim())
      const dev = topics.filter(t => /develop|engineer|program|design/i.test(t))
      heading = (dev.length ? dev[dev.length - 1] : topics[topics.length - 1]) + ' Checklist'
    }
  }

  const dlSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'
  const importSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l9 5-9 5-9-5 9-5z"/><path d="M21 12l-9 5-9-5"/><path d="M21 17l-9 5-9-5"/></svg>'
  const wsSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>'

  const panel = document.createElement('div')
  panel.className = 'quickcheck-ai-actions'

  const titleDiv = document.createElement('div')
  titleDiv.className = 'quickcheck-ai-actions-title'
  titleDiv.textContent = heading
  panel.appendChild(titleDiv)

  const btnDiv = document.createElement('div')
  btnDiv.className = 'quickcheck-ai-actions-buttons'
  panel.appendChild(btnDiv)

  const dlBtn = document.createElement('button')
  dlBtn.className = 'quickcheck-ai-action-btn'
  dlBtn.innerHTML = dlSvg + ' Download .md'
  dlBtn.onclick = () => downloadAIChecklist(content)
  btnDiv.appendChild(dlBtn)

  const importBtn = document.createElement('button')
  importBtn.className = 'quickcheck-ai-action-btn'
  const importLabel = activeWorkspace ? activeWorkspace.name + ' Space' : 'Personal Space'
  importBtn.innerHTML = importSvg + ' Import to ' + importLabel
  importBtn.onclick = () => importAIChecklist(content)
  btnDiv.appendChild(importBtn)

  const wsBtn = document.createElement('button')
  wsBtn.className = 'quickcheck-ai-action-btn'
  wsBtn.innerHTML = wsSvg + ' Import to Workspace...'
  wsBtn.onclick = () => {
    pendingImportContent = content
    const picker = getOrCreateWorkspacePicker()
    picker.classList.add('open')
    populateWorkspacePicker()
  }
  btnDiv.appendChild(wsBtn)

  return panel
}

function getOrCreateWorkspacePicker() {
  let picker = document.getElementById('quickcheck-ai-ws-picker')
  if (picker) return picker
  picker = document.createElement('div')
  picker.className = 'quickcheck-ai-ws-picker'
  picker.id = 'quickcheck-ai-ws-picker'
  picker.addEventListener('click', function (e) { if (e.target === this) closeWorkspacePicker() })
  picker.innerHTML =
    '<div class="quickcheck-ai-ws-modal">' +
      '<div class="quickcheck-ai-ws-modal-header">' +
        '<span>Select workspace</span>' +
        '<button class="quickcheck-ai-ws-modal-close" onclick="closeWorkspacePicker()">&times;</button>' +
      '</div>' +
      '<div class="quickcheck-ai-ws-list" id="quickcheck-ai-ws-list"></div>' +
    '</div>'
  document.body.appendChild(picker)
  return picker
}

function toggleWorkspacePicker() {
  const picker = getOrCreateWorkspacePicker()
  const shown = picker.classList.contains('open')
  picker.classList.toggle('open')
  if (!shown) populateWorkspacePicker()
}

function closeWorkspacePicker() {
  const picker = document.getElementById('quickcheck-ai-ws-picker')
  if (picker) picker.classList.remove('open')
}

function populateWorkspacePicker() {
  const list = document.getElementById('quickcheck-ai-ws-list')
  if (!list) return
  list.innerHTML = ''

  if (!workspaces || workspaces.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'quickcheck-ai-ws-item quickcheck-ai-ws-empty'
    empty.textContent = 'No workspaces yet'
    list.appendChild(empty)
  } else {
    for (const ws of workspaces) {
      const item = document.createElement('div')
      item.className = 'quickcheck-ai-ws-item'
      item.textContent = ws.name || 'Unnamed'
      item.onclick = () => importToWorkspace(ws.id, ws.name || 'Unnamed')
      list.appendChild(item)
    }
  }

  const create = document.createElement('div')
  create.className = 'quickcheck-ai-ws-item quickcheck-ai-ws-create'
  create.innerHTML = '+ Create New Workspace'
  create.onclick = showCreateWsInput
  list.appendChild(create)
}

function showCreateWsInput() {
  const list = document.getElementById('quickcheck-ai-ws-list')
  if (!list) return
  list.innerHTML = `
    <div class="quickcheck-ai-ws-create-form">
      <input type="text" id="quickcheck-ai-new-ws-name" class="quickcheck-ai-ws-name-input" placeholder="Workspace name..." autocomplete="off">
      <button class="quickcheck-ai-ws-create-btn" onclick="submitNewWs()">Create & Import</button>
      <button class="quickcheck-ai-ws-cancel-btn" onclick="populateWorkspacePicker()">Back</button>
    </div>
  `
  setTimeout(() => document.getElementById('quickcheck-ai-new-ws-name')?.focus(), 50)
}

async function submitNewWs() {
  const input = document.getElementById('quickcheck-ai-new-ws-name')
  if (!input) return
  const name = input.value.trim()
  if (!name) { showToast('Enter a workspace name.', 'error'); return }

  const btn = document.querySelector('.quickcheck-ai-ws-create-btn')
  if (btn) { btn.disabled = true; btn.textContent = 'Creating…' }

  try {
    if (!sb || !currentUser) { showToast('Not authenticated.', 'error'); return }

    const sub = typeof getSubscription === 'function' ? getSubscription() : { plan: 'free', workspace_limit: 1 }
    const ownerCount = workspaces.filter(w => w.role === 'owner').length
    if (ownerCount >= sub.workspace_limit) {
      showToast('Workspace limit reached. Upgrade your plan.', 'error')
      return
    }

    const { data: wsId, error } = await sb.rpc('create_workspace', { ws_name: name, ws_description: '' })
    if (error) { showToast(error.message, 'error'); return }

    await loadWorkspaces()
    await switchWorkspace(wsId)
    showToast('Workspace created.')
    importToWorkspace(wsId, name)
  } catch (err) {
    showToast(err.message || 'Failed to create workspace.', 'error')
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Create & Import' }
  }
}

function normalizeMd(text) {
  const lines = text.split('\n')
  const out = []
  for (const raw of lines) {
    let line = raw.trimEnd()
    if (/^\s*[☐□]\s+/i.test(line)) {
      line = line.replace(/^\s*[☐□]\s+/i, '- [ ] ')
    }
    if (/^\s*[☑■✓✔]\s+/i.test(line)) {
      line = line.replace(/^\s*[☑■✓✔]\s+/i, '- [x] ')
    }
    out.push(line)
  }

  // Strip common AI conversational prefixes from the first non-empty line
  const convoRe = /^(?:sure[!,.]?\s+|here(?:'s| is| are)\s+(?:a |an |the |your )?|of course[!,.]?\s+|absolutely[!,.]?\s+|certainly[!,.]?\s+|definitely[!,.]?\s+|let me\s+|i'?ll\s+|below is\s+|below are\s+|check out\s+|here you go[!,.]?\s+|this is\s+)?(?:a |an |the |your )?(?:comprehensive |complete |detailed |simple |quick |full |basic )?(?:checklist|learning guide|roadmap|plan|guide|tutorial|overview|cheat sheet|notes)[!.:;\s]*/i
  for (let i = 0; i < out.length; i++) {
    const trimmed = out[i].trim()
    if (!trimmed) continue
    if (/^#/.test(trimmed) || /^[-*+]\s+\[/.test(trimmed)) break
    if (convoRe.test(trimmed)) { out[i] = ''; continue }
    break
  }

  for (let i = 0; i < out.length; i++) {
    const trimmed = out[i].trim()
    if (!trimmed || /^#/.test(out[i]) || /^[-*+]\s+\[/.test(out[i])) continue
    for (let j = i + 1; j < out.length; j++) {
      const next = out[j].trim()
      if (!next) continue
      if (/^[-*+]\s+(?:\[[ xX]\]|[☐□])/.test(next)) {
        out[i] = '## ' + trimmed
      }
      break
    }
  }

  const first = out.find(l => l.trim())
  if (first && !/^#/.test(first) && !/^[-*+]/.test(first)) {
    const idx = out.indexOf(first)
    out[idx] = '# ' + first.trim()
  }
  return out.join('\n')
}

function getChecklistMd() {
  const msgs = document.querySelectorAll('.quickcheck-ai-msg-assistant')
  for (const m of msgs) {
    const normalized = normalizeMd(m.textContent)
    if (/^##\s+.+/m.test(normalized) && /^- \[[ x]\]\s+.+/m.test(normalized)) {
      return normalized
    }
  }
  showToast('No complete checklist found in conversation.', 'error')
  return null
}

function buildChecklistFromMd(md) {
  const normalized = normalizeMd(md)
  const sections = parseMd(normalized)
  if (!sections || !sections.length) {
    showToast('Could not parse checklist from the response.', 'error')
    return null
  }
  const titleMatch = normalized.match(/^#\s+(.+)/m)
  let title = titleMatch ? titleMatch[1].trim() : ''
  const phaseRe = /^(?:Phase|Chapter|Part|Step|Section)\s+\d+/i
  if (phaseRe.test(title)) {
    const phases = [...normalized.matchAll(/^#\s+(?:Phase|Chapter|Part|Step|Section)\s+\d+[.:)\s-]+(.+)/gim)]
    if (phases.length > 1) {
      const topics = phases.map(m => m[1].trim())
      const dev = topics.filter(t => /develop|engineer|program|design/i.test(t))
      title = (dev.length ? dev[dev.length - 1] : topics[topics.length - 1]) + ' Checklist'
    }
  }
  if (!title || /^[-*+]/.test(title)) {
    const s0 = sections[0]?.title || ''
    title = s0 ? s0 + ' Checklist' : 'AI Generated Checklist'
  }
  return { id: uid(), title, data: sections }
}

function importAIChecklist(content) {
  const cl = buildChecklistFromMd(content)
  if (!cl) return

  checklists.unshift(cl)
  persistChecklist(cl)
  renderSidebar()
  closeAIChat()
  loadChecklist(cl.id)
  showToast('Quick-AI imported ✓', 'success')
  resetChat()
}

async function importToWorkspace(wsId, wsName) {
  const content = pendingImportContent
  pendingImportContent = null
  if (!content) {
    showToast('No content to import.', 'error')
    return
  }

  const cl = buildChecklistFromMd(content)
  if (!cl) return

  if (!sb || !currentUser) {
    showToast('Not authenticated.', 'error')
    return
  }

  const { error } = await sb.from('workspace_checklist_items').upsert({
    id: cl.id,
    workspace_id: wsId,
    title: cl.title,
    data: cl.data,
    updated_at: new Date().toISOString(),
  })
  if (error) { showToast('Save failed: ' + error.message, 'error'); return }

  if (activeWorkspace?.id === wsId) {
    sharedChecklists.unshift(Object.assign({}, cl, { _workspace: true, _workspaceId: wsId }))
    renderSidebar()
    loadChecklist(cl.id)
  }

  closeWorkspacePicker()
  hideChatActions()
  showToast('Imported to ' + wsName + ' ✓', 'success')
  closeAIChat()
  resetChat()
}

function downloadAIChecklist(content) {
  const md = normalizeMd(content)
  const titleMatch = md.match(/^#\s+(.+)/m)
  let title = titleMatch ? titleMatch[1].trim() : ''
  const phaseRe = /^(?:Phase|Chapter|Part|Step|Section)\s+\d+/i
  if (phaseRe.test(title)) {
    const phases = [...md.matchAll(/^#\s+(?:Phase|Chapter|Part|Step|Section)\s+\d+[.:)\s-]+(.+)/gim)]
    if (phases.length > 1) {
      const topics = phases.map(m => m[1].trim())
      const dev = topics.filter(t => /develop|engineer|program|design/i.test(t))
      title = (dev.length ? dev[dev.length - 1] : topics[topics.length - 1]) + ' Checklist'
    }
  }
  if (!title || /^[-*+]/.test(title)) title = 'checklist'

  const blob = new Blob([md], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = title.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.md'
  a.click()
  URL.revokeObjectURL(url)
  showToast('Downloaded ✓')
}

async function sendChatMessage() {
  const input = document.getElementById('quickcheck-ai-input')
  const msg = input.value.trim()
  if (!msg || chatLoading) return

  input.value = ''
  appendMessage('user', msg)
  chatHistory.push({ role: 'user', content: msg })

  if (chatHistory.length > CHAT_HISTORY_MAX) {
    chatHistory = chatHistory.slice(-CHAT_HISTORY_MAX)
  }

  showChatLoading()
  chatLoading = true

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const res = await fetch(AI_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + SUPABASE_ANON,
      },
      body: JSON.stringify({ message: msg, history: chatHistory.slice(0, -1) }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Request failed')
    }

    const ct = res.headers.get('content-type') || ''

    if (ct.includes('text/plain')) {
      // Streaming response — read tokens as they arrive
      hideChatLoading()
      const inner = document.getElementById('quickcheck-ai-messages-inner')
      const scroller = document.getElementById('quickcheck-ai-messages')
      const div = document.createElement('div')
      div.className = 'quickcheck-ai-msg quickcheck-ai-msg-assistant'
      div.id = 'ai-typing-msg'
      inner.appendChild(div)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        fullText += decoder.decode(value, { stream: true })
        div.textContent = fullText
        if (!userScrolledUp) scrollChatToBottom(scroller)
      }

      typingTimer = null
      div.id = ''
      chatLoading = false
      setInputDisabled(false)
      chatHistory.push({ role: 'assistant', content: fullText })
      const panel = buildChatActions(fullText)
      div.insertAdjacentElement('afterend', panel)
      setTimeout(() => { if (!userScrolledUp) scrollChatToBottom(scroller) }, 10)
    } else {
      // JSON fallback — edge function not yet deployed with streaming
      const data = await res.json()
      appendAssistantMessage(data.reply, true)
    }

  } catch (e) {
    hideChatLoading()
    chatLoading = false
    chatHistory.pop()
    if (e.name === 'AbortError') {
      appendMessage('assistant', 'Request timed out — the AI took too long. Try a shorter prompt.')
      showToast('Request timed out.', 'error')
    } else {
      const detail = e.message || 'Please try again.'
      appendMessage('assistant', 'Sorry, something went wrong. ' + detail)
      showToast('Failed to get response from AI.', 'error')
    }
  } finally {
    clearTimeout(timer)
  }
}

function resetChat() {
  chatHistory = []
  chatLoading = false
  userScrolledUp = false
  pendingImportContent = null
  hideScrollToBottomBtn()
  closeWorkspacePicker()
  setInputDisabled(false)
  stopTyping()
  document.getElementById('quickcheck-ai-messages-inner').innerHTML =
    '<div class="quickcheck-ai-msg quickcheck-ai-msg-assistant">Welcome! This is a free student-oriented tool \u2014 create checklist .md files and get info about this website. Checklists are downloadable as .md but won\'t be saved after page reload, so download them to keep your work. Made with free resources only.</div>'
  hideChatActions()
  document.getElementById('quickcheck-ai-input').value = ''
}

document.getElementById('quickcheck-ai-input').addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendChatMessage()
  }
})

document.getElementById('quickcheck-ai-send-btn').addEventListener('click', function () {
  sendChatMessage()
})

document.getElementById('quickcheck-ai-messages').addEventListener('scroll', onChatScroll, { passive: true })

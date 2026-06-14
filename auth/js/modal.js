// ─── Modal helpers ────────────────────────────────────────────────────────

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
}

let confirmAction = null;

function showConfirmModal({
  label = 'Confirmation',
  title = 'Are you sure?',
  message = '',
  onConfirm = null
}) {
  document.getElementById('confirm-label').textContent = label;
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-message').textContent = message;

  confirmAction = onConfirm;

  document.getElementById('confirm-action-btn').onclick = () => {
    closeModal('confirm-modal');

    if (typeof confirmAction === 'function') {
      confirmAction();
    }
  };

  document.getElementById('confirm-modal').classList.add('open');
}

// Click outside the modal box to close
document.addEventListener('click', function (e) {
  if (e.target?.classList?.contains('modal-overlay')) {
    e.target.classList.remove('open');
    document.body.style.overflow = '';
  }
});

// ─── New checklist modal ──────────────────────────────────────────────────

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

function chooseGenerateChecklist() {
  closeModal('new-checklist-modal');
  document.getElementById('ai-context-input').value = '';
  document.getElementById('ai-generate-modal').classList.add('open');
}

function openChecklistInChatGPT() {
  const context = document.getElementById('ai-context-input').value.trim();
  const prompt = `You are a Checklist Generator. Generate a detailed checklist in Markdown format for the following context. Do NOT ask for more information — use the context provided.

Requirements:

* Use markdown headings (## for sections)
* Use checkbox items (- [ ])
* Organize into logical sections
* Include validation steps
* Include edge cases
* Include testing steps
* Output valid markdown only

Context:

${context || 'Create a general project readiness checklist.'}`;

  navigator.clipboard.writeText(prompt).catch(() => {});
  window.open('https://chat.openai.com', '_blank');
  closeModal('ai-generate-modal');
  document.getElementById('ai-guidance-modal').classList.add('open');
  showToast('Prompt copied. Paste it into ChatGPT and press Enter.', 'success');
}

// ─── Upload / import modal ────────────────────────────────────────────────

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

// ─── Drag-and-drop handlers ───────────────────────────────────────────────

function handleDragOver(e)  {
  e.preventDefault();
  document.getElementById('upload-zone').classList.add('drag');
}

function handleDragLeave() {
  document.getElementById('upload-zone').classList.remove('drag');
}

function handleDrop(e) {
  e.preventDefault();
  handleDragLeave();
  const f = e.dataTransfer.files[0];
  if (f) readMdFile(f);
}

function handleFileSelect(inp) {
  if (inp.files[0]) readMdFile(inp.files[0]);
}

// ─── Markdown file reader ─────────────────────────────────────────────────

function readMdFile(file) {
  if (!file.name.match(/\.(md|markdown)$/i) && file.type !== 'text/markdown') {
    showToast('Please upload a .md file.', 'error');
    return;
  }

  const MAX_SIZE = 1 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    showToast('File too large. Maximum size is 1 MB.', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const text     = e.target.result;
    const sections = parseMd(text);

    if (!sections.length) {
      showToast('No checklist items found in this file.', 'error');
      return;
    }

    const title = (text.match(/^#\s+(.+)/m) || [])[1]?.trim()
                || file.name.replace(/\.(md|markdown)$/i, '');

    parsedData = { title, sections };

    const prev = document.getElementById('parse-preview');
    prev.style.display = 'block';
    prev.innerHTML =
      `<strong style="color:var(--accent)">${esc(title)}</strong><br><br>` +
      sections.map(s =>
        `<span style="color:var(--text3)">## ${esc(s.title)}</span><br>` +
        s.items.map(i => `&nbsp;&nbsp;- [ ] ${esc(i.label)}`).join('<br>')
      ).join('<br><br>');

    document.getElementById('import-btn').style.display = 'flex';
    document.getElementById('upload-zone').querySelector('.upload-zone-text').textContent = file.name;
  };
  reader.readAsText(file);
}

// ─── Sidebar toggle ───────────────────────────────────────────────────────

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-backdrop').classList.toggle('open');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-backdrop').classList.remove('open');
}

// ─── Empty state ──────────────────────────────────────────────────────────

function showEmptyState() {
  document.getElementById('empty-state').style.display    = 'flex';
  document.getElementById('checklist-view').style.display = 'none';
}
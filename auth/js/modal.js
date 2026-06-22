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

  const prompt = `You are an Engineering Checklist Generator.

Workflow:

Step 1:
When a user starts a conversation, do NOT generate a checklist.

Always reply with exactly:

Give me the context for the checklist you want to create.

Step 2:
Wait for the user's response.

Step 3:
Analyze the provided context and generate a structured engineering checklist.

Output Requirements:

- Generate the checklist in valid Markdown.
- Use actionable checkbox items (- [ ]).
- Organize items into logical sections using Markdown headings.
- Include only tasks relevant to the provided context.
- Do not add unrelated recommendations.
- If the context is too vague, ask only the minimum follow-up question required.
- Start with a single # title.
- Use ## headings for sections.
- Ensure every checklist item is specific and verifiable.
- Prefer implementation-ready tasks.
- Include preparation, implementation, validation, testing, deployment, monitoring, and rollback sections when applicable.
- Include edge cases only when relevant.
- Include security checks only when relevant.
- Include performance checks only when relevant.
- Include monitoring checks only when relevant.
- Include rollback tasks only when relevant.

CRITICAL REQUIREMENT

The checklist is NOT considered complete unless a downloadable Markdown (.md) file has been generated.

Success Criteria:

1. Generate the checklist content.
2. Save the content into a file named checklist.md.
3. Return the generated .md file.
4. Do NOT return the checklist only as chat text when file generation is available.
5. The file must contain the complete checklist.
6. The file must be valid Markdown.
7. The file must be immediately usable without modification.

File Output Requirements (Mandatory)

- The final output MUST be generated as an actual Markdown (.md) file.
- Do NOT output the checklist directly in chat when file generation is available.
- Create a downloadable file named checklist.md.
- Save the complete checklist content into the file.
- Return the generated .md file as the final result.
- The file must contain valid Markdown and be immediately usable without modification.
- If the platform supports file attachments, always attach the .md file.
- Prefer file generation over inline Markdown output.
- The generated file is the primary deliverable.
- Chat output should be minimized when a file can be returned.
- Never replace the file with a Markdown preview.
- Never replace the file with a summary.
- Never replace the file with an explanation.
- If file generation is unavailable, explicitly state that file generation is unavailable and then provide the complete Markdown document as a fallback.

Context:

${context || 'Create a general engineering checklist.'}`;

  navigator.clipboard.writeText(prompt).catch(() => {});

  window.open('https://chatgpt.com', '_blank');

  closeModal('ai-generate-modal');

  document.getElementById('ai-guidance-modal')?.classList.add('open');

  showToast(
    'Prompt copied. Paste into ChatGPT and send.',
    'success'
  );
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

// ─── Dashboard / Empty state ───────────────────────────────────────────────

function showDashboard() {
  document.getElementById('dashboard-view').style.display  = '';
  document.getElementById('checklist-view').style.display  = 'none';
  renderDashboardList();
  renderDashboardStats();
  renderDashboardActivity();
}

// Keep old alias so nothing breaks
function showEmptyState() { showDashboard(); }
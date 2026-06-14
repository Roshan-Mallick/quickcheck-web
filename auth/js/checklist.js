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
  if (activeWorkspace) {
    await persistChecklist(cl);
    await shareChecklist(activeWorkspace.id, cl.id);
  } else {
    await persistChecklist(cl);
  }
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
    const shareBtn = activeWorkspace
      ? `<button class="list-item-share-btn" onclick="event.stopPropagation(); unshareChecklist('${activeWorkspace.id}', '${cl.id}')" title="Remove from workspace"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`
      : `<button class="list-item-share-btn" onclick="event.stopPropagation(); showShareModal('${cl.id}')" title="Share to workspace"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"/></svg></button>`;
    item.innerHTML = `
      <span class="list-item-icon">${activeWorkspace ? '🏢' : '☑'}</span>
      <span class="list-item-name">${esc(cl.title)}</span>
      <span class="list-item-count">${checked}/${total}</span>
      ${shareBtn}
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

function loadChecklist(id) {
  activeId = id;
  const source = activeWorkspace ? sharedChecklists : checklists;
  const cl = source.find(c => c.id === id) || checklists.find(c => c.id === id);
  if (!cl) { if (DEV) console.log('[checklist] loadChecklist not found:', id); showEmptyState(); return; }
  if (DEV) console.log('[checklist] loadChecklist:', id, cl.title);
  renderChecklist(cl);
  renderSidebar();
  closeSidebar();
}

// ─── Render ───────────────────────────────────────────────────────────────

const ICON_RESET  = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`;
const ICON_TRASH  = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
const ICON_PLUS   = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
const ICON_DOWN   = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>`;
const ICON_MINUS  = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
const ICON_CLOSE  = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

function renderChecklist(cl) {
  const checklist  = document.getElementById('checklist-view');
  const emptyState = document.getElementById('empty-state');

  const total   = cl.data.reduce((n, s) => n + s.items.length, 0);
  const checked = cl.data.reduce((n, s) => n + s.items.filter(i => i.checked).length, 0);
  const pct     = total ? Math.round(checked / total * 100) : 0;

  checklist.innerHTML = `
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
          <button class="btn-icon" title="Reset all" onclick="resetAll()">${ICON_RESET}</button>
          <button class="btn-icon danger" title="Delete checklist" onclick="confirmDelete('${esc(cl.id)}')">${ICON_TRASH}</button>
        </div>
        <div class="meta-pill">${checked} / ${total} done</div>
      </div>
    </div>
    <div class="sections-container" id="sections"></div>
  `;

  emptyState.style.display  = 'none';
  checklist.style.display   = 'block';

  renderSections(cl);
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
  const pill    = document.querySelector('.checklist-meta .meta-pill');
  const fill    = document.querySelector('.progress-bar-fill');
  if (pill) pill.textContent  = `${checked} / ${total} done`;
  if (fill) fill.style.width  = pct + '%';
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

  for (var ci = 0; ci < checklists.length; ci++) {
    if (checklists[ci].title.toLowerCase().indexOf(q) !== -1) {
      results.push({ type: 'checklist', ci: ci, si: -1, ii: -1, sectionTitle: '', html: highlightText(checklists[ci].title, q) });
    }
  }

  var cl = getActive();
  if (cl) {
    for (var si = 0; si < cl.data.length; si++) {
      var section = cl.data[si];
      if (section.title.toLowerCase().indexOf(q) !== -1) {
        results.push({ type: 'section', si: si, ii: -1, sectionTitle: '', html: highlightText(section.title, q) });
      }
      for (var ii = 0; ii < section.items.length; ii++) {
        var item = section.items[ii];
        if (item.label.toLowerCase().indexOf(q) !== -1) {
          results.push({ type: 'item', si: si, ii: ii, sectionTitle: section.title, html: highlightText(item.label, q) });
        }
      }
    }
    applySearchHighlights(q);
  }

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
      html += '<div class="search-result-item" data-ci="' + r.ci + '" data-type="checklist"><span class="search-result-type">title</span><span class="search-result-label">' + r.html + '</span></div>';
    }
  }

  var sectionResults = results.filter(function(r) { return r.type === 'section'; });
  if (sectionResults.length) {
    html += '<div class="search-result-group-label">Sections</div>';
    for (var i = 0; i < sectionResults.length; i++) {
      var r = sectionResults[i];
      html += '<div class="search-result-item" data-si="' + r.si + '" data-ii="-1" data-type="section"><span class="search-result-type">section</span><span class="search-result-label">' + r.html + '</span></div>';
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
        html += '<div class="search-result-item" data-si="' + r.si + '" data-ii="' + r.ii + '" data-type="item"><span class="search-result-label">' + r.html + '</span></div>';
      }
    }
  }

  dropdown.innerHTML = html;
  dropdown.classList.add('open');

  var resultItems = dropdown.querySelectorAll('.search-result-item');
  for (var i = 0; i < resultItems.length; i++) {
    resultItems[i].addEventListener('click', function() {
      var type = this.dataset.type;
      var si = this.dataset.si !== undefined ? parseInt(this.dataset.si) : -1;
      var ii = this.dataset.ii !== undefined ? parseInt(this.dataset.ii) : -1;
      var ci = this.dataset.ci !== undefined ? parseInt(this.dataset.ci) : -1;
      handleSearchResult(type, si, ii, ci);
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

function handleSearchResult(type, si, ii, ci) {
  closeAllSearch();

  if (type === 'checklist') {
    var cl = checklists[ci];
    if (cl) loadChecklist(cl.id);
    return;
  }

  if (type === 'section') {
    var el = document.querySelector('.section-header[data-si="' + si + '"]');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('search-highlight-flash');
      setTimeout(function() { el.classList.remove('search-highlight-flash'); }, 1500);
    }
    return;
  }

  if (type === 'item') {
    var el = document.querySelector('[data-si="' + si + '"][data-ii="' + ii + '"]');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('search-highlight-flash');
      setTimeout(function() { el.classList.remove('search-highlight-flash'); }, 1500);
    }
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

  var cl = getActive();
  if (!cl) {
    empty.style.display = 'flex';
    document.getElementById('search-query-display').textContent = q;
    return;
  }

  var results = [];

  for (var ci = 0; ci < checklists.length; ci++) {
    if (checklists[ci].title.toLowerCase().indexOf(q) !== -1) {
      results.push({ type: 'checklist', ci: ci, si: -1, ii: -1, sectionTitle: '', html: highlightText(checklists[ci].title, q) });
    }
  }

  for (var si = 0; si < cl.data.length; si++) {
    var section = cl.data[si];
    if (section.title.toLowerCase().indexOf(q) !== -1) {
      results.push({ type: 'section', si: si, ii: -1, sectionTitle: '', html: highlightText(section.title, q) });
    }
    for (var ii = 0; ii < section.items.length; ii++) {
      var item = section.items[ii];
      if (item.label.toLowerCase().indexOf(q) !== -1) {
        results.push({ type: 'item', si: si, ii: ii, sectionTitle: section.title, html: highlightText(item.label, q) });
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
      html += '<div class="search-result-item" data-ci="' + (r.ci !== undefined ? r.ci : -1) + '" data-type="checklist"><span class="search-result-type">title</span><span class="search-result-label">' + r.html + '</span></div>';
    }
  }

  var sectionResults = results.filter(function(r) { return r.type === 'section'; });
  if (sectionResults.length) {
    html += '<div class="search-result-group-label">Sections</div>';
    for (var i = 0; i < sectionResults.length; i++) {
      var r = sectionResults[i];
      html += '<div class="search-result-item" data-si="' + r.si + '" data-ii="-1" data-type="section"><span class="search-result-type">section</span><span class="search-result-label">' + r.html + '</span></div>';
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
        html += '<div class="search-result-item" data-si="' + r.si + '" data-ii="' + r.ii + '" data-type="item"><span class="search-result-label">' + r.html + '</span></div>';
      }
    }
  }

  container.innerHTML = html;

  var resultItems = container.querySelectorAll('.search-result-item');
  for (var i = 0; i < resultItems.length; i++) {
    resultItems[i].addEventListener('click', function() {
      var type = this.dataset.type;
      var si = this.dataset.si !== undefined ? parseInt(this.dataset.si) : -1;
      var ii = this.dataset.ii !== undefined ? parseInt(this.dataset.ii) : -1;
      var ci = this.dataset.ci !== undefined ? parseInt(this.dataset.ci) : -1;
      handleSearchResult(type, si, ii, ci);
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
    var ci = target.dataset.ci !== undefined ? parseInt(target.dataset.ci) : -1;
    handleSearchResult(type, si, ii, ci);
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
    var ci = target.dataset.ci !== undefined ? parseInt(target.dataset.ci) : -1;
    handleSearchResult(type, si, ii, ci);
  }
});
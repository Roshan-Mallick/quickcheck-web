// ─── Supabase DB ──────────────────────────────────────────────────────────

async function loadChecklists() {
  if (!sb || !currentUser) {
    showToast('Cannot load checklists: Supabase not configured or user not authenticated.', 'error');
    return;
  }

  if (DEV) console.log('[db] loadChecklists for user:', currentUser.id);

  const { data, error } = await sb
    .from('checklists')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });

  if (error) { console.error('[db] loadChecklists error:', error); showToast('Load failed: ' + error.message, 'error'); return; }

  // Exclude checklists that are linked to any workspace — they belong to the workspace view only
  const wsChecklistIds = new Set();
  try {
    const { data: wsLinks } = await sb
      .from('workspace_checklists')
      .select('checklist_id');
    if (wsLinks) wsLinks.forEach(l => wsChecklistIds.add(l.checklist_id));
  } catch (_) {}

  checklists = (data || [])
    .filter(r => !wsChecklistIds.has(r.id))
    .map(r => ({ id: r.id, title: r.title, data: r.data }));
  if (DEV) console.log('[db] loaded personal checklists:', checklists.length);
  renderSidebar();
}

async function persistChecklist(cl) {
  if (!sb || !currentUser) {
    showToast('Cannot save: Supabase not configured or user not authenticated.', 'error');
    return;
  }

  if (DEV) console.log('[db] persistChecklist:', cl.id, cl.title, 'ws mode:', !!activeWorkspace);

  const { error } = await sb.from('checklists').upsert(
    {
      id:         cl.id,
      user_id:    cl._owner_id || currentUser.id,
      title:      cl.title,
      data:       cl.data,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  if (error) {
    console.error('[db] persistChecklist error:', error);
    showToast('Save failed: ' + error.message, 'error');
  } else {
    if (DEV) console.log('[db] persistChecklist success:', cl.id);
  }
}

async function deleteChecklist(id) {
  if (!sb || !currentUser) {
    showToast('Cannot delete: Supabase not configured or user not authenticated.', 'error');
    return;
  }

  if (DEV) console.log('[db] deleteChecklist:', id);

  try {
    const { error } = await sb.from('checklists').delete().eq('id', id);
    if (error) { console.error('[db] deleteChecklist error:', error); showToast('Delete failed: ' + error.message, 'error'); return; }
    checklists = checklists.filter(c => c.id !== id);
    sharedChecklists = sharedChecklists.filter(c => c.id !== id);
    if (activeId === id) { activeId = null; showEmptyState(); }
    renderSidebar();
    showToast('Checklist deleted.');
  } catch (err) {
    console.error('[db] deleteChecklist error:', err);
    showToast('Delete failed: ' + err.message, 'error');
  }
}

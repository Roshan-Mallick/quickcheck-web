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

  checklists = (data || [])
    .map(r => ({ id: r.id, title: r.title, data: r.data }));
  if (DEV) console.log('[db] loaded personal checklists:', checklists.length);
  renderSidebar();
  showDashboard();
}

async function persistChecklist(cl) {
  if (!sb || !currentUser) {
    showToast('Cannot save: Supabase not configured or user not authenticated.', 'error');
    return;
  }

  if (DEV) console.log('[db] persistChecklist:', cl.id, cl.title, 'ws mode:', !!activeWorkspace);

  if (activeWorkspace) {
    const { error } = await sb.from('workspace_checklist_items').upsert(
      {
        id:           cl.id,
        workspace_id: activeWorkspace.id,
        title:        cl.title,
        data:         cl.data,
        updated_at:   new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    if (error) {
      console.error('[db] persistChecklist (workspace) error:', error);
      showToast('Save failed: ' + error.message, 'error');
    } else {
      if (DEV) console.log('[db] persistChecklist (workspace) success:', cl.id);
    }
    return;
  }

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

  if (DEV) console.log('[db] deleteChecklist:', id, 'ws mode:', !!activeWorkspace);

  try {
    if (activeWorkspace) {
      const { error } = await sb.from('workspace_checklist_items').delete().eq('id', id).eq('workspace_id', activeWorkspace.id);
      if (error) { console.error('[db] deleteChecklist (workspace) error:', error); showToast('Delete failed: ' + error.message, 'error'); return; }
    } else {
      const { error } = await sb.from('checklists').delete().eq('id', id);
      if (error) { console.error('[db] deleteChecklist error:', error); showToast('Delete failed: ' + error.message, 'error'); return; }
    }
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

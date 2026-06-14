// ─── Supabase DB ──────────────────────────────────────────────────────────

/**
 * Load all checklists for the current user from Supabase, ordered newest first.
 */
async function loadChecklists() {
  if (!sb || !currentUser) {
    showToast('Cannot load checklists: Supabase not configured or user not authenticated.', 'error');
    return;
  }

  const { data, error } = await sb
    .from('checklists')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });

  if (error) { showToast('Load failed: ' + error.message, 'error'); return; }

  checklists = (data || []).map(r => ({ id: r.id, title: r.title, data: r.data }));
  renderSidebar();
}

/**
 * Upsert a single checklist to Supabase.
 * Uses the `saving` guard to prevent overlapping concurrent writes.
 */
async function persistChecklist(cl) {
  if (!sb || !currentUser) {
    showToast('Cannot save: Supabase not configured or user not authenticated.', 'error');
    return;
  }
  if (saving) return;
  saving = true;

  try {
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
    if (error) showToast('Save failed: ' + error.message, 'error');
  } finally {
    saving = false;
  }
}

/**
 * Delete a checklist by ID from Supabase and remove it from local state.
 */
async function deleteChecklist(id) {
  if (!sb || !currentUser) {
    showToast('Cannot delete: Supabase not configured or user not authenticated.', 'error');
    return;
  }

  try {
    const { error } = await sb.from('checklists').delete().eq('id', id);
    if (error) { showToast('Delete failed: ' + error.message, 'error'); return; }
    checklists = checklists.filter(c => c.id !== id);
    sharedChecklists = sharedChecklists.filter(c => c.id !== id);
    if (activeId === id) { activeId = null; showEmptyState(); }
    renderSidebar();
    showToast('Checklist deleted.');
  } catch (err) {
    showToast('Delete failed: ' + err.message, 'error');
  }
}

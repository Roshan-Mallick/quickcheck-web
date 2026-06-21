// ─── Markdown Parser ──────────────────────────────────────────────────────

/**
 * Parse a markdown string into checklist section/item structure.
 *
 * Supported syntax:
 *   ## Heading       → section title
 *   - [ ] item       → unchecked item
 *   - [x] item       → checked item
 *   - plain item     → unchecked item (no checkbox syntax required)
 *
 * @param {string} text - Raw markdown content
 * @returns {Array<{id:string, title:string, items:Array<{id:string, label:string, checked:boolean}>}>}
 */
function parseMd(text) {
  const lines    = text.split('\n');
  const sections = [];
  let current    = null;

  for (const raw of lines) {
    const line = raw.trimEnd();

    // Any heading level (# through ######) starts a new section
    const hMatch = line.match(/^#{1,6}\s+(.+)/);
    if (hMatch) {
      current = { id: uid(), title: hMatch[1].trim(), items: [] };
      sections.push(current);
      continue;
    }

    // - [ ] or - [x] checkbox syntax
    const cbMatch = line.match(/^[-*+]\s+\[([ xX])\]\s+(.*)/);
    if (cbMatch) {
      if (!current) { current = { id: uid(), title: 'General', items: [] }; sections.push(current); }
      current.items.push({
        id:      uid(),
        label:   cbMatch[2].trim(),
        checked: cbMatch[1].toLowerCase() === 'x',
      });
      continue;
    }

    // Plain list item (no checkbox) — treated as unchecked
    const listMatch = line.match(/^[-*+]\s+(?!\[)(.*)/);
    if (listMatch && listMatch[1].trim()) {
      if (!current) { current = { id: uid(), title: 'General', items: [] }; sections.push(current); }
      current.items.push({ id: uid(), label: listMatch[1].trim(), checked: false });
    }
  }

  // Drop sections that ended up with no items
  return sections.filter(s => s.items.length > 0);
}

/**
 * Convert a checklist object back to a markdown string.
 *
 * @param {{id:string, title:string, data:Array<{id:string, title:string, items:Array<{id:string, label:string, checked:boolean}>}>}} cl
 * @returns {string} Markdown representation
 */
function checklistToMd(cl) {
  const lines = [];
  lines.push(`# ${cl.title}`);
  lines.push('');
  for (const section of cl.data) {
    lines.push(`## ${section.title}`);
    for (const item of section.items) {
      const checkbox = item.checked ? '[x]' : '[ ]';
      lines.push(`- ${checkbox} ${item.label}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

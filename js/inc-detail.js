// Double-click a value in the Internal Non Conformance table: shows the expected value and the INC trigger
(() => {
  const norm = text => String(text ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

  // Match header names to the criteria list ignoring case, spaces and punctuation.
  // If the spelling is slightly different (1-2 letter typo), the closest name is used.
  const keyOf = text => String(text ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  function editDistance(a, b) {
    const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev.splice(0, prev.length, ...cur);
    }
    return prev[b.length];
  }
  function findCriteria(parameter) {
    if (typeof INC_CRITERIA === 'undefined') return null;
    const wanted = keyOf(parameter);
    if (!wanted) return null;
    let best = null;
    let bestDistance = Infinity;
    Object.keys(INC_CRITERIA).forEach(name => {
      const distance = editDistance(keyOf(name), wanted);
      if (distance < bestDistance) { bestDistance = distance; best = name; }
    });
    return best && bestDistance <= 2 ? INC_CRITERIA[best] : null;
  }

  let activeCell = null;
  const WIDTH = 360;
  // Keep the box next to its cell: to the right, or to the left when there is no room
  function placeNear(cell, dialog) {
    const rect = cell.getBoundingClientRect();
    let left = rect.right + 8;
    if (left + WIDTH > window.innerWidth - 8) left = Math.max(8, rect.left - WIDTH - 8);
    dialog.style.left = left + 'px';
    // Start level with the cell; move up only as far as needed to keep the whole box on screen
    const height = dialog.offsetHeight || 300;
    dialog.style.top = Math.max(8, Math.min(rect.top, window.innerHeight - height - 8)) + 'px';
  }

  function closePopup() {
    activeCell = null;
    const overlay = document.getElementById('incDetailOverlay');
    if (overlay) overlay.remove();
  }

  function row(label, value) {
    return `<div style="display:flex;gap:12px;padding:8px 0;border-bottom:1px solid #e2e8f0">
      <div style="width:130px;font-weight:700;color:#334155">${label}</div>
      <div style="flex:1;color:#0f172a">${value}</div>
    </div>`;
  }

  // Yes / No / Good parameters: the value either matches the expected answer or it triggers an INC
  function resultOf(criteria, value) {
    const expected = norm(criteria.expected);
    if (['yes', 'no', 'good'].includes(expected)) {
      return norm(value) === expected ? 'OK (matches expected)' : 'INC triggered (does not match expected)';
    }
    return 'Check the value against the expected limit: ' + criteria.expected;
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // Critical = red; Major and Minor = orange
  function severityHtml(text) {
    const color = /^critical/i.test(text) ? '#dc2626' : /^(major|minor)/i.test(text) ? '#ea580c' : '#0f172a';
    return `<span style="color:${color};font-weight:700">${esc(text)}</span>`;
  }

  function openPopup(cell) {
    const tr = cell.parentElement;
    const index = [...tr.children].indexOf(cell);
    const headerRows = document.querySelectorAll('.report-table thead tr');
    const headerRow = headerRows[headerRows.length - 1];
    // The Date header spans two rows, so the second header row has one cell fewer than the body rows
    const parameter = headerRow && index > 0 && headerRow.children[index - 1] ? headerRow.children[index - 1].textContent.trim() : '';
    const date = tr.children[0] ? tr.children[0].textContent.trim() : '';
    const value = cell.textContent.trim();
    const criteria = findCriteria(parameter);

    closePopup();
    const overlay = document.createElement('div');
    overlay.id = 'incDetailOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:transparent;z-index:10000;pointer-events:none';
    overlay.innerHTML = `
      <div role="dialog" aria-modal="false" style="position:fixed;width:360px;max-width:calc(100vw - 16px);pointer-events:auto;background:#fff;border-radius:14px;box-shadow:0 20px 50px rgba(15,23,42,.35);overflow:hidden;font:500 .9rem Calibri,Carlito,sans-serif">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;background:#dbeafe;color:#1e3a8a;padding:14px 18px;font-weight:800"><span>${esc(parameter || 'Detail')}</span><button type="button" id="incDetailClose" aria-label="Close" title="Close" style="width:26px;height:26px;border:0;border-radius:50%;background:#ef4444;color:#fff;font:700 1.1rem Calibri,Carlito,sans-serif;line-height:1;cursor:pointer;flex:0 0 auto;box-shadow:0 2px 6px rgba(239,68,68,.35)">&times;</button></div>
        <div style="padding:6px 18px 14px">
          ${row('Date', esc(date || '-'))}
          ${row('Value', esc(value || '-'))}
          ${criteria ? row('Section', esc(criteria.section)) : ''}
          ${criteria ? row('Expected value', esc(criteria.expected)) : ''}
          ${criteria ? row('Result', esc(resultOf(criteria, value))) : ''}
          ${criteria ? row('INC trigger', severityHtml(criteria.deviation)) : row('INC trigger', 'No criteria listed for this parameter')}
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const dialog = overlay.firstElementChild;
    placeNear(cell, dialog);
    activeCell = cell;
    document.getElementById('incDetailClose').addEventListener('click', closePopup);
  }

  document.addEventListener('dblclick', event => {
    const cell = event.target.closest('#reportSheet .report-table tbody td');
    if (cell) openPopup(cell);
  });
  document.addEventListener('mousedown', event => {
    const dialog = document.querySelector('#incDetailOverlay [role="dialog"]');
    if (dialog && !dialog.contains(event.target)) closePopup();
  });
  document.addEventListener('scroll', () => {
    const dialog = document.querySelector('#incDetailOverlay [role="dialog"]');
    if (!dialog || !activeCell) return;
    const rect = activeCell.getBoundingClientRect();
    if (!activeCell.isConnected || rect.bottom < 0 || rect.top > window.innerHeight) { closePopup(); return; }
    placeNear(activeCell, dialog);
  }, true);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closePopup(); });
})();

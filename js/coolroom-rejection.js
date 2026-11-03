// ============================================
// COOL ROOM REJECTION INPUT - Date + many (Item, Qty)
// Items come from the Masterdata sheet
// ============================================
const API_URL_REJECTION = 'https://script.google.com/macros/s/AKfycbxY0TPyoSAOTACaDzjOAwI4y3Fo5Movlx5G6hhROxNBHUpx7cZSRctCRaWNtd1iw4U6/exec';

document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const form = $('rejForm');
  if (!form) return;

  const dateInput = $('rejDate'), rowsEl = $('rejRows');
  const submitBtn = $('submitBtn'), messageEl = $('formMessage');

  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const n = v => { const x = parseFloat(v); return isNaN(x) ? 0 : x; };
  const r2 = x => Math.round(x * 100) / 100;

  let masterItems = [];

  const today = () => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  dateInput.value = today();

  // ===== Masterdata items =====
  (async function loadItems() {
    for (let i = 0; i < 3; i++) {
      try {
        const res = await (await fetch(API_URL_REJECTION + '?action=getMasterData&_t=' + Date.now())).json();
        if (!res.success) throw new Error(res.error);
        masterItems = res.items || [];
        fillItemSelects();
        return;
      } catch (e) { await new Promise(r => setTimeout(r, 400 * (i + 1))); }
    }
    showMessage('❌ Could not load the item list. Refresh the page.', 'error');
  })();

  // ===== Item dropdown (Masterdata) =====
  function itemOptions() {
    return '<option value="">-- Select Item --</option>' +
      masterItems.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join('');
  }
  // Items load wela iwara unama, kalin hadapu rows walatath list eka danawa
  function fillItemSelects() {
    rowsEl.querySelectorAll('.rej-item').forEach(sel => {
      const v = sel.value;
      sel.innerHTML = itemOptions();
      sel.value = v;
    });
  }

  // ===== Rows =====
  function rowHtml() {
    return `<div class="rej-row">
      <span class="rej-no"></span>
      <select class="rej-item">${itemOptions()}</select>
      <input type="number" class="rej-qty" step="0.01" min="0" placeholder="0.00" />
      <button type="button" class="rej-del" title="Remove">&times;</button>
    </div>`;
  }

  function renumber() {
    const rows = rowsEl.querySelectorAll('.rej-row');
    rows.forEach((r, i) => {
      r.querySelector('.rej-no').textContent = i + 1;
      r.querySelector('.rej-del').disabled = rows.length === 1;
    });
    let t = 0;
    rows.forEach(r => { t += n(r.querySelector('.rej-qty').value); });
    $('rejTotal').textContent = r2(t).toFixed(2);
  }

  function addRow(focus) {
    rowsEl.insertAdjacentHTML('beforeend', rowHtml());
    renumber();
    if (focus) rowsEl.lastElementChild.querySelector('.rej-item').focus();
  }

  function resetRows() { rowsEl.innerHTML = ''; addRow(false); }

  $('rejAddRow').addEventListener('click', () => addRow(true));

  rowsEl.addEventListener('click', e => {
    const del = e.target.closest('.rej-del');
    if (!del || del.disabled) return;
    del.closest('.rej-row').remove();
    renumber();
  });
  rowsEl.addEventListener('input', e => {
    e.target.classList.remove('rej-bad');
    if (e.target.classList.contains('rej-qty')) renumber();
  });

  // ===== Save =====
  form.addEventListener('submit', async e => {
    e.preventDefault();

    const entries = [];
    let bad = false;
    rowsEl.querySelectorAll('.rej-row').forEach(r => {
      const itemEl = r.querySelector('.rej-item'), qtyEl = r.querySelector('.rej-qty');
      const item = itemEl.value.trim(), qty = qtyEl.value.trim();
      if (!item && !qty) return;                       // empty row -> skip

      const itemOk = masterItems.length === 0 || masterItems.indexOf(item) !== -1;
      if (!item || !itemOk) { itemEl.classList.add('rej-bad'); bad = true; }
      if (!(n(qty) > 0))    { qtyEl.classList.add('rej-bad'); bad = true; }
      entries.push({ item, qty: r2(n(qty)) });
    });

    if (bad) { showMessage('❌ Pick each item from the list and enter a Qty greater than 0.', 'error'); return; }
    if (!entries.length) { showMessage('❌ Add at least one rejected item.', 'error'); return; }

    if (!(await confirmSave({
      title: 'Confirm Save — Cool Room Rejection',
      subtitle: 'Please review before saving',
      meta: [
        { label: '📅 Date', value: dateInput.value.split('-').reverse().join('-') },
        { label: 'Total', value: r2(entries.reduce((t, e) => t + e.qty, 0)).toFixed(2) + ' kg' }
      ],
      sections: [{
        title: 'Rejected Items',
        fields: entries.map((e, i) => ({ label: esc((i + 1) + '. ' + e.item), value: e.qty.toFixed(2) + ' kg' }))
      }]
    }))) return;    

    const u = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const orig = submitBtn.innerHTML;
    submitBtn.innerHTML = 'Saving...'; submitBtn.disabled = true;

    try {
      const res = await (await fetch(API_URL_REJECTION, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'saveCoolRoomRejectionData',
          date: dateInput.value,
          user: u.name || u.username || '',
          entries
        })
      })).json();

      if (res.success) {
        InputFeedback.success(entries.length + ' item(s) saved successfully.');
        resetRows();
      } else {
        showMessage('❌ ' + (res.error || 'Error saving data.'), 'error');
      }
    } catch (err) {
      console.error('Save error:', err);
      showMessage('❌ Error saving data. Please try again.', 'error');
    } finally {
      submitBtn.innerHTML = orig; submitBtn.disabled = false;
    }
  });

  function showMessage(text, type) {
    messageEl.textContent = text;
    messageEl.className = 'form-message ' + type;
    setTimeout(() => { messageEl.textContent = ''; messageEl.className = 'form-message'; }, 5000);
  }

  resetRows();
});
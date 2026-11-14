// ============================================
// SHOP RETURNS PAGE - Date + Rep -> shop return decisions
// ============================================
const API_URL_SHOP = 'https://script.google.com/macros/s/AKfycbxY0TPyoSAOTACaDzjOAwI4y3Fo5Movlx5G6hhROxNBHUpx7cZSRctCRaWNtd1iw4U6/exec';
const SR_OTHER = 'Something else';

document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const dateInput = $('srDate'), repSelect = $('srRep'), body = $('srBody');
  if (!dateInput || !repSelect) return;

  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const n = v => { const x = parseFloat(v); return isNaN(x) ? 0 : x; };
  const r2 = x => Math.round(x * 100) / 100;

    let editMode = false;
  let rows = [], customers = [], reasons = [], conditions = [], loadToken = 0;
  let rw = [];   // per row: rework lines [{ qty, item }, ...]
  let bt = [];   // per row: batch numbers ['N26242', 'N26245', ...]

  async function getJson(url) {
    for (let i = 0; i < 3; i++) {
      try { return await (await fetch(url + '&_t=' + Date.now())).json(); }
      catch (e) { await new Promise(r => setTimeout(r, 400 * (i + 1))); }
    }
    throw new Error('Network error');
  }

  // ===== Rep list =====
  (async function loadReps() {
    try {
      const res = await getJson(API_URL_SHOP + '?action=getReturnReps');
      if (!res.success) throw new Error(res.error);
      repSelect.innerHTML = '<option value="">-- Select Rep --</option>' +
        res.reps.map(r => `<option value="${esc(r)}">${esc(r)}</option>`).join('');
    } catch (e) {
      repSelect.innerHTML = '<option value="">Failed to load reps</option>';
    }
  })();

  // ===== Reason + Product Condition lists (Returnreason / Productcon sheets) =====
  const listsReady = (async function loadLists() {
    try {
      const res = await getJson(API_URL_SHOP + '?action=getShopLists');
      if (res.success) { reasons = res.reasons || []; conditions = res.conditions || []; }
      else console.error('Lists error:', res.error);
    } catch (e) { console.error('Lists load error:', e); }
  })();

  // ===== Masterdata items (Item To Be Rework dropdown) =====
  let masterItems = [];
  const masterReady = (async function loadMasterItems() {
    try {
      const res = await getJson(API_URL_SHOP + '?action=getMasterData');
      if (res.success) masterItems = res.items || [];
    } catch (e) { console.error('Masterdata load error:', e); }
  })();

  dateInput.addEventListener('change', loadRows);
  repSelect.addEventListener('change', loadRows);

  function show(state, msg) {
    $('srEmpty').style.display = state === 'empty' ? 'flex' : 'none';
    $('srLoading').style.display = state === 'loading' ? 'flex' : 'none';
    $('srWrap').style.display = state === 'table' ? 'flex' : 'none';
    if (state === 'empty') $('srEmpty').querySelector('p').textContent =
      msg || 'Select a date and a rep to load shop returns';
  }

  // ===== Load rows + customers of the rep =====
  async function loadRows() {
    const date = dateInput.value, rep = repSelect.value;
    if (!date || !rep) { show('empty'); return; }
    const token = ++loadToken;
    show('loading');
    try {
      await Promise.all([listsReady, masterReady]);
      const [res, cus] = await Promise.all([
        getJson(`${API_URL_SHOP}?action=getShopReturnsByDateRep&date=${encodeURIComponent(date)}&rep=${encodeURIComponent(rep)}`),
        getJson(`${API_URL_SHOP}?action=getShopCustomers&rep=${encodeURIComponent(rep)}`)
      ]);
      if (token !== loadToken) return;               // a newer selection is already loading
      if (!res.success) throw new Error(res.error);
      if (!cus.success) throw new Error(cus.error);
      rows = res.rows || [];
      customers = cus.customers || [];
      if (!rows.length) { show('empty', 'No shop returns for this date and rep'); return; }
      render();
      show('table');
    } catch (e) {
      if (token !== loadToken) return;
      console.error(e);
      show('empty', 'Error loading items');
    }
  }

  // ===== Batch No (YYDDD Julian) -> production date 'yyyy-mm-dd' =====
  function prodDate(batch) {
    const m = String(batch || '').toUpperCase().match(/(\d{2})(\d{3})\D*$/);
    if (!m) return null;
    const year = 2000 + parseInt(m[1], 10), doy = parseInt(m[2], 10);
    if (doy < 1) return null;
    const d = new Date(Date.UTC(year, 0, doy));
    return d.getUTCFullYear() === year ? d.toISOString().slice(0, 10) : null;
  }

  // ===== Cell builders =====
  const customerCell = (i, saved) => {
    const sel = String(saved || '').trim();
    const list = customers.slice();
    if (sel && list.indexOf(sel) === -1) list.unshift(sel);   // saved value still shows
    return `<select class="sr-input sr-select" data-f="customer" data-i="${i}">` +
      '<option value="">-- Select Customer --</option>' +
      list.map(c => `<option value="${esc(c)}"${c === sel ? ' selected' : ''}>${esc(c)}</option>`).join('') +
      '</select>';
  };

  // Dropdown from a sheet list + last option "Something else" (manual text)
  const listCell = (field, i, list, saved) => {
    const sel = String(saved || '').trim();
    const items = list.filter(x => x !== SR_OTHER);
    const inList = !sel || items.indexOf(sel) !== -1;
    const chosen = inList ? sel : SR_OTHER;           // unknown saved value -> shown as manual text
    const otherText = inList ? '' : sel;
    return `<select class="sr-input sr-select" data-f="${field}" data-i="${i}">` +
      '<option value="">-- Select --</option>' +
      items.map(x => `<option value="${esc(x)}"${x === chosen ? ' selected' : ''}>${esc(x)}</option>`).join('') +
      `<option value="${SR_OTHER}"${chosen === SR_OTHER ? ' selected' : ''}>${SR_OTHER}</option>` +
      '</select>' +
      `<input type="text" class="sr-input sr-other" data-f="${field}Other" data-i="${i}" ` +
      `placeholder="Type here" value="${esc(otherText)}"${chosen === SR_OTHER ? '' : ' style="display:none"'} />`;
  };

  const numInp = (field, i, v) =>
    `<input type="number" step="0.01" min="0" class="sr-input sr-num" data-f="${field}" data-i="${i}" value="${esc(v)}" />`;

  // ===== Rework lines: one returned item -> one or more new items =====
  // Sheet: L = total rework qty, R = "Item" (single) or "ItemA (10kg); ItemB (5kg)" (many)
  const LINE_RE = /^(.*) \(([\d.]+)kg\)$/;
  function parseRework(total, itemText) {
    const t = String(itemText || '').trim();
    if (t) {
      const parts = t.split('; ').map(p => p.match(LINE_RE));
      if (parts.every(Boolean)) return parts.map(m => ({ qty: m[2], item: m[1] }));
    }
    return [{ qty: (total === '' || total == null) ? '' : String(total), item: t }];
  }
  const reworkTotal = i => r2(rw[i].reduce((a, l) => a + n(l.qty), 0));
  const reworkHasQty = i => rw[i].some(l => String(l.qty).trim() !== '');
  function reworkText(lines) {
    const used = lines.filter(l => l.item || n(l.qty) > 0);
    if (used.length <= 1) return used.length ? used[0].item : '';
    return used.map(l => `${l.item} (${r2(n(l.qty))}kg)`).join('; ');
  }

  const rwItemSelect = (i, k, selected) => {
    const sel = String(selected || '').trim();
    const list = masterItems.slice();
    if (sel && list.indexOf(sel) === -1) list.unshift(sel);   // saved value still shows
    return `<select class="sr-input sr-select" data-f="rwItem" data-i="${i}" data-k="${k}">` +
      '<option value="">-- Select Item --</option>' +
      list.map(it => `<option value="${esc(it)}"${it === sel ? ' selected' : ''}>${esc(it)}</option>`).join('') +
      '</select>';
  };

  const rwHtml = i => rw[i].map((l, k) =>
    '<div class="sr-rw-line">' +
      `<input type="number" step="0.01" min="0" class="sr-input sr-num" placeholder="kg" data-f="rwQty" data-i="${i}" data-k="${k}" value="${esc(l.qty)}" />` +
      rwItemSelect(i, k, l.item) +
      (k === 0
        ? `<button type="button" class="sr-rw-btn sr-rw-add" data-add="${i}" title="Add another item">+</button>`
        : `<button type="button" class="sr-rw-btn sr-rw-del" data-del="${i}:${k}" title="Remove">&times;</button>`) +
    '</div>'
  ).join('');

  // ===== Batch numbers: one or more per returned item (+ button), each with its own production date =====
  const batchList = i => bt[i].map(b => String(b).trim().toUpperCase()).filter(Boolean);
  const btHtml = i =>
    '<div class="sr-bt-line sr-bt-head"><span>Batch no</span><span></span><span>Production date</span></div>' +
    bt[i].map((b, k) =>
      '<div class="sr-bt-line">' +
        `<input type="text" class="sr-input sr-text" data-f="batchNo" data-i="${i}" data-k="${k}" placeholder="N26242" value="${esc(b)}" />` +
        (k === 0
          ? `<button type="button" class="sr-rw-btn sr-rw-add" data-badd="${i}" title="Add another batch no">+</button>`
          : `<button type="button" class="sr-rw-btn sr-rw-del" data-bdel="${i}:${k}" title="Remove">&times;</button>`) +
        `<b class="sr-prod" id="prod${i}_${k}">-</b>` +
      '</div>'
    ).join('');

  // Row already has saved decisions?  (Batch No is not counted)
  const isSaved = r => ['customer', 'reason', 'condition', 'coolRoom', 'rework', 'itemToRework', 'rejectQty']
    .some(k => String(r[k] == null ? '' : r[k]).trim() !== '');

  // Saved cards are locked
  function lockSaved() {
    body.querySelectorAll('.sr-card.sr-saved').forEach(card =>
      card.querySelectorAll('input, select, textarea, button').forEach(el => { el.disabled = true; }));
  }

  function removeSavedAlert() {
    const o = document.getElementById('alreadySavedAlert');
    if (o) o.remove();
  }

  function showSavedAlert() {
    removeSavedAlert();
    const box = document.createElement('div');
    box.id = 'alreadySavedAlert';
    box.className = 'already-saved-alert';
    box.innerHTML = `
      <div class="already-saved-content">
        <div class="already-saved-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        </div>
        <div class="already-saved-text">
          <h4>Already Saved</h4>
          <p>Data for this date is already saved. If you want to change it, click the Edit button, edit the data and save again. The new data will replace the old data.</p>
        </div>
        <button class="already-saved-edit" type="button">&#9998; Edit</button>
      </div>`;
    box.querySelector('.already-saved-edit').addEventListener('click', enableEdit);
    const wrap = $('srWrap');
    wrap.insertBefore(box, wrap.firstChild);
  }

    function enableEdit() {
    editMode = true;
    body.querySelectorAll('.sr-card').forEach(card => {
      card.classList.remove('sr-saved');
      card.querySelectorAll('input, select, textarea, button').forEach(el => { el.disabled = false; });
    });
    removeSavedAlert();
    updateSavedNote();
  }

  // ===== Render =====
    function render() {
    editMode = false;
    rw = rows.map(r => parseRework(r.rework, r.itemToRework));
    bt = rows.map(r => {
      const list = String(r.batchNo || '').split(';').map(s => s.trim()).filter(Boolean);
      return list.length ? list : [''];
    });
    body.innerHTML = rows.map((r, i) => `
      <section class="sr-card${isSaved(r) ? ' sr-saved' : ''}">
        <header class="sr-card-head">
          <span class="sr-card-no">${toRomanNumber_(i + 1)}</span>
          <span class="sr-card-item">${esc(r.itemName) || '-'}</span>
          <span class="sr-card-qty">${esc(r.qty) || '-'} kg</span>
          <span class="sr-bal" id="bal${i}">-</span>
        </header>
        <div class="sr-grid">
          <label class="sr-field"><span>Customer</span>${customerCell(i, r.customer)}</label>
          <div class="sr-field"><span>Reason for return</span>${listCell('reason', i, reasons, r.reason)}</div>
          <label class="sr-field"><span>Loading date</span>
            <input type="date" class="sr-input" data-f="loadingDate" data-i="${i}" value="${esc(r.loadingDate)}" />
          </label>
          <div class="sr-field sr-batches" id="sr-bt${i}">${btHtml(i)}</div>
          <div class="sr-decision">
            <div class="sr-decision-title">Decision taken (kg)</div>
            <label class="sr-field"><span>Cool room</span>${numInp('coolRoom', i, r.coolRoom)}</label>
            <label class="sr-field"><span>Reject qty</span>${numInp('rejectQty', i, r.rejectQty)}</label>
            <div class="sr-field sr-rework"><span>Rework (kg) and item to be reworked</span><div id="sr-rw${i}">${rwHtml(i)}</div></div>
          </div>
          <div class="sr-field sr-wide"><span>Product condition</span>${listCell('condition', i, conditions, r.condition)}</div>
        </div>
      </section>`).join('');

    rows.forEach((r, i) => updateAllProd(i));
    lockSaved();
    if (body.querySelector('.sr-card.sr-saved')) showSavedAlert();
    else removeSavedAlert();
    recalc();
    updateSavedNote();
  }

  const el = (f, i) => body.querySelector(`[data-f="${f}"][data-i="${i}"]`);
  const val = (f, i) => el(f, i).value;
  // Dropdown value, or the typed text when "Something else" is selected
  const listVal = (f, i) => { const v = val(f, i); return v === SR_OTHER ? val(f + 'Other', i).trim() : v; };

  // ===== Production date from Batch No =====
  function updateAllProd(i) { bt[i].forEach((b, k) => updateProd(i, k)); }

  function updateProd(i, k) {
    const b = String(bt[i][k] || '').trim();
    const cell = $('prod' + i + '_' + k);
    if (!cell) return;
    if (!b) { cell.textContent = '-'; cell.className = 'sr-prod'; cell.title = ''; return; }
    const d = prodDate(b);
    if (!d) { cell.textContent = 'Invalid'; cell.className = 'sr-prod bad'; cell.title = 'Batch No must end with YYDDD (e.g. N26242)'; return; }
    const late = dateInput.value && d > dateInput.value;
    cell.textContent = d;
    cell.className = 'sr-prod ' + (late ? 'bad' : 'ok');
    cell.title = late ? 'Production date is after the return date' : '';
  }

  // ===== Balance = Qty - (Cool Room + Rework + Reject Qty); totals row =====
  function recalc() {
    const t = { qty: 0, cool: 0, rew: 0, rej: 0 };
    rows.forEach((r, i) => {
      const cool = n(val('coolRoom', i)), rew = reworkTotal(i), rej = n(val('rejectQty', i));
      const bal = r2(n(r.qty) - cool - rew - rej);
      const cell = $('bal' + i);
      cell.textContent = 'Balance ' + bal.toFixed(2);
      cell.className = 'sr-bal ' + (bal === 0 ? 'ok' : 'bad');
      t.qty += n(r.qty); t.cool += cool; t.rew += rew; t.rej += rej;
    });
    const totBal = r2(t.qty - t.cool - t.rew - t.rej);
    $('srTotal').innerHTML =
      `<span>Total qty <b>${r2(t.qty).toFixed(2)}</b></span>` +
      `<span>Cool room <b>${r2(t.cool).toFixed(2)}</b></span>` +
      `<span>Rework <b>${r2(t.rew).toFixed(2)}</b></span>` +
      `<span>Reject qty <b>${r2(t.rej).toFixed(2)}</b></span>` +
      `<span>Balance <b class="${totBal === 0 ? 'ok' : 'bad'}">${totBal.toFixed(2)}</b></span>`;
  }

  // ===== "Already saved" note =====
  function updateSavedNote() {
    const note = $('srSavedNote');
    const any = !!body.querySelector('.sr-card.sr-saved');
    note.style.display = 'none';   // old green note is not used any more
    const cards = body.querySelectorAll('.sr-card');
    const all = cards.length > 0 && body.querySelectorAll('.sr-card.sr-saved').length === cards.length;
    const sb = $('srSaveBtn');
    if (!sb.dataset.def) sb.dataset.def = sb.innerHTML;
    sb.disabled = all;
    sb.innerHTML = all ? 'Already Saved' : sb.dataset.def;
  }

  // ===== Input events (one listener for the whole table) =====
  ['input', 'change'].forEach(evt => body.addEventListener(evt, e => {
    const t = e.target;
    if (!t.classList.contains('sr-input')) return;
    const i = t.dataset.i, f = t.dataset.f;

    if (f === 'rwQty') rw[+i][+t.dataset.k].qty = t.value;
    if (f === 'rwItem') rw[+i][+t.dataset.k].item = t.value;

    if (t.tagName === 'SELECT' && (f === 'reason' || f === 'condition')) {
      const other = el(f + 'Other', i);
      other.style.display = t.value === SR_OTHER ? '' : 'none';
      if (t.value === SR_OTHER && evt === 'change') other.focus();
    }
    if (f === 'batchNo') { bt[+i][+t.dataset.k] = t.value; updateProd(+i, +t.dataset.k); }

    t.closest('.sr-card').classList.remove('sr-saved');     // edited -> not gray anymore
    recalc();
    updateSavedNote();
  }));

  // + / x buttons for batch numbers
  body.addEventListener('click', e => {
    const add = e.target.closest('[data-badd]'), del = e.target.closest('[data-bdel]');
    if (!add && !del) return;
    let i;
    if (add) {
      i = +add.dataset.badd;
      bt[i].push('');
    } else {
      const [bi, bk] = del.dataset.bdel.split(':').map(Number);
      i = bi;
      bt[i].splice(bk, 1);
    }
    $('sr-bt' + i).innerHTML = btHtml(i);
    updateAllProd(i);
    (add || del).closest('.sr-card').classList.remove('sr-saved');
    updateSavedNote();
  });

  // + / x buttons: add or remove a rework line
  body.addEventListener('click', e => {
    const add = e.target.closest('[data-add]'), del = e.target.closest('[data-del]');
    if (!add && !del) return;
    let i;
    if (add) {
      i = +add.dataset.add;
      rw[i].push({ qty: '', item: '' });
    } else {
      const [ri, rk] = del.dataset.del.split(':').map(Number);
      i = ri;
      rw[i].splice(rk, 1);
    }
    $('sr-rw' + i).innerHTML = rwHtml(i);
    (add || del).closest('.sr-card').classList.remove('sr-saved');
    recalc();
    updateSavedNote();
  });

  // Return date changed -> re-check production dates
  dateInput.addEventListener('change', () => rows.forEach((r, i) => { if (bt[i]) updateAllProd(i); }));

  // ===== Save =====
  $('srSaveBtn').addEventListener('click', async () => {
    const pvSections = rows.map((r, i) => {
      const bl = batchList(i);
      const bal = r2(n(r.qty) - n(val('coolRoom', i)) - reworkTotal(i) - n(val('rejectQty', i)));
      return {
        title: esc(`${i + 1}. ${r.itemName} — ${r.qty} kg`),
        fields: [
          { label: 'Customer', value: val('customer', i) },
          { label: 'Reason for return', value: listVal('reason', i) },
          { label: 'Batch No', value: bl.join(', ') },
          { label: 'Production date', value: bl.map(b => prodDate(b) || 'Invalid ⚠').join(', ') },
          { label: 'Loading date', value: val('loadingDate', i) },
          { label: 'Cool room (kg)', value: val('coolRoom', i) },
          { label: 'Rework (kg)', value: reworkHasQty(i) ? String(reworkTotal(i)) : '' },
          { label: 'Item To Be Rework', value: reworkText(rw[i]) },
          { label: 'Reject qty (kg)', value: val('rejectQty', i) },
          { label: 'Product condition', value: listVal('condition', i) },
          { label: 'Balance (kg)', value: bal.toFixed(2) + (bal === 0 ? '' : '  ⚠ not 0') }
        ]
      };
    });
    if (!(await confirmSave({
      title: 'Confirm Save — Shop Returns',
      subtitle: editMode ? 'The saved data for this date will be replaced with this new data' : 'Please review before saving',
      meta: [
        { label: '📅 Date', value: dateInput.value.split('-').reverse().join('-') },
        { label: 'Rep', value: esc(repSelect.value) }
      ],
      sections: pvSections
    }))) return;


    const updates = rows.map((r, i) => ({
      rowIndex: r.rowIndex,
      customer: val('customer', i),
      reason: listVal('reason', i),
      batchNo: batchList(i).join('; '),
      loadingDate: val('loadingDate', i),
      coolRoom: val('coolRoom', i),
      rework: reworkHasQty(i) ? reworkTotal(i) : '',
      itemToRework: reworkText(rw[i]),
      rejectQty: val('rejectQty', i),
      condition: listVal('condition', i)
    }));



    let user = '';
    try {
      const u = JSON.parse(localStorage.getItem('currentUser') || '{}');
      user = u.username || u.name || '';
    } catch (e) { /* ignore */ }

    const btn = $('srSaveBtn'), orig = btn.innerHTML;
    btn.innerHTML = 'Saving...'; btn.disabled = true;
    try {
      await fetch(API_URL_SHOP, {
        method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'saveShopReturns', user, updates })
      });
      showSaveSuccessMessage(btn);
      body.querySelectorAll('.sr-card').forEach(c => c.classList.add('sr-saved'));
      lockSaved();
      editMode = false;
      showSavedAlert();
      updateSavedNote();
    } catch (e) {
      alert('Error saving. Please try again.');
      btn.innerHTML = orig; btn.disabled = false; return;
    }
    setTimeout(updateSavedNote, 1500);
  });
});
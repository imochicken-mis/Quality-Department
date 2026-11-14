// ============================================
// SALES RETURNS PAGE - Date + Rep -> decisions (kg)
// ============================================
const API_URL_RETURNS = 'https://script.google.com/macros/s/AKfycbxY0TPyoSAOTACaDzjOAwI4y3Fo5Movlx5G6hhROxNBHUpx7cZSRctCRaWNtd1iw4U6/exec';

document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const dateInput = $('retDate'), repSelect = $('retRep');
  if (!dateInput || !repSelect) return;

  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const n = v => { const x = parseFloat(v); return isNaN(x) ? 0 : x; };
  const r2 = x => Math.round(x * 100) / 100;

  // Truck No: LN 2885 / ln2885 -> LN-2885
  const formatTruck = v => String(v || '')
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean)
    .join('-')
    .replace(/([A-Z])(?=\d)|(\d)(?=[A-Z])/g, '$&-');

  $('retTruck').addEventListener('blur', e => { e.target.value = formatTruck(e.target.value); });

  let rows = [];
    let editMode = false;
  let rw = [];   // per returned row: rework lines [{ qty, item }, ...]   // per returned row: rework lines [{ qty, item }, ...]

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
      const res = await getJson(API_URL_RETURNS + '?action=getReturnReps');
      if (!res.success) throw new Error(res.error);
      repSelect.innerHTML = '<option value="">-- Select Rep --</option>' +
        res.reps.map(r => `<option value="${esc(r)}">${esc(r)}</option>`).join('');
    } catch (e) {
      repSelect.innerHTML = '<option value="">Failed to load reps</option>';
    }
  })();

  // ===== Masterdata items (Item To Be Rework dropdown) =====
  let masterItems = [];
  const masterReady = (async function loadMasterItems() {
    try {
      const res = await getJson(API_URL_RETURNS + '?action=getMasterData');
      if (res.success) masterItems = res.items || [];
    } catch (e) { console.error('Masterdata load error:', e); }
  })();

  dateInput.addEventListener('change', loadRows);
  repSelect.addEventListener('change', loadRows);

  function show(state, msg) {
    $('retEmpty').style.display = state === 'empty' ? 'flex' : 'none';
    $('retLoading').style.display = state === 'loading' ? 'flex' : 'none';
    $('retWrap').style.display = state === 'table' ? 'flex' : 'none';
    if (state === 'empty') $('retEmpty').querySelector('p').textContent =
      msg || 'Select a date and a rep to load returned items';
  }

  // ===== Load rows =====
  async function loadRows() {
    const date = dateInput.value, rep = repSelect.value;
    if (!date || !rep) { show('empty'); return; }
    show('loading');
    try {
      const res = await getJson(`${API_URL_RETURNS}?action=getReturnsByDateRep&date=${encodeURIComponent(date)}&rep=${encodeURIComponent(rep)}`);
      if (!res.success) throw new Error(res.error);
      await masterReady;
      rows = res.rows || [];
      if (!rows.length) { show('empty', 'No returned items for this date and rep'); return; }
      render();
      show('table');
    } catch (e) {
      console.error(e);
      show('empty', 'Error loading items');
    }
  }

  const inp = (field, i, v) =>
    `<input type="number" step="0.01" min="0" class="ret-input" data-f="${field}" data-i="${i}" value="${esc(v)}" />`;

  // Vehicle / Meat temp: per row, decimals allowed (can be below 0)
  const tempInp = (field, i, v) =>
    `<input type="number" step="0.1" class="ret-input" data-f="${field}" data-i="${i}" value="${esc(v)}" />`;

  const itemSelect = (i, k, selected) => {
    const sel = String(selected || '').trim();
    const list = masterItems.slice();
    if (sel && list.indexOf(sel) === -1) list.unshift(sel);   // kalin save karapu / purudu value eka thiyenawanam pennanna
    return `<select class="ret-input ret-select" data-f="rwItem" data-i="${i}" data-k="${k}">` +
      '<option value="">-- Select Item --</option>' +
      list.map(it => `<option value="${esc(it)}"${it === sel ? ' selected' : ''}>${esc(it)}</option>`).join('') +
      '</select>';
  };

  // ===== Rework lines: one returned item -> one or more new items =====
  // Sheet: J = total rework qty, K = "Item" (single) or "ItemA (10kg); ItemB (5kg)" (many)
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

  const rwQtyHtml = i => rw[i].map((l, k) =>
    `<div class="rw-line"><input type="number" step="0.01" min="0" class="ret-input" data-f="rwQty" data-i="${i}" data-k="${k}" value="${esc(l.qty)}" /></div>`
  ).join('');

  const rwItemHtml = i => rw[i].map((l, k) =>
    `<div class="rw-line">${itemSelect(i, k, l.item)}` +
    (k === 0
      ? `<button type="button" class="rw-btn rw-add" data-add="${i}" title="Add another item">+</button>`
      : `<button type="button" class="rw-btn rw-del" data-del="${i}:${k}" title="Remove">&times;</button>`) +
    '</div>'
  ).join('');

  function redrawRw(i) {
    $('rwq' + i).innerHTML = rwQtyHtml(i);
    $('rwi' + i).innerHTML = rwItemHtml(i);
  }

  // ===== "Already saved" (gray) state =====
  const isSaved = r => ['vehicleTemp', 'meatTemp', 'coolRoom', 'rework', 'itemToRework', 'rejection']
    .some(k => String(r[k] == null ? '' : r[k]).trim() !== '');
  const extraBox = document.querySelector('.returns-extra');
  const savedNote = $('retSavedNote');
  const updateSavedNote = () => {
    const any = $('retBody').querySelector('tr.ret-saved') || extraBox.classList.contains('ret-saved');
    savedNote.style.display = 'none';   // old green note is not used any more
    const all = rows.length > 0 && $('retBody').querySelectorAll('tr.ret-saved').length === rows.length;
    const sb = $('retSaveBtn');
    if (!sb.dataset.def) sb.dataset.def = sb.innerHTML;
    sb.disabled = all;
    sb.innerHTML = all ? 'Already Saved' : sb.dataset.def;
  };
  const markAllSaved = () => {
    $('retBody').querySelectorAll('tr').forEach(tr => tr.classList.add('ret-saved'));
    extraBox.classList.add('ret-saved');
    updateSavedNote();
  };
  extraBox.querySelectorAll('input').forEach(el =>
    el.addEventListener('input', () => { extraBox.classList.remove('ret-saved'); updateSavedNote(); }));

  // Saved rows (and saved truck/temps) are locked
  function lockAll() {
    $('retBody').querySelectorAll('tr.ret-saved').forEach(tr =>
      tr.querySelectorAll('input, select, button').forEach(el => { el.disabled = true; }));
    const lockExtra = extraBox.classList.contains('ret-saved');
    extraBox.querySelectorAll('input').forEach(el => { el.disabled = lockExtra; });
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
    const wrap = $('retWrap');
    wrap.insertBefore(box, wrap.firstChild);
  }

    function enableEdit() {
    editMode = true;
    $('retBody').querySelectorAll('tr').forEach(tr => tr.classList.remove('ret-saved'));
    extraBox.classList.remove('ret-saved');
    $('retBody').querySelectorAll('input, select, button').forEach(el => { el.disabled = false; });
    extraBox.querySelectorAll('input').forEach(el => { el.disabled = false; });
    removeSavedAlert();
    updateSavedNote();
  }

    function render() {
    editMode = false;
    rw = rows.map(r => parseRework(r.rework, r.itemToRework));
    $('retBody').innerHTML = rows.map((r, i) => `
      <tr>
        <td>${toRomanNumber_(i + 1)}</td>
        <td>${esc(r.batchNo) || '-'}</td>
        <td>${esc(r.itemName) || '-'}</td>
        <td>${esc(r.qty) || '-'}</td>
        <td>${tempInp('vehicleTemp', i, r.vehicleTemp)}</td>
        <td>${tempInp('meatTemp', i, r.meatTemp)}</td>
        <td>${inp('coolRoom', i, r.coolRoom)}</td>
        <td class="rw-cell" id="rwq${i}">${rwQtyHtml(i)}</td>
        <td class="rw-cell" id="rwi${i}">${rwItemHtml(i)}</td>
        <td>${inp('rejection', i, r.rejection)}</td>
        <td class="ret-bal" id="bal${i}">-</td>
      </tr>`).join('');

    // Truck No: one value per group, prefill from first row that has it
    const first = k => (rows.find(r => r[k] !== '') || {})[k] || '';
    $('retTruck').value = first('truckNo');
    extraBox.classList.toggle('ret-saved', !!first('truckNo'));

    // Already saved rows -> gray
    const trs = $('retBody').querySelectorAll('tr');
    rows.forEach((r, i) => { if (isSaved(r)) trs[i].classList.add('ret-saved'); });
    lockAll();
    if ($('retBody').querySelector('tr.ret-saved') || extraBox.classList.contains('ret-saved')) showSavedAlert();
    else removeSavedAlert();
    updateSavedNote();
    recalc();
  }

  // One set of handlers for every input / select / button in the table
  const onEdit = e => {
    const el = e.target.closest('.ret-input');
    if (!el) return;
    if (el.dataset.f === 'rwQty') rw[+el.dataset.i][+el.dataset.k].qty = el.value;
    if (el.dataset.f === 'rwItem') rw[+el.dataset.i][+el.dataset.k].item = el.value;
    el.closest('tr').classList.remove('ret-saved');
    updateSavedNote();
    recalc();
  };
  $('retBody').addEventListener('input', onEdit);
  $('retBody').addEventListener('change', onEdit);
  $('retBody').addEventListener('click', e => {
    const add = e.target.closest('[data-add]'), del = e.target.closest('[data-del]');
    if (!add && !del) return;
    const tr = (add || del).closest('tr');
    if (add) {
      const i = +add.dataset.add;
      rw[i].push({ qty: '', item: '' });
      redrawRw(i);
    } else {
      const [i, k] = del.dataset.del.split(':').map(Number);
      rw[i].splice(k, 1);
      redrawRw(i);
    }
    tr.classList.remove('ret-saved');
    updateSavedNote();
    recalc();
  });

  const val = (f, i) => $('retBody').querySelector(`.ret-input[data-f="${f}"][data-i="${i}"]`).value;

  // Balance = Qty - (Cool Room + Rework + Rejection); totals row
  function recalc() {
    const t = { qty: 0, cool: 0, rew: 0, item: 0, rej: 0 };
    rows.forEach((r, i) => {
      const cool = n(val('coolRoom', i)), rew = reworkTotal(i), rej = n(val('rejection', i));
      const bal = r2(n(r.qty) - cool - rew - rej);
      const cell = $('bal' + i);
      cell.textContent = bal.toFixed(2);
      cell.className = 'ret-bal ' + (bal === 0 ? 'ok' : 'bad');
      t.qty += n(r.qty); t.cool += cool; t.rew += rew; t.rej += rej;
    });
    $('retTotal').innerHTML = `<td></td><td></td><td>Total</td><td>${r2(t.qty).toFixed(2)}</td><td></td><td></td>` +
      `<td>${r2(t.cool).toFixed(2)}</td><td>${r2(t.rew).toFixed(2)}</td><td></td>` +
      `<td>${r2(t.rej).toFixed(2)}</td><td>${r2(t.qty - t.cool - t.rew - t.rej).toFixed(2)}</td>`;
  }

  // ===== Save =====
  $('retSaveBtn').addEventListener('click', async () => {
    const pvSections = rows.map((r, i) => {
      const rew = reworkTotal(i), rej = n(val('rejection', i));
      const bal = r2(n(r.qty) - n(val('coolRoom', i)) - rew - rej);
      return {
        title: esc(`${i + 1}. ${r.itemName} — ${r.qty} kg`),
        fields: [
          { label: 'Batch No', value: r.batchNo },
          { label: 'Vehicle Temp (°C)', value: val('vehicleTemp', i) },
          { label: 'Meat Temp (°C)', value: val('meatTemp', i) },
          { label: 'Cool Room (kg)', value: val('coolRoom', i) },
          { label: 'Rework (kg)', value: reworkHasQty(i) ? String(rew) : '' },
          { label: 'Item To Be Rework', value: reworkText(rw[i]) },
          { label: 'Rejection (kg)', value: val('rejection', i) },
          { label: 'Balance (kg)', value: bal.toFixed(2) + (bal === 0 ? '' : '  ⚠ not 0') }
        ]
      };
    });
    if (!(await confirmSave({
      title: 'Confirm Save — Sales Returns',
      subtitle: editMode ? 'The saved data for this date will be replaced with this new data' : 'Please review before saving',
      meta: [
        { label: '📅 Date', value: dateInput.value.split('-').reverse().join('-') },
        { label: 'Rep', value: esc(repSelect.value) },
        { label: 'Truck No', value: esc(formatTruck($('retTruck').value)) || '—' }
      ],
      sections: pvSections
    }))) return;


    const updates = rows.map((r, i) => ({
      rowIndex: r.rowIndex,
      vehicleTemp: val('vehicleTemp', i),
      meatTemp: val('meatTemp', i),
      coolRoom: val('coolRoom', i),
      rework: reworkHasQty(i) ? reworkTotal(i) : '',
      itemToRework: reworkText(rw[i]),
      rejection: val('rejection', i)
    }));



    const btn = $('retSaveBtn'), orig = btn.innerHTML;
    btn.innerHTML = 'Saving...'; btn.disabled = true;
    try {
      await fetch(API_URL_RETURNS, {
        method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'saveReturnsData',
          truckNo: formatTruck($('retTruck').value),
          updates
        })
      });
      showSaveSuccessMessage(btn);
      markAllSaved();
      lockAll();
      editMode = false;
      showSavedAlert();
    } catch (e) {
      alert('Error saving. Please try again.');
      btn.innerHTML = orig; btn.disabled = false; return;
    }
    setTimeout(updateSavedNote, 1500);
  });
});
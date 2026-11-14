// ============================================
// SALES RETURNS REPORT (monthly) - Admin
// "Returns" sheet, only rows where B (Return Category) = "Sales Return"
// ============================================
const API_URL_RETURNS_REPORT = 'https://script.google.com/macros/s/AKfycbxY0TPyoSAOTACaDzjOAwI4y3Fo5Movlx5G6hhROxNBHUpx7cZSRctCRaWNtd1iw4U6/exec';

// fresh = true -> skip the browser cache AND the server cache (Load button)
async function fetchJsonRetry(url, tries = 4, fresh = false) {
  let lastErr;
  const hit = fresh ? null : ReportCache.get(url);
  if (hit) return hit;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url + (fresh ? '&fresh=1' : '') + '&_r=' + Date.now());
      const json = JSON.parse(await res.text());
      ReportCache.set(url, json);
      return json;
    } catch (err) {
      lastErr = err;
      await new Promise(r => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw lastErr;
}

document.addEventListener('DOMContentLoaded', () => {
  const monthInput = document.getElementById('reportMonth');
  const repSelect = document.getElementById('reportRep');
  const loadBtn = document.getElementById('loadReportBtn');
  if (!monthInput) return;

  const $ = id => document.getElementById(id);
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const val = v => (v === '' || v == null) ? '<span class="rr-no">-</span>' : esc(v);
  const n = v => { const x = parseFloat(v); return isNaN(x) ? 0 : x; };
  const r2 = x => Math.round(x * 100) / 100;
  const f2 = x => r2(x).toFixed(2);
  const dmy = s => { const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? m[3] + '/' + m[2] + '/' + m[1] : s; };

  // Rework: sheet K = "Item" or "ItemA (10kg); ItemB (5kg)", J = total qty
  const LINE_RE = /^(.*) \(([\d.]+)kg\)$/;
  function reworkLines(r) {
    const t = String(r.itemToRework || '').trim();
    if (t) {
      const parts = t.split('; ').map(p => p.match(LINE_RE));
      if (parts.length > 1 && parts.every(Boolean)) return parts.map(m => ({ qty: m[2], item: m[1] }));
    }
    return null;   // single item: show J and K as they are
  }
  const stack = arr => arr.map(x => '<div class="rr-line">' + x + '</div>').join('');
  const reworkQtyCell = r => { const L = reworkLines(r); return L ? stack(L.map(l => esc(l.qty))) : val(r.rework); };
  const reworkItemCell = r => { const L = reworkLines(r); return L ? stack(L.map(l => esc(l.item))) : val(r.itemToRework); };

  let allRows = [];
  let forceFresh = false;   // set by the Load button

  const restored = ReportCache.restoreInput(monthInput, 'returnsreport');
  if (!monthInput.value) {
    const d = new Date();
    monthInput.value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }
  if (restored) setTimeout(loadReport, 0);

  loadBtn && loadBtn.addEventListener('click', () => { forceFresh = true; ReportCache.clear(); loadReport(); });
  monthInput.addEventListener('change', loadReport);
  repSelect.addEventListener('change', render);          // rep filter works on loaded data

  function fillReps() {
    const keep = repSelect.value;
    const reps = [];
    allRows.forEach(r => { if (r.rep && reps.indexOf(r.rep) === -1) reps.push(r.rep); });
    reps.sort((a, b) => a.localeCompare(b));
    repSelect.innerHTML = '<option value="">All Reps</option>' +
      reps.map(x => `<option value="${esc(x)}"${x === keep ? ' selected' : ''}>${esc(x)}</option>`).join('');
  }

  function render() {
    const rep = repSelect.value;
    const rows = rep ? allRows.filter(r => r.rep === rep) : allRows;

    const t = { qty: 0, cool: 0, rew: 0, rej: 0 };

    // sort so duplicates sit next to each other
    const list = rows.slice().sort((a, b) =>
      a.date.localeCompare(b.date) || a.rep.localeCompare(b.rep) || a.batchNo.localeCompare(b.batchNo));

    // rowspan for consecutive rows with the same key (first row = count, others = 0)
    function spans(keyFn) {
      const out = new Array(list.length).fill(0);
      let start = 0;
      for (let i = 1; i <= list.length; i++) {
        if (i === list.length || keyFn(list[i]) !== keyFn(list[start])) {
          out[start] = i - start;
          start = i;
        }
      }
      return out;
    }
    const grp = r => r.date + '|' + r.rep;
    const trk = r => grp(r) + '|' + r.truckNo;
    const spDate  = spans(r => r.date);
    const spRep   = spans(grp);
    const spTruck = spans(trk);
    const spBatch = spans(r => trk(r) + '|' + r.batchNo);
    const spVeh   = spans(r => trk(r) + '|' + r.vehicleTemp);
    const spMeat  = spans(r => trk(r) + '|' + r.meatTemp);

    const cell = (sp, i, html, cls) => sp[i] === 0 ? '' :
      '<td class="' + (cls || '') + '"' + (sp[i] > 1 ? ' rowspan="' + sp[i] + '"' : '') + '>' + html + '</td>';

    $('reportBody').innerHTML = list.map((r, i) => {
      const cool = n(r.coolRoom), rew = n(r.rework), rej = n(r.rejection), qty = n(r.qty);
      const bal = r2(qty - cool - rew - rej);
      t.qty += qty; t.cool += cool; t.rew += rew; t.rej += rej;
      return '<tr>' +
        cell(spDate, i, esc(dmy(r.date)), 'rr-date') +
        cell(spRep, i, val(r.rep), 'rr-left') +
        cell(spTruck, i, val(r.truckNo)) +
        cell(spBatch, i, val(r.batchNo)) +
        '<td>' + val(r.itemCode) + '</td>' +
        '<td class="rr-left">' + val(r.itemName) + '</td>' +
        '<td class="rr-num">' + val(r.qty) + '</td>' +
        cell(spVeh, i, val(r.vehicleTemp)) +
        cell(spMeat, i, val(r.meatTemp)) +
        '<td class="rr-num">' + val(r.coolRoom) + '</td>' +
        '<td class="rr-num">' + reworkQtyCell(r) + '</td>' +
        '<td class="rr-left">' + reworkItemCell(r) + '</td>' +
        '<td class="rr-num">' + val(r.rejection) + '</td>' +
        '<td class="rr-num ' + (bal === 0 ? 'rr-ok' : 'rr-bad') + '">' + f2(bal) + '</td>' +
        '</tr>';
    }).join('');

    const totBal = r2(t.qty - t.cool - t.rew - t.rej);
    $('reportFoot').innerHTML = '<tr><td colspan="6" class="rr-left">TOTAL</td>' +
      '<td class="rr-num">' + f2(t.qty) + '</td><td colspan="2"></td>' +
      '<td class="rr-num">' + f2(t.cool) + '</td><td class="rr-num">' + f2(t.rew) + '</td><td></td>' +
      '<td class="rr-num">' + f2(t.rej) + '</td><td class="rr-num">' + f2(totBal) + '</td></tr>';

    $('rptRep').textContent = rep || 'All';
    $('rptItems').textContent = rows.length;
    $('rptSummary').innerHTML =
      `<span>Total qty <b>${f2(t.qty)}</b> kg</span>` +
      `<span>Cool room <b>${f2(t.cool)}</b></span>` +
      `<span>Rework <b>${f2(t.rew)}</b></span>` +
      `<span>Rejection <b>${f2(t.rej)}</b></span>` +
      `<span>Balance <b class="${totBal === 0 ? 'ok' : 'bad'}">${f2(totBal)}</b></span>`;
  }
  async function loadReport() {
    const month = monthInput.value;
    if (!month) return;
    $('reportEmpty').style.display = 'none';
    $('reportSheet').style.display = 'none';
    $('reportLoading').style.display = 'flex';

    const fresh = forceFresh;
    forceFresh = false;

    try {
      const res = await fetchJsonRetry(API_URL_RETURNS_REPORT + '?action=getSalesReturnsReport&month=' + encodeURIComponent(month), 4, fresh);
      if (!res.success) throw new Error(res.error || 'Failed to load');

      allRows = res.rows || [];
      $('reportLoading').style.display = 'none';
      if (!allRows.length) {
        $('reportEmpty').innerHTML = '<p>No sales returns found for ' + esc(month) + '</p>';
        $('reportEmpty').style.display = '';
        return;
      }
      $('rptMonth').textContent = month;
      fillReps();
      render();
      $('reportSheet').style.display = '';
    } catch (err) {
      console.error('Sales returns report error:', err);
      $('reportLoading').style.display = 'none';
      $('reportEmpty').innerHTML = '<p>Failed to load report. Please try again.</p>';
      $('reportEmpty').style.display = '';
    }
  }
});
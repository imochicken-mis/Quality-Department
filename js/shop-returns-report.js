// ============================================
// SHOP RETURNS REPORT (monthly) - Admin
// "Returns 2" sheet, only rows where B = "Shop Return"
// Customer Code / Address come from the "Customer" sheet (matched by Cus Name)
// ============================================
const API_URL_SHOP_REPORT = 'https://script.google.com/macros/s/AKfycbxY0TPyoSAOTACaDzjOAwI4y3Fo5Movlx5G6hhROxNBHUpx7cZSRctCRaWNtd1iw4U6/exec';

async function fetchJsonRetry(url, tries = 4) {
  let lastErr;
  const hit = ReportCache.get(url);
  if (hit) return hit;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url + '&_r=' + Date.now());
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

  // "A; B" (several batches) -> one value per line, so each batch and its production date line up
  const splitList = v => String(v == null ? '' : v).split(';').map(s => s.trim()).filter(Boolean);
  const stackCell = (v, fmt) => {
    const list = splitList(v);
    if (!list.length) return val('');
    return list.map(x => '<div class="rr-line">' + esc(fmt ? fmt(x) : x) + '</div>').join('');
  };

  let allRows = [];

  const restored = ReportCache.restoreInput(monthInput, 'shopreturnsreport');
  if (!monthInput.value) {
    const d = new Date();
    monthInput.value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }
  if (restored) setTimeout(loadReport, 0);

  loadBtn && loadBtn.addEventListener('click', () => { ReportCache.clear(); loadReport(); });
  monthInput.addEventListener('change', loadReport);
  repSelect.addEventListener('change', render);

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

    const list = rows.slice().sort((a, b) =>
      a.date.localeCompare(b.date) || a.rep.localeCompare(b.rep) || a.customer.localeCompare(b.customer));

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
    const spDate = spans(r => r.date);
    const spRep = spans(grp);
    const spCus = spans(r => grp(r) + '|' + r.customer);

    const cell = (sp, i, html, cls) => sp[i] === 0 ? '' :
      '<td class="' + (cls || '') + '"' + (sp[i] > 1 ? ' rowspan="' + sp[i] + '"' : '') + '>' + html + '</td>';

    const t = { qty: 0, cool: 0, rew: 0, rej: 0 };
    $('reportBody').innerHTML = list.map((r, i) => {
      t.qty += n(r.qty); t.cool += n(r.coolRoom); t.rew += n(r.rework); t.rej += n(r.rejectQty);
      return '<tr>' +
        cell(spDate, i, esc(dmy(r.date)), 'rr-date') +
        cell(spRep, i, val(r.rep), 'rr-left') +
        cell(spCus, i, val(r.customerCode)) +
        cell(spCus, i, val(r.customer), 'rr-left') +
        cell(spCus, i, val(r.customerAddress), 'rr-wrap') +
        '<td class="rr-left">' + val(r.reason) + '</td>' +
        '<td class="rr-left">' + val(r.itemName) + '</td>' +
        '<td>' + stackCell(r.batchNo) + '</td>' +
        '<td>' + stackCell(r.productionDate, dmy) + '</td>' +
        '<td>' + val(dmy(r.loadingDate)) + '</td>' +
        '<td class="rr-num">' + val(r.qty) + '</td>' +
        '<td class="rr-num">' + val(r.coolRoom) + '</td>' +
        '<td class="rr-num">' + val(r.rework) + '</td>' +
        '<td class="rr-num">' + val(r.rejectQty) + '</td>' +
        '<td class="rr-left">' + val(r.condition) + '</td>' +
        '</tr>';
    }).join('');

    $('reportFoot').innerHTML = '<tr><td colspan="10" class="rr-left">TOTAL</td>' +
      '<td class="rr-num">' + f2(t.qty) + '</td>' +
      '<td class="rr-num">' + f2(t.cool) + '</td><td class="rr-num">' + f2(t.rew) + '</td>' +
      '<td class="rr-num">' + f2(t.rej) + '</td><td></td></tr>';

    $('rptRep').textContent = rep || 'All';
    $('rptItems').textContent = list.length;
    $('rptSummary').innerHTML =
      `<span>Total qty <b>${f2(t.qty)}</b> kg</span>` +
      `<span>Cool room <b>${f2(t.cool)}</b></span>` +
      `<span>Rework <b>${f2(t.rew)}</b></span>` +
      `<span>Reject <b>${f2(t.rej)}</b></span>`;
  }

  async function loadReport() {
    const month = monthInput.value;
    if (!month) return;
    $('reportEmpty').style.display = 'none';
    $('reportSheet').style.display = 'none';
    $('reportLoading').style.display = 'flex';

    try {
      const res = await fetchJsonRetry(API_URL_SHOP_REPORT + '?action=getShopReturnsReport&month=' + encodeURIComponent(month));
      if (!res.success) throw new Error(res.error || 'Failed to load');

      allRows = res.rows || [];
      $('reportLoading').style.display = 'none';
      if (!allRows.length) {
        $('reportEmpty').innerHTML = '<p>No shop returns found for ' + esc(month) + '</p>';
        $('reportEmpty').style.display = '';
        return;
      }
      $('rptMonth').textContent = month;
      fillReps();
      render();
      $('reportSheet').style.display = '';
    } catch (err) {
      console.error('Shop returns report error:', err);
      $('reportLoading').style.display = 'none';
      $('reportEmpty').innerHTML = '<p>Failed to load report. Please try again.</p>';
      $('reportEmpty').style.display = '';
    }
  }
});
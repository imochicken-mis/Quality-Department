// ============================================
// SALES RETURN SUMMARY (rep-wise totals) - Admin
// Uses the same data as the Sales Returns Report (getSalesReturnsReport)
// Filter: From Date - To Date (loads every month in the range)
// ============================================
const API_URL_RETURNS_SUMMARY = 'https://script.google.com/macros/s/AKfycbxY0TPyoSAOTACaDzjOAwI4y3Fo5Movlx5G6hhROxNBHUpx7cZSRctCRaWNtd1iw4U6/exec';

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
  const fromInput = document.getElementById('reportFrom');
  const toInput = document.getElementById('reportTo');
  const loadBtn = document.getElementById('loadReportBtn');
  if (!fromInput || !toInput) return;

  const $ = id => document.getElementById(id);
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const n = v => { const x = parseFloat(v); return isNaN(x) ? 0 : x; };
  const r2 = x => Math.round(x * 100) / 100;
  const f2 = x => (r2(x) === 0 ? '-' : r2(x).toFixed(2));   // 0 -> "-"

  let allRows = [];
    
  const restoredFrom = ReportCache.restoreInput(fromInput, 'returnssummaryFrom');
  const restoredTo = ReportCache.restoreInput(toInput, 'returnssummaryTo');
  const pad = x => String(x).padStart(2, '0');
  const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  if (!fromInput.value || !toInput.value) {
    const d = new Date();
    fromInput.value = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-01';   // 1st of this month
    toInput.value = ymd(d);                                                      // today
  }
  if (restoredFrom || restoredTo) setTimeout(loadReport, 0);

  loadBtn && loadBtn.addEventListener('click', () => { ReportCache.clear(); loadReport(); });
  fromInput.addEventListener('change', loadReport);
  toInput.addEventListener('change', loadReport);

  const dmy = s => String(s).split('-').reverse().join('-');   // yyyy-mm-dd -> dd-mm-yyyy

  function render() {
    const byRep = {};
    allRows.forEach(r => {
      const k = r.rep || '-';
      const o = byRep[k] || (byRep[k] = { qty: 0, cool: 0, rew: 0, rej: 0 });
      o.qty += n(r.qty); o.cool += n(r.coolRoom); o.rew += n(r.rework); o.rej += n(r.rejection);
    });

    const reps = Object.keys(byRep).sort((a, b) => a.localeCompare(b));
    const t = { qty: 0, cool: 0, rew: 0, rej: 0 };

    $('summaryBody').innerHTML = reps.length ? reps.map(k => {
      const o = byRep[k];
      t.qty += o.qty; t.cool += o.cool; t.rew += o.rew; t.rej += o.rej;
      return '<tr><td class="rr-left">' + esc(k) + '</td>' +
        '<td class="rr-num">' + f2(o.qty) + '</td>' +
        '<td class="rr-num">' + f2(o.cool) + '</td>' +
        '<td class="rr-num">' + f2(o.rew) + '</td>' +
        '<td class="rr-num">' + f2(o.rej) + '</td></tr>';
    }).join('') : '<tr><td colspan="5" class="rr-no">No returns in this period</td></tr>';

    $('summaryFoot').innerHTML = reps.length
      ? '<tr><td class="rr-left">TOTAL</td><td class="rr-num">' + f2(t.qty) + '</td>' +
        '<td class="rr-num">' + f2(t.cool) + '</td><td class="rr-num">' + f2(t.rew) + '</td>' +
        '<td class="rr-num">' + f2(t.rej) + '</td></tr>'
      : '';

    $('rptFrom').textContent = dmy(fromInput.value);
    $('rptTo').textContent = dmy(toInput.value);
    $('rptReps').textContent = reps.length;
  }

  async function loadReport() {
    const from = fromInput.value, to = toInput.value;
    if (!from || !to) return;
    if (from > to) {
      $('reportSheet').style.display = 'none';
      $('reportLoading').style.display = 'none';
      $('reportEmpty').innerHTML = '<p>From Date must be before or the same as To Date</p>';
      $('reportEmpty').style.display = '';
      return;
    }
    $('reportEmpty').style.display = 'none';
    $('reportSheet').style.display = 'none';
    $('reportLoading').style.display = 'flex';

    try {
      // The API works per month: load every month in the range, then keep only the chosen dates
      const months = [];
      let y = +from.slice(0, 4), m = +from.slice(5, 7);
      const lastKey = to.slice(0, 7);
      while (y + '-' + pad(m) <= lastKey && months.length < 36) {
        months.push(y + '-' + pad(m));
        if (++m > 12) { m = 1; y++; }
      }
      const results = await Promise.all(months.map(mo =>
        fetchJsonRetry(API_URL_RETURNS_SUMMARY + '?action=getSalesReturnsReport&month=' + encodeURIComponent(mo))));
      results.forEach(res => { if (!res.success) throw new Error(res.error || 'Failed to load'); });

      allRows = results.reduce((all, res) => all.concat(res.rows || []), [])
        .filter(r => r.date >= from && r.date <= to);
      $('reportLoading').style.display = 'none';
      if (!allRows.length) {
        $('reportEmpty').innerHTML = '<p>No sales returns found from ' + esc(dmy(from)) + ' to ' + esc(dmy(to)) + '</p>';
        $('reportEmpty').style.display = '';
        return;
      }
      render();
      $('reportSheet').style.display = '';
    } catch (err) {
      console.error('Return summary error:', err);
      $('reportLoading').style.display = 'none';
      $('reportEmpty').innerHTML = '<p>Failed to load report. Please try again.</p>';
      $('reportEmpty').style.display = '';
    }
  }
});
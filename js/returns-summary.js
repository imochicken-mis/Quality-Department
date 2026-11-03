// ============================================
// RETURN SUMMARY (rep-wise totals) - Admin
// Uses the same data as the Sales Returns Report (getSalesReturnsReport)
// Period: Full Month / Week 1-4 (29-31 count as Week 4)
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
  const monthInput = document.getElementById('reportMonth');
  const weekSelect = document.getElementById('summaryWeek');
  const loadBtn = document.getElementById('loadReportBtn');
  if (!monthInput) return;

  const $ = id => document.getElementById(id);
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const n = v => { const x = parseFloat(v); return isNaN(x) ? 0 : x; };
  const r2 = x => Math.round(x * 100) / 100;
  const f2 = x => (r2(x) === 0 ? '-' : r2(x).toFixed(2));   // 0 -> "-"

  let allRows = [];
    
  const restored = ReportCache.restoreInput(monthInput, 'returnssummary');
  if (!monthInput.value) {
    const d = new Date();
    monthInput.value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }
  if (restored) setTimeout(loadReport, 0);

  loadBtn && loadBtn.addEventListener('click', () => { ReportCache.clear(); loadReport(); });
  monthInput.addEventListener('change', loadReport);
  weekSelect.addEventListener('change', render);        // period works on loaded data

  function render() {
    const wk = weekSelect.value;
    const inPeriod = r => {
      if (wk === 'all') return true;
      const day = parseInt(String(r.date).slice(8, 10), 10);   // yyyy-mm-dd -> dd
      return Math.min(4, Math.ceil(day / 7)) === +wk;          // 29-31 -> week 4
    };

    const byRep = {};
    allRows.filter(inPeriod).forEach(r => {
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

    $('rptPeriod').textContent = weekSelect.options[weekSelect.selectedIndex].text;
    $('rptReps').textContent = reps.length;
  }

  async function loadReport() {
    const month = monthInput.value;
    if (!month) return;
    $('reportEmpty').style.display = 'none';
    $('reportSheet').style.display = 'none';
    $('reportLoading').style.display = 'flex';

    try {
      const res = await fetchJsonRetry(API_URL_RETURNS_SUMMARY + '?action=getSalesReturnsReport&month=' + encodeURIComponent(month));
      if (!res.success) throw new Error(res.error || 'Failed to load');

      allRows = res.rows || [];
      $('reportLoading').style.display = 'none';
      if (!allRows.length) {
        $('reportEmpty').innerHTML = '<p>No sales returns found for ' + esc(month) + '</p>';
        $('reportEmpty').style.display = '';
        return;
      }
      $('rptMonth').textContent = month;
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
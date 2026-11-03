const API_URL_SAMPLE_REPORT = 'https://script.google.com/macros/s/AKfycbxY0TPyoSAOTACaDzjOAwI4y3Fo5Movlx5G6hhROxNBHUpx7cZSRctCRaWNtd1iw4U6/exec';

document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const detailTab = $('detailTab');
  const summaryTab = $('summaryTab');
  const detailPanel = $('detailPanel');
  const summaryPanel = $('summaryPanel');
  const detailMonth = $('sampleReportMonth');
  const fromMonth = $('sampleFromMonth');
  const toMonth = $('sampleToMonth');
  const loading = $('sampleReportLoading');
  let activeView = 'detail';
  if (!detailMonth || !fromMonth || !toMonth) return;

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  detailMonth.value = currentMonth;
  fromMonth.value = currentMonth;
  toMonth.value = currentMonth;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const number = value => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  function setTab(view) {
    activeView = view;
    const detailActive = view === 'detail';
    detailTab.classList.toggle('active', detailActive);
    summaryTab.classList.toggle('active', !detailActive);
    detailTab.setAttribute('aria-selected', String(detailActive));
    summaryTab.setAttribute('aria-selected', String(!detailActive));
    detailPanel.hidden = !detailActive;
    summaryPanel.hidden = detailActive;
    $('sampleDetailEmpty').style.display = detailActive ? 'flex' : 'none';
    $('sampleDetailTableWrap').style.display = 'none';
    $('sampleSummaryEmpty').style.display = detailActive ? 'none' : 'flex';
    $('sampleSummaryTableWrap').style.display = 'none';
    loading.style.display = 'none';
  }

  function showEmpty(view, text) {
    const empty = $(view === 'detail' ? 'sampleDetailEmpty' : 'sampleSummaryEmpty');
    const table = $(view === 'detail' ? 'sampleDetailTableWrap' : 'sampleSummaryTableWrap');
    empty.querySelector('p').textContent = text;
    empty.style.display = 'flex';
    table.style.display = 'none';
  }

  function renderDetail(rows) {
    if (!rows.length) return showEmpty('detail', 'No Sample records found for this month.');
    $('sampleDetailBody').innerHTML = rows.map(row => `
      <tr><td>${esc(row.criteria)}</td><td>${esc(row.tested)}</td><td>${esc(row.compliant)}</td><td>${esc(row.nonCompliant)}</td></tr>
    `).join('');
    $('sampleDetailGrandTested').textContent = rows.reduce((sum, row) => sum + number(row.tested), 0);
    $('sampleDetailGrandCompliant').textContent = rows.reduce((sum, row) => sum + number(row.compliant), 0);
    $('sampleDetailGrandNonCompliant').textContent = rows.reduce((sum, row) => sum + number(row.nonCompliant), 0);
    $('sampleDetailEmpty').style.display = 'none';
    $('sampleDetailTableWrap').style.display = '';
  }

function renderSummary(rows, from, to) {
  if (!rows.length) {
    return showEmpty('summary', 'No Sample records found for this month range.');
  }

  const totals = new Map();
  const [startYear, startMonth] = from.split('-').map(Number);
  const [endYear, endMonth] = to.split('-').map(Number);

  for (
    let date = new Date(startYear, startMonth - 1, 1);
    date <= new Date(endYear, endMonth - 1, 1);
    date = new Date(date.getFullYear(), date.getMonth() + 1, 1)
  ) {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    totals.set(key, { tested: 0, compliant: 0, nonCompliant: 0 });
  }

  rows.forEach(row => {
    const month = String(row.month || '').trim();
    if (!totals.has(month)) return;

    const item = totals.get(month);
    item.tested += number(row.tested);
    item.compliant += number(row.compliant);
    item.nonCompliant += number(row.nonCompliant);
  });

  let grandTested = 0;
  let grandCompliant = 0;
  let grandNonCompliant = 0;

  $('sampleSummaryBody').innerHTML = [...totals.entries()].map(([month, values]) => {
    grandTested += values.tested;
    grandCompliant += values.compliant;
    grandNonCompliant += values.nonCompliant;

    const [year, monthNumber] = month.split('-').map(Number);
    const monthName = new Intl.DateTimeFormat('en', {
      month: 'long',
      year: 'numeric'
    }).format(new Date(year, monthNumber - 1, 1));

    return `<tr><td>${esc(monthName)}</td><td>${values.tested}</td><td>${values.compliant}</td><td>${values.nonCompliant}</td></tr>`;
  }).join('');

  $('sampleGrandTested').textContent = grandTested;
  $('sampleGrandCompliant').textContent = grandCompliant;
  $('sampleGrandNonCompliant').textContent = grandNonCompliant;
  $('sampleSummaryEmpty').style.display = 'none';
  $('sampleSummaryTableWrap').style.display = '';
}

  async function loadReport(view) {
    const button = $(view === 'detail' ? 'loadSampleReportBtn' : 'loadSampleSummaryBtn');
    const from = view === 'detail' ? detailMonth.value : fromMonth.value;
    const to = view === 'detail' ? detailMonth.value : toMonth.value;
    if (!from || !to) return showEmpty(view, 'Select the month field(s) first.');
    if (from > to) return showEmpty(view, 'From Month must be before or the same as To Month.');

    const originalText = button.innerHTML;
    button.disabled = true;
    button.textContent = 'Loading...';
    $('sampleDetailEmpty').style.display = 'none';
    $('sampleSummaryEmpty').style.display = 'none';
    $('sampleDetailTableWrap').style.display = 'none';
    $('sampleSummaryTableWrap').style.display = 'none';
    loading.style.display = 'flex';
    try {
      const params = new URLSearchParams({ action: 'getSampleParametersReport', fromMonth: from, toMonth: to });
      const response = await fetch(`${API_URL_SAMPLE_REPORT}?${params}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Could not load report.');
      const rows = result.rows || [];
      if (view === 'detail') renderDetail(rows);
      else renderSummary(rows, from, to);
    } catch (error) {
      showEmpty(view, error.message || 'Failed to load report.');
    } finally {
      loading.style.display = 'none';
      button.disabled = false;
      button.innerHTML = originalText;
    }
  }

  detailTab.addEventListener('click', () => setTab('detail'));
  summaryTab.addEventListener('click', () => setTab('summary'));
  $('loadSampleReportBtn').addEventListener('click', () => loadReport('detail'));
  $('loadSampleSummaryBtn').addEventListener('click', () => loadReport('summary'));
  setTab('detail');
});

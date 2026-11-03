const API_URL_KPI = 'https://script.google.com/macros/s/AKfycbxY0TPyoSAOTACaDzjOAwI4y3Fo5Movlx5G6hhROxNBHUpx7cZSRctCRaWNtd1iw4U6/exec';
const KPI1_TARGET = 95;

document.addEventListener('DOMContentLoaded', () => {
  const month = document.getElementById('kpi1Month');
  const rate = document.getElementById('kpi1Rate');
  const variance = document.getElementById('kpi1Variance');
  const status = document.getElementById('kpi1Status');
  const progress = document.getElementById('kpi1Progress');
  const actualLabel = document.getElementById('kpi1ActualLabel');
  const actualMarker = document.getElementById('kpi1ActualMarker');
  const criteriaList = document.getElementById('kpi1Criteria');
  const trendYear = document.getElementById('kpi1TrendYear');
  const monthlyChart = document.getElementById('kpi1MonthlyChart');

  if (!month || !rate) return;

  // Each KPI page keeps its own last month for this browser tab (sessionStorage)
  const MONTH_KEY = 'kpiMonth:kpi1';
  const savedMonth = (() => { try { return sessionStorage.getItem(MONTH_KEY) || ''; } catch (_) { return ''; } })();
  const saveMonth = (value) => { try { sessionStorage.setItem(MONTH_KEY, value); } catch (_) { /* storage blocked: skip */ } };
  const now = new Date();
  month.value = /^\d{4}-\d{2}$/.test(savedMonth) ? savedMonth : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  function fillTrendYears() {
    if (!trendYear) return;
    const selectedYear = Number(month.value.slice(0, 4)) || new Date().getFullYear();
    trendYear.replaceChildren();
    for (let year = selectedYear; year >= selectedYear - 5; year--) {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      trendYear.appendChild(option);
    }
    trendYear.value = String(selectedYear);
  }

  // Same layout as the criteria table: months across the top, the figures listed down the side
  function renderMonthlyTable(rows) {
    const container = document.getElementById('kpi1MonthlyTable');
    if (!container) return;
    container.replaceChildren();
    const table = document.createElement('table');
    table.className = 'kpi-criteria-table';
    const headRow = table.createTHead().insertRow();
    headRow.appendChild(document.createElement('th'));
    rows.forEach((row) => {
      const th = document.createElement('th');
      th.textContent = row.label;
      headRow.appendChild(th);
    });
    const figures = [
      ['Total samples', (row) => row.tested > 0 ? row.tested : '-'],
      ['Compliance', (row) => row.tested > 0 ? row.compliance : '-'],
      ['Non-compliance', (row) => row.tested > 0 ? Math.max(0, row.tested - row.compliance) : '-'],
      ['KPI (%)', (row) => Number.isFinite(row.value) ? row.value.toFixed(2) + '%' : '-']
    ];
    const body = table.createTBody();
    figures.forEach(([label, valueOf]) => {
      const tr = body.insertRow();
      const th = document.createElement('th');
      th.textContent = label;
      tr.appendChild(th);
      rows.forEach((row) => {
        const cell = tr.insertCell();
        cell.textContent = valueOf(row);
        if (label === 'KPI (%)' && Number.isFinite(row.value)) {
          cell.className = row.value >= KPI1_TARGET ? 'is-achieved' : 'is-below-target';
        }
      });
    });
    const wrap = document.createElement('div');
    wrap.className = 'kpi-criteria-table-wrap';
    wrap.appendChild(table);
    container.appendChild(wrap);
    container.hidden = false;
  }

  function renderMonthlyTrend(rows) {
    renderMonthlyTable(rows);
    if (!monthlyChart) return;
    // Same line chart as the other KPI pages: drawn at the box's real width, so the text keeps its size
    KpiTrend.mount({
      chart: monthlyChart,
      table: null,
      rows: rows.map((row) => ({ label: row.label, title: row.label, value: row.value, tested: row.tested, compliance: row.compliance })),
      target: KPI1_TARGET,
      better: 'higher',
      decimals: 2,
      standardLabel: 'Standard 95%',
      cornerLabel: 'Month',
      kpiLabel: 'Compliance (%)',
      details: [
        { label: 'Total samples', get: (r) => r.tested, color: '#60a5fa' },
        { label: 'Compliant', get: (r) => r.compliance, color: '#22a06b' },
        { label: 'Non-compliant', get: (r) => Math.max(0, (r.tested || 0) - (r.compliance || 0)), color: '#e5484d' }
      ]
    });
  }

  async function loadMonthlyTrend(year) {
    if (!year || !monthlyChart) return;
    const labelOf = (monthNo) => new Date(year, monthNo - 1, 1).toLocaleDateString('en-US', {month:'short'});
    // Draw the empty grid straight away, then fill it in once all twelve months have arrived
    renderMonthlyTrend(Array.from({length: 12}, (_, i) => ({index: i, label: labelOf(i + 1), value: null})));
    const rows = await Promise.all(Array.from({length: 12}, async (_, i) => {
      const monthNo = i + 1;
      const key = String(year) + '-' + String(monthNo).padStart(2, '0');
      let value = null;
      let totals = {tested: 0, compliance: 0};
      try {
        const response = await fetch(API_URL_KPI + '?action=getKpi1&month=' + key + '&_r=' + Date.now(), {cache:'no-store'});
        const data = await response.json();
        const parsed = Number(String(data.kpi || '').replace('%', '').trim());
        value = Number.isFinite(parsed) ? parsed : null;
        totals = {tested: Number(data.totalTested) || 0, compliance: Number(data.totalCompliance) || 0};
      } catch (_) {
        value = null;
      }
      return {index: i, label: labelOf(monthNo), value, ...totals};
    }));
    renderMonthlyTrend(rows);
  }

  fillTrendYears();
  if (monthlyChart) monthlyChart.hidden = true;
  month.addEventListener('change', () => { saveMonth(month.value); fillTrendYears(); loadKpi1(); });
  trendYear?.addEventListener('change', () => loadMonthlyTrend(Number(trendYear.value)));
  loadKpi1();
  function renderCriteria(items) {
    if (!criteriaList) return;
    criteriaList.replaceChildren();
    if (!Array.isArray(items) || !items.length) {
      criteriaList.textContent = 'No criteria data for this month';
      return;
    }
    // Column height is scaled to the criteria with the most samples; green = compliant, red = non-compliant
    const plotHeight = 200;
    const maxTested = Math.max(...items.map((item) => Number(item.tested) || 0), 1);
    // One glass card follows the cursor over whichever column is hovered
    let tip = document.getElementById('kpiColTip');
    if (!tip) {
      tip = document.createElement('div');
      tip.id = 'kpiColTip';
      tip.className = 'kpi-col-tip';
      document.body.appendChild(tip);
    }
    const tipRow = (label, value, color) => {
      const row = document.createElement('div');
      row.className = 'kpi-col-tip-row';
      if (color) {
        const dot = document.createElement('i');
        dot.style.background = color;
        row.appendChild(dot);
      }
      const text = document.createElement('span');
      text.textContent = label;
      const number = document.createElement('b');
      number.textContent = value;
      row.append(text, number);
      return row;
    };

    const chart = document.createElement('div');
    chart.className = 'kpi-col-chart';
    items.forEach((item) => {
      const tested = Number(item.tested) || 0;
      const compliance = Number(item.compliance) || 0;
      const nonCompliance = Math.max(0, tested - compliance);
      const rate = Number(item.rate) || 0;

      const column = document.createElement('div');
      column.className = 'kpi-col';
      const bar = document.createElement('div');
      bar.className = 'kpi-col-bar';
      const stack = document.createElement('div');
      stack.className = 'kpi-col-stack';
      stack.style.height = (tested / maxTested * plotHeight) + 'px';
      const red = document.createElement('div');
      red.className = 'kpi-col-red';
      red.style.height = (tested ? nonCompliance / tested * 100 : 0) + '%';
      const green = document.createElement('div');
      green.className = 'kpi-col-green';
      green.style.height = (tested ? compliance / tested * 100 : 0) + '%';
      stack.append(red, green);
      bar.append(stack);
      const name = document.createElement('span');
      name.className = 'kpi-col-name';
      name.textContent = item.name;
      column.append(bar, name);
      column.addEventListener('mouseenter', () => {
        const head = document.createElement('div');
        head.className = 'kpi-col-tip-title';
        head.textContent = item.name;
        tip.replaceChildren(
          head,
          tipRow('Compliant', compliance, '#22a06b'),
          tipRow('Non-compliant', nonCompliance, '#e5484d'),
          tipRow('Total samples', tested),
          tipRow('Compliance rate', rate.toFixed(2) + '%')
        );
        tip.classList.add('is-visible');
      });
      column.addEventListener('mousemove', (event) => {
        const fitsRight = event.clientX + 16 + 210 < window.innerWidth;
        tip.style.left = (fitsRight ? event.clientX + 16 : event.clientX - 226) + 'px';
        tip.style.top = (event.clientY + 16) + 'px';
      });
      column.addEventListener('mouseleave', () => tip.classList.remove('is-visible'));
      chart.appendChild(column);
    });

    const legend = document.createElement('div');
    legend.className = 'kpi-col-legend';
    legend.innerHTML = '<span><i class="is-green"></i>Compliant</span><span><i class="is-red"></i>Non-compliant</span>';
    // Summary table: criteria names across the top, figures listed down the side
    const table = document.createElement('table');
    table.className = 'kpi-criteria-table';
    const headRow = table.createTHead().insertRow();
    headRow.appendChild(document.createElement('th'));
    items.forEach((item) => {
      const th = document.createElement('th');
      th.textContent = item.name;
      headRow.appendChild(th);
    });
    const figures = [
      ['Total samples', (item) => Number(item.tested) > 0 ? Number(item.tested) : '-'],
      ['Compliance', (item) => Number(item.tested) > 0 ? (Number(item.compliance) || 0) : '-'],
      ['Non-compliance', (item) => Number(item.tested) > 0 ? Math.max(0, Number(item.tested) - (Number(item.compliance) || 0)) : '-'],
      ['KPI (%)', (item) => Number(item.tested) > 0 ? (Number(item.rate) || 0).toFixed(2) + '%' : '-']
    ];
    const body = table.createTBody();
    figures.forEach(([label, valueOf]) => {
      const row = body.insertRow();
      const th = document.createElement('th');
      th.textContent = label;
      row.appendChild(th);
      items.forEach((item) => {
        const cell = row.insertCell();
        cell.textContent = valueOf(item);
        if (label === 'KPI (%)' && Number(item.tested) > 0) {
          cell.className = (Number(item.rate) || 0) >= KPI1_TARGET ? 'is-achieved' : 'is-below-target';
        }
      });
    });
    const tableWrap = document.createElement('div');
    tableWrap.className = 'kpi-criteria-table-wrap';
    tableWrap.appendChild(table);

    criteriaList.append(chart, legend, tableWrap);
  }


  async function loadKpi1() {
    if (!month.value) return;
    rate.textContent = '…';
    document.querySelectorAll('.kpi-summary-card').forEach((c) => c.classList.add('kpi-loading'));
    if (variance) variance.textContent = '…';
    if (status) status.textContent = '…';
    try {
      const response = await fetch(`${API_URL_KPI}?action=getKpi1&month=${encodeURIComponent(month.value)}&_r=${Date.now()}`, { cache: 'no-store' });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'KPI data unavailable');
      const raw = String(data.kpi || '').replace('%', '').trim();
      const value = Number(raw);
      const valid = Number.isFinite(value);
      const achieved = valid && value > KPI1_TARGET;
      rate.textContent = valid ? value.toFixed(2) + '%' : (data.kpi || '-');
      const numEl = document.getElementById('kpi1Num'); const denEl = document.getElementById('kpi1Den'); const resEl = document.getElementById('kpi1Result');
      if (numEl) numEl.textContent = data.totalCompliance || '-';
      if (denEl) denEl.textContent = data.totalTested || '-';
      if (resEl) resEl.textContent = valid ? value.toFixed(2) + '%' : '-';
      if (variance) {
        const delta = value - KPI1_TARGET;
        variance.textContent = valid ? (delta >= 0 ? '+' : '') + delta.toFixed(2) + '%' : '-';
      }
      if (status) status.textContent = achieved ? 'Achieved' : valid ? 'Not Achieved' : '-';
      const pct = valid ? Math.max(0, Math.min(100, value)) : 0;
      if (progress) { progress.style.width = pct + '%'; progress.style.backgroundSize = pct > 0 ? (10000 / pct) + '% 100%' : '100% 100%'; }
      if (actualLabel) actualLabel.textContent = valid ? value.toFixed(1) + '% (Actual)' : '- (Actual)';
      if (actualMarker) actualMarker.style.left = pct + '%';
      renderCriteria(data.criteria);

monthlyChart.hidden = false;
loadMonthlyTrend(Number(month.value.slice(0, 4)));
      document.querySelector('.kpi-value-card')?.classList.toggle('is-achieved', achieved);
      document.querySelector('.kpi-value-card')?.classList.toggle('is-below-target', valid && !achieved);
      if (variance && valid) { const d = value - KPI1_TARGET; document.querySelector('.kpi-variance-card')?.classList.toggle('is-achieved', d > 0); document.querySelector('.kpi-variance-card')?.classList.toggle('is-below-target', d <= 0); }
      document.querySelector('.kpi-status-card')?.classList.toggle('is-achieved', achieved);
      document.querySelector('.kpi-status-card')?.classList.toggle('is-below-target', valid && !achieved);
      document.querySelectorAll('.kpi-summary-card').forEach((c) => c.classList.remove('kpi-loading'));
    } catch (error) {
      console.error('KPI 01 load error:', error);
      document.querySelectorAll('.kpi-summary-card').forEach((c) => c.classList.remove('kpi-loading'));
      rate.textContent = '-';
      if (variance) variance.textContent = '-';
      ['kpi1Num', 'kpi1Den', 'kpi1Result'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.textContent = '-';
      });
      if (status) status.textContent = '-';
      if (progress) progress.style.width = '0%';
      if (actualLabel) actualLabel.textContent = '- (Actual)';
      if (criteriaList) criteriaList.replaceChildren();
if (monthlyChart) {
  monthlyChart.hidden = true;
  monthlyChart.replaceChildren();
  const monthlyTable = document.getElementById('kpi1MonthlyTable');
  if (monthlyTable) { monthlyTable.hidden = true; monthlyTable.replaceChildren(); }
}
    }
  }
});



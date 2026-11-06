// Internal Non Conformance report: loads one month from the Apps Script and fills the shared report table
const API_URL_INC_REPORT = 'https://script.google.com/macros/s/AKfycbxY0TPyoSAOTACaDzjOAwI4y3Fo5Movlx5G6hhROxNBHUpx7cZSRctCRaWNtd1iw4U6/exec';

document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const monthInput = $('reportMonth');
  const loadBtn = $('loadReportBtn');
  const empty = $('reportEmpty');
  const loading = $('reportLoading');
  const sheet = $('reportSheet');
  const headRow = document.querySelector('.report-table thead');
  const bodyRows = document.querySelector('.report-table tbody');

  const now = new Date();
  monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  function showMessage(text) {
    sheet.style.display = 'none';
    loading.style.display = 'none';
    empty.textContent = text;
    empty.style.display = '';
  }

  async function loadReport() {
    if (!monthInput.value) return;
    empty.style.display = 'none';
    sheet.style.display = 'none';
    loading.style.display = '';
    try {
      const url = `${API_URL_INC_REPORT}?action=getINCReport&month=${encodeURIComponent(monthInput.value)}&_r=${Date.now()}`;
      const response = await fetch(url, { cache: 'no-store' });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Report unavailable');

      // Remove every column after "Backwash Clarifier" (header and values together)
      const clarifierAt = (data.headers || []).findIndex(h => /backwash clarifier/i.test(String(h)));
      const keep = index => clarifierAt < 0 || index <= clarifierAt;
      const rows = (data.rows || []).map(row => row.filter((_, i) => keep(i)));
      const incHeaders = (data.headers || []).filter((_, i) => keep(i));
      const envCount = incHeaders.length - 12; // Date + 9 food + 2 operational come before the environmental columns

headRow.innerHTML = `
  <tr class="inc-group-row">
    <th rowspan="2">${escapeHtml(incHeaders[0] || 'Date')}</th>
    <th colspan="9">Food Safety &amp; Quality Control Criteria</th>
    <th colspan="2">Operational &amp; GMP Control Criteria</th>
    <th colspan="${envCount}">Environmental &amp; Utility Control Criteria (ETP / Waste Water)</th>
  </tr>
  <tr>
    ${incHeaders.slice(1).map(h => `<th>${escapeHtml(h)}</th>`).join('')}
  </tr>
`;
      bodyRows.innerHTML = rows.map(row => `<tr>${row.map(v => `<td>${escapeHtml(v)}</td>`).join('')}</tr>`).join('');
      // Data columns get 90px; the two Operational & GMP columns (index 10 and 11) get 50px
      document.querySelectorAll('.report-table tr:not(.inc-group-row)').forEach(row => {
        [...row.children].forEach((cell, index) => {
          if (index === 0) return;
          const narrow = index === 10 || index === 11;
          const width = narrow ? '50px' : '90px';
          cell.style.width = width;
          cell.style.minWidth = width;
          cell.style.maxWidth = width;
          // Narrow columns: long words break inside the cell so the column can really be 50px wide
          if (narrow) {
            cell.style.overflowWrap = 'anywhere';
            cell.style.whiteSpace = 'normal';
            cell.style.padding = '4px 2px';
          }
        });
      });
      $('rptMonth').textContent = monthInput.value;
      $('rptCount').textContent = rows.length;

      loading.style.display = 'none';
      sheet.style.display = '';
    } catch (error) {
      showMessage(error.message || 'Unable to load report');
    }
  }

  loadBtn.addEventListener('click', loadReport);
  monthInput.addEventListener('change', loadReport);
  loadReport();
});

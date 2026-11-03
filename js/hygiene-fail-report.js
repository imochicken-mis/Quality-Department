const API_URL_HYGIENE =
  'https://script.google.com/macros/s/AKfycbxY0TPyoSAOTACaDzjOAwI4y3Fo5Movlx5G6hhROxNBHUpx7cZSRctCRaWNtd1iw4U6/exec';

document.addEventListener('DOMContentLoaded', () => {
  const dateInput = document.getElementById('reportDate');
  const today = new Date();
  const todayLocal =
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  if (dateInput && !dateInput.value) {
    dateInput.value = todayLocal;
  }
  const divisionInput = document.getElementById('reportDivision');
  const loadBtn = document.getElementById('loadReportBtn');
  const body = document.getElementById('reportBody');
  const empty = document.getElementById('reportEmpty');
  const loading = document.getElementById('reportLoading');
  const sheet = document.getElementById('reportSheet');
  const tableWrap =
    document.getElementById('hygieneTableWrap') ||
    document.querySelector('.mr-table-wrap');

  if (!dateInput || !divisionInput || !loadBtn || !body) {
    console.error('Hygiene report: required HTML element is missing.');
    return;
  }

  const criteria = [
    'Uniform Cleanliness',
    'Apron',
    'Boots',
    'Gloves',
    'Masks',
    'T Shirts',
    'Trousers',
    'Head Cover',
    'Shortly cut nails',
    'No jewelries',
    'Open wound',
    'Disease symptoms'
  ];

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));

  function hideReport() {
    if (sheet) sheet.style.display = 'none';
    if (tableWrap) tableWrap.style.display = 'none';
  }

  function setMessage(message) {
    hideReport();

    if (empty) {
      empty.innerHTML = `<p>${esc(message)}</p>`;
      empty.style.display = '';
    }
  }

  function isFailed(value) {
    return value === true ||
      String(value ?? '').trim().toLowerCase() === 'out';
  }

  function hasFailedCriterion(row, criterion, index) {
    if (Array.isArray(row)) {
      return isFailed(row[index + 5]);
    }

    if (Array.isArray(row.failedCriteria)) {
      return row.failedCriteria.includes(criterion);
    }

    const values = row.criteria;

    if (Array.isArray(values)) {
      return isFailed(values[index]);
    }

    if (values && typeof values === 'object') {
      return isFailed(values[criterion]);
    }

    return isFailed(row[criterion]);
  }

  function renderRows(rows) {
    body.innerHTML = rows.map(row => {
      const name = Array.isArray(row)
        ? row[4]
        : row.name ??
          row.employeeName ??
          row.employeeId ??
          row.employeeNameId ??
          '';

      const status = Array.isArray(row)
        ? row[3]
        : row.status ?? '';

      const criteriaCells = criteria.map((criterion, index) => {
      const mark = hasFailedCriterion(row, criterion, index)
        ? '<span class="hygiene-out-badge">out</span>'
        : '';                                                              
      return `<td class="hygiene-mark">${mark}</td>`;
      }).join('');

      return `
        <tr>
          <td>${esc(name)}</td>
          <td>${esc(status)}</td>
          ${criteriaCells}
        </tr>
      `;
    }).join('');
  }

  document.querySelector('.report-title-row')
    ?.style.setProperty('display', 'none');

  setMessage('Select a date and division above to generate the report.');

  async function loadReport() {
    const date = dateInput.value;
    const division = divisionInput.value;

    if (!date || !division) {
      setMessage('Select a date and division first.');
      return;
    }

    const spinnerStartedAt = Date.now();

    if (empty) empty.style.display = 'none';
    hideReport();
    if (loading) loading.style.display = 'flex';

    try {
      const url = new URL(API_URL_HYGIENE);
      url.searchParams.set('action', 'getHygieneFailReport');
      url.searchParams.set('date', date);
      url.searchParams.set('division', division);

      const response = await fetch(url.toString());
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Could not load report.');
      }

      const rows = result.rows || [];
      body.innerHTML = '';

      if (!rows.length) {
        setMessage('No hygiene fail records found for this date and division.');
        return;
      }

      renderRows(rows);

      if (empty) empty.style.display = 'none';
      if (sheet) sheet.style.display = '';
      if (tableWrap) tableWrap.style.display = 'block';
    } catch (error) {
      console.error('Hygiene fail report error:', error);
      setMessage(error.message || 'Failed to load report. Please try again.');
    } finally {
      const wait = Math.max(0, 600 - (Date.now() - spinnerStartedAt));

      if (wait) {
        await new Promise(resolve => setTimeout(resolve, wait));
      }

      if (loading) loading.style.display = 'none';
    }
  }

  loadBtn.addEventListener('click', loadReport);
});
const API_URL_COMPLAINT_REPORT =
  'https://script.google.com/macros/s/AKfycbxY0TPyoSAOTACaDzjOAwI4y3Fo5Movlx5G6hhROxNBHUpx7cZSRctCRaWNtd1iw4U6/exec';

document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const fromDate = $('fromDate');
  const toDate = $('toDate');
  const loadButton = $('loadReportBtn');
  const loading = $('reportLoading');
  const empty = $('reportEmpty');
  const tableWrap = $('reportTableWrap');
  const body = $('reportBody');
  const categoryFilter = $('complaintCategoryFilter');
  let reportRows = [];

const now = new Date();
const year = now.getFullYear();
const month = now.getMonth();

const firstDay = new Date(year, month, 1);
const lastDay = new Date(year, month + 1, 0);

const toInputDate = date =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

fromDate.value = toInputDate(firstDay);
toDate.value = toInputDate(lastDay);

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));

  function showEmpty(text) {
    empty.querySelector('p').textContent = text;
    empty.style.display = 'flex';
    tableWrap.style.display = 'none';
  }

  function dateText(value) {
    if (!value) return '—';
    const text = String(value);
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[3]}-${match[2]}-${match[1]}` : text;
  }

  function statusText(value) {
    const status = String(value ?? '').trim().toLowerCase();
    if (status === 'correct') return '<span class="complaint-status correct">✓</span>';
    if (status === 'wrong') return '<span class="complaint-status wrong">×</span>';
    return esc(value || '—');
  }

  function renderRows(rows) {
    const selectedCategory = categoryFilter.value.trim().toLowerCase();
    const filteredRows = rows.filter(row =>
      !selectedCategory ||
      String(row.complaintCategory || '').trim().toLowerCase() === selectedCategory
    );

    if (!filteredRows.length) {
      body.innerHTML = '<tr><td colspan="11">No complaints found for this category.</td></tr>';
      empty.style.display = 'none';
      tableWrap.style.display = '';
      return;
    }

    body.innerHTML = filteredRows.map(row => `
      <tr>
        <td>${esc(row.serialNo)}</td>
        <td>${esc(dateText(row.date))}</td>
        <td>${esc(dateText(row.receivedDate))}</td>
        <td>${esc(row.receivedFrom)}</td>
        <td>${esc(row.complaintCategory)}</td>
        <td>${esc(row.customer)}</td>
        <td>${esc(row.complaint)}</td>
        <td>${esc(row.itemQty)}</td>
        <td>${statusText(row.complaintSampleCcSheet)}</td>
        <td>${statusText(row.complaintSample)}</td>
        <td>${statusText(row.complaintOnly)}</td>
      </tr>
    `).join('');

    empty.style.display = 'none';
    tableWrap.style.display = '';
  }

  async function loadReport() {
    if (fromDate.value && toDate.value && fromDate.value > toDate.value) {
      showEmpty('From Date eka To Date ekata kalin danna.');
      return;
    }

    const params = new URLSearchParams({
      action: 'getCustomerComplaintReport',
      fromDate: fromDate.value,
      toDate: toDate.value
    });

    const originalText = loadButton.textContent;
    loadButton.disabled = true;
    loadButton.textContent = 'Loading...';
    tableWrap.style.display = 'none';
    empty.style.display = 'none';
    loading.style.display = 'flex';

    try {
      const response = await fetch(`${API_URL_COMPLAINT_REPORT}?${params}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Could not load report.');
      }

      const rows = result.rows || [];
      reportRows = rows;
      if (!rows.length) {
        showEmpty('No customer complaint records found for this date range.');
      } else {
        renderRows(rows);
      }
    } catch (error) {
      showEmpty(error.message || 'Failed to load report.');
    } finally {
      loading.style.display = 'none';
      loadButton.disabled = false;
      loadButton.textContent = originalText;
    }
  }

  categoryFilter.addEventListener('change', () => renderRows(reportRows));
  loadButton.addEventListener('click', loadReport);
});
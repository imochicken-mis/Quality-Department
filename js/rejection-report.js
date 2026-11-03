// ============================================
// REJECTION REPORT (monthly)
// ============================================
// Each report page sets window.RJ_REPORT before loading this file:
// { type: 'inprocess' | 'coolroom' | 'sales' | 'shop', title, file, remark: true/false }
const RJ = Object.assign(
  { type: 'inprocess', title: 'Rejection Report', file: 'Rejection-Report', remark: true },
  window.RJ_REPORT || {}
);

const API_URL_REJECTION = 'https://script.google.com/macros/s/AKfycbxY0TPyoSAOTACaDzjOAwI4y3Fo5Movlx5G6hhROxNBHUpx7cZSRctCRaWNtd1iw4U6/exec';

// Apps Script cold start / HTML error response wela fail unoth auto retry
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
      await new Promise(resolve => setTimeout(resolve, 400 * (i + 1)));
    }
  }

  throw lastErr;
}

document.addEventListener('DOMContentLoaded', () => {
  const monthInput = document.getElementById('reportMonth');
  const loadBtn = document.getElementById('loadReportBtn');
  const printBtn = document.getElementById('printBtn');
  const tabs = [...document.querySelectorAll('[data-rj-view]')];
  const singleMonthGroup = document.getElementById('rjSingleMonthGroup');
  const rangeBox = document.getElementById('rjMonthRange');
  const fromMonth = document.getElementById('rjFromMonth');
  const toMonth = document.getElementById('rjToMonth');

  let currentRecords = [];
  let activeView = 'daily';

  if (!monthInput) return;

  fetch(API_URL_REJECTION + '?action=ping&_w=' + Date.now()).catch(() => {});

  const restored = ReportCache.restoreInput(monthInput, 'rejection-' + RJ.type);

  if (!monthInput.value) {
    const now = new Date();
    monthInput.value =
      now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  }

  if (fromMonth && !fromMonth.value) fromMonth.value = monthInput.value;
  if (toMonth && !toMonth.value) toMonth.value = monthInput.value;

  if (restored) setTimeout(loadReport, 0);

  loadBtn && loadBtn.addEventListener('click', () => {
    ReportCache.clear();
    loadReport();
  });

  printBtn && printBtn.addEventListener('click', downloadPdf);

  monthInput.addEventListener('change', () => {
    if (activeView === 'daily') loadReport();
  });

  tabs.forEach(tab => {
    tab.addEventListener('click', () => setView(tab.dataset.rjView));
  });

  function setView(view) {
    activeView = view;

    tabs.forEach(tab => {
      const selected = tab.dataset.rjView === view;
      tab.classList.toggle('active', selected);
      tab.setAttribute('aria-selected', String(selected));
    });

    if (singleMonthGroup) singleMonthGroup.hidden = view !== 'daily';
    if (rangeBox) rangeBox.hidden = view === 'daily';

    const prompt = document.querySelector('#reportEmpty p');
    if (prompt) {
      prompt.textContent = view === 'daily'
        ? 'Select a month above to generate the report'
        : 'Select a month range and load the report';
    }

    document.getElementById('reportSheet').style.display = 'none';
    document.getElementById('reportEmpty').style.display = 'flex';
  }

  async function loadReport() {
    const empty = document.getElementById('reportEmpty');
    const loading = document.getElementById('reportLoading');
    const sheet = document.getElementById('reportSheet');
    const message = empty.querySelector('p');

    let months;

    if (activeView === 'daily') {
      if (!monthInput.value) return;
      months = [monthInput.value];
    } else {
      const from = fromMonth?.value;
      const to = toMonth?.value;

      if (!from || !to) {
        empty.style.display = 'flex';
        sheet.style.display = 'none';
        message.textContent = 'Select both start and end months.';
        return;
      }

      if (from > to) {
        empty.style.display = 'flex';
        sheet.style.display = 'none';
        message.textContent = 'Start month must be before or equal to end month.';
        return;
      }

      months = monthRange(from, to);
    }

    empty.style.display = 'none';
    sheet.style.display = 'none';
    loading.style.display = 'flex';

    try {
      const responses = await Promise.all(
        months.map(async month => {
          const url =
            `${API_URL_REJECTION}?action=getRejectionReport&type=${encodeURIComponent(RJ.type)}&month=${encodeURIComponent(month)}`;

          return {
            month,
            data: await fetchJsonRetry(url)
          };
        })
      );

      const failed = responses.find(result => !result.data.success);
      if (failed) throw new Error(failed.data.error || 'Load failed');

      const allRecords = responses.flatMap(result =>
        (result.data.records || []).map(record => ({
          ...record,
          _month: result.month
        }))
      );

      currentRecords = allRecords;
      loading.style.display = 'none';

      if (!allRecords.length) {
        empty.style.display = 'flex';
        message.textContent = 'No rejection data found for the selected period.';
        return;
      }

      renderReport(allRecords, months);
    } catch (err) {
      console.error('Rejection report load error:', err);
      loading.style.display = 'none';
      empty.style.display = 'flex';
      message.textContent = 'Error loading report. Please try again.';
    }
  }

  function renderReport(records, months) {
    const sorted = [...records].sort((a, b) =>
      String(a.date).localeCompare(String(b.date))
    );

    const total = sorted.reduce((sum, record) => sum + num(record.qty), 0);
    const head = document.getElementById('reportHead');
    const body = document.getElementById('reportBody');
    const foot = document.getElementById('reportFoot');
    const monthLayout = document.getElementById('rjMonthLayout');
    const monthChart = document.getElementById('rjMonthChart');

    if (monthLayout) {
      monthLayout.classList.toggle('is-month-view', activeView === 'month');
    }

    if (monthChart) {
      monthChart.hidden = activeView !== 'month';
    }

    const reportTable = document.querySelector('.rj-table');

    if (reportTable) {
      reportTable.classList.toggle(
        'rj-daily-table',
        activeView === 'daily' && tabs.length > 0 && RJ.remark
      );

      reportTable.classList.toggle(
        'rj-month-table',
        activeView === 'month' && tabs.length > 0
      );

      reportTable.classList.toggle(
        'rj-item-range-table',
        activeView === 'item' && tabs.length > 0
      );

      reportTable.style.width =
        activeView === 'item' && tabs.length > 0
          ? `${330 + months.length * 110}px`
          : '';
    }

    const period = activeView === 'daily'
      ? formatMonth(months[0])
      : `${formatMonth(months[0])} – ${formatMonth(months[months.length - 1])}`;

    document.getElementById('rptMonth').textContent = period;
    document.getElementById('rptCount').textContent = sorted.length;
    document.getElementById('rptTotal').textContent = fmt(total) + ' kg';

    if (activeView === 'item') {
      const items = [
        ...new Set(sorted.map(record => String(record.item || '—').trim()))
      ].sort((a, b) => a.localeCompare(b));

      const byItem = new Map(items.map(item => [item, new Map()]));

      sorted.forEach(record => {
        const item = String(record.item || '—').trim();
        const values = byItem.get(item);
        values.set(record._month, (values.get(record._month) || 0) + num(record.qty));
      });

      head.innerHTML =
        `<tr><th>Item</th>${months.map(month =>
          `<th>${esc(formatMonth(month))} (kg)</th>`
        ).join('')}<th>Total (kg)</th></tr>`;

      body.innerHTML = items.map(item => {
        const values = byItem.get(item);
        const itemTotal = [...values.values()].reduce((sum, value) => sum + value, 0);

        return `<tr>
          <td class="left">${esc(item)}</td>
          ${months.map(month =>
            `<td class="rj-qty">${fmt(values.get(month) || 0)}</td>`
          ).join('')}
          <td class="rj-qty">${fmt(itemTotal)}</td>
        </tr>`;
      }).join('');

      foot.innerHTML =
        `<tr>
          <td class="left">Total</td>
          ${months.map(month => {
            const monthTotal = sorted
              .filter(record => record._month === month)
              .reduce((sum, record) => sum + num(record.qty), 0);

            return `<td class="rj-qty">${fmt(monthTotal)}</td>`;
          }).join('')}
          <td class="rj-qty">${fmt(total)}</td>
        </tr>`;
    } else if (activeView === 'month') {
      head.innerHTML =
        '<tr><th>Month</th><th>Records</th><th>Total (kg)</th></tr>';

      const monthTotals = months.map(month => {
        const monthRecords = sorted.filter(record => record._month === month);

        return {
          month,
          count: monthRecords.length,
          total: monthRecords.reduce((sum, record) => sum + num(record.qty), 0)
        };
      });

      body.innerHTML = monthTotals.map(({ month, count, total: monthTotal }) => `
        <tr>
          <td class="left">${esc(formatMonth(month))}</td>
          <td class="rj-qty">${count}</td>
          <td class="rj-qty">${fmt(monthTotal)}</td>
        </tr>
      `).join('');

      foot.innerHTML = `
        <tr>
          <td class="left">Total</td>
          <td class="rj-qty">${sorted.length}</td>
          <td class="rj-qty">${fmt(total)}</td>
        </tr>
      `;

      renderMonthChart(monthChart, monthTotals);
    } else {
      head.innerHTML =
        `<tr><th>Date</th><th>Item</th><th>Qty (kg)</th>${RJ.remark ? '<th>Remark</th>' : ''}</tr>`;

      body.innerHTML = sorted.map(record => `
        <tr>
          <td class="nowrap">${formatDate(record.date)}</td>
          <td class="left">${esc(record.item) || '-'}</td>
          <td class="rj-qty">${esc(fmt(num(record.qty)))}</td>
          ${RJ.remark ? `<td class="left">${esc(record.remark) || '-'}</td>` : ''}
        </tr>
      `).join('');

      foot.innerHTML =
        `<tr><td></td><td class="left">Total</td><td class="rj-qty">${fmt(total)}</td>${RJ.remark ? '<td></td>' : ''}</tr>`;
    }

    document.getElementById('reportSheet').style.display = 'block';
  }

  function monthRange(from, to) {
    const result = [];
    let year = Number(from.slice(0, 4));
    let month = Number(from.slice(5, 7));
    const end = Number(to.slice(0, 4)) * 12 + Number(to.slice(5, 7));

    while (year * 12 + month <= end) {
      result.push(`${year}-${String(month).padStart(2, '0')}`);
      month++;

      if (month > 12) {
        month = 1;
        year++;
      }
    }

    return result;
  }

function renderMonthChart(container, monthTotals) {
  if (!container) return;

  const maxTotal = Math.max(...monthTotals.map(entry => entry.total), 0);
  const rawStep = maxTotal > 0 ? maxTotal / 4 : 0.25;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalizedStep = rawStep / magnitude;
  const niceSteps = [1, 2, 2.5, 3, 4, 5, 6, 8, 10];

  const step = maxTotal > 0
    ? (niceSteps.find(value => value >= normalizedStep) || 10) * magnitude
    : 0.25;

  const axisMax = maxTotal > 0
    ? Math.ceil(maxTotal / step) * step
    : 1;

  const ticks = Array.from(
    { length: 5 },
    (_, index) => axisMax - step * index
  );

  container.innerHTML = `


    <div class="rj-chart-body">
      <div class="rj-chart-y-axis" aria-hidden="true">
        ${ticks.map(tick => `<span>${fmt(tick)}</span>`).join('')}
      </div>

      <div class="rj-chart-plot" style="--rj-chart-columns:${monthTotals.length}">
        ${monthTotals.map(({ month, total }) => {
          const height = total > 0
            ? Math.max(2, (total / axisMax) * 100)
            : 0;
          const shortMonth =
            `${formatMonth(month).slice(0, 3)} '${month.slice(2, 4)}`;

          return `
            <div class="rj-chart-column"
                 role="img"
                 aria-label="${esc(formatMonth(month))}: ${fmt(total)} kilograms">
              <div class="rj-chart-bar-area">
                <span class="rj-chart-value"
                      style="bottom:calc(${height}% + 4px)">
                  ${fmt(total)}
                </span>
                <div class="rj-chart-bar" style="height:${height}%"></div>
              </div>
              <span class="rj-chart-month">${esc(shortMonth)}</span>
            </div>`;
        }).join('')}
      </div>
    </div>`;
}

  // PDF helpers remain for the other rejection-report pages that use this shared script.
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(script);
    });
  }

  async function ensurePdfLibs() {
    const ready = () =>
      window.jspdf &&
      window.jspdf.jsPDF &&
      typeof window.jspdf.jsPDF.API.autoTable === 'function';

    if (ready()) return;

    if (!(window.jspdf && window.jspdf.jsPDF)) {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    }

    if (!ready()) {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');
    }

    if (!ready()) throw new Error('PDF library not available');
  }

  // ===== PDF builder (A4 portrait) =====
  function buildPdf(records, month) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 10;
    const total = records.reduce((sum, record) => sum + num(record.qty), 0);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Month:', margin, 13);

    const monthLabelWidth = doc.getTextWidth('Month: ');
    doc.setFont('helvetica', 'normal');
    doc.text(formatMonth(month), margin + monthLabelWidth, 13);

    doc.setFont('helvetica', 'bold');
    doc.text('Records:', margin, 18);

    const recordsLabelWidth = doc.getTextWidth('Records: ');
    doc.setFont('helvetica', 'normal');
    doc.text(String(records.length), margin + recordsLabelWidth, 18);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);

    const title = RJ.title;
    const titleWidth = doc.getTextWidth(title);

    doc.text(title, pageW / 2, 14, { align: 'center' });
    doc.setLineWidth(0.4);
    doc.setDrawColor(15, 23, 42);
    doc.line(
      pageW / 2 - titleWidth / 2,
      15.6,
      pageW / 2 + titleWidth / 2,
      15.6
    );

    const baseStyles = {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 2,
      halign: 'center',
      valign: 'middle',
      lineColor: [51, 65, 85],
      lineWidth: 0.2,
      textColor: [15, 23, 42],
      fillColor: [255, 255, 255]
    };

    const headStyles = {
      fillColor: [238, 242, 247],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 8
    };

    doc.autoTable({
      head: [
        RJ.remark
          ? ['DATE', 'ITEM', 'QTY (KG)', 'REMARK']
          : ['DATE', 'ITEM', 'QTY (KG)']
      ],
      body: records.map(record => [
        formatDate(record.date),
        { content: record.item || '-', styles: { halign: 'left' } },
        fmt(num(record.qty))
      ].concat(
        RJ.remark
          ? [{ content: record.remark || '-', styles: { halign: 'left' } }]
          : []
      )),
      foot: [[
        '',
        { content: 'Total', styles: { halign: 'left' } },
        fmt(total)
      ].concat(RJ.remark ? [''] : [])],
      showFoot: 'lastPage',
      startY: 22,
      margin: { top: 12, left: margin, right: margin, bottom: 14 },
      theme: 'grid',
      styles: baseStyles,
      headStyles,
      footStyles: {
        fillColor: [232, 237, 245],
        textColor: [15, 23, 42],
        fontStyle: 'bold'
      },
      alternateRowStyles: { fillColor: [241, 245, 249] },
      columnStyles: RJ.remark
        ? { 0: { cellWidth: 26 }, 1: { cellWidth: 70 }, 2: { cellWidth: 26 } }
        : { 0: { cellWidth: 30 }, 2: { cellWidth: 36 } },
      tableWidth: RJ.remark ? 'auto' : 190,
      rowPageBreak: 'avoid'
    });

    const pages = doc.internal.getNumberOfPages();

    for (let page = 1; page <= pages; page++) {
      doc.setPage(page);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text('Imo Chicken & Agro (Pvt) Ltd', margin, pageH - 6);
      doc.text(`Page ${page} of ${pages}`, pageW - margin, pageH - 6, { align: 'right' });
    }

    return doc;
  }

  // ===== Download PDF =====
  async function downloadPdf() {
    if (!currentRecords.length) return;

    try {
      await ensurePdfLibs();
    } catch (err) {
      console.error('PDF lib load error:', err);
      alert('PDF library load wenne na. Internet connection eka balanna.');
      return;
    }

    const original = printBtn.innerHTML;
    printBtn.innerHTML = 'Generating PDF...';
    printBtn.disabled = true;

    try {
      const month = monthInput.value;
      buildPdf(currentRecords, month).save(
        RJ.file + '-' + (month || 'report') + '.pdf'
      );
    } catch (err) {
      console.error('PDF error:', err);
      alert('PDF generate wenna bari una. Ayeth try karanna.');
    } finally {
      printBtn.innerHTML = original;
      printBtn.disabled = false;
    }
  }

  // ===== Helpers =====
  function num(value) {
    const number = parseFloat(value);
    return Number.isNaN(number) ? 0 : number;
  }

  function fmt(number) {
    number = Math.round(number * 100) / 100;
    return Number.isInteger(number) ? String(number) : number.toFixed(2);
  }

  function formatDate(value) {
    const parts = String(value || '').split('-');

    return parts.length === 3
      ? parts[2] + '-' + parts[1] + '-' + parts[0]
      : (value || '-');
  }

  function formatMonth(value) {
    const parts = String(value || '').split('-');
    if (parts.length !== 2) return value || '-';

    const names = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    return names[Number(parts[1]) - 1] + ' ' + parts[0];
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
});
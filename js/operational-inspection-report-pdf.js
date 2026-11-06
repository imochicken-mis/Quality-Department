// PDF export for the Operational Inspection report.
// Builds a real text PDF from the loaded table (jsPDF + jspdf-autotable), not a screenshot.
(() => {
  const HEADER_H = 28;
  const STATUS_STYLE = {
    ok: { fillColor: [220, 252, 231], textColor: [22, 101, 52] },
    bad: { fillColor: [254, 226, 226], textColor: [153, 27, 27] },
    na: { fillColor: [241, 245, 249], textColor: [51, 65, 85] }
  };

  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();

  function statusKind(cell) {
    const badge = cell.querySelector('.report-status');
    if (!badge) return 'na';
    if (badge.classList.contains('ok')) return 'ok';
    if (badge.classList.contains('bad')) return 'bad';
    return 'na';
  }

  function slug(value) {
    return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'report';
  }

  function longDate(isoDate) {
    const parsed = new Date(`${isoDate}T00:00:00`);
    return isNaN(parsed) ? isoDate : parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function buildPdf() {
    const table = document.querySelector('.inspection-report-table');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = { left: 36, right: 36 };

    const stageName = document.querySelector('.inspection-tab.active')?.textContent.trim() || '';
    const division = document.getElementById('reportDivision').value;
    const date = document.getElementById('reportDate').value;
    const meta = clean(document.getElementById('reportMeta').textContent);
    const title = 'Operational Inspection Report';
    const subtitle = `Date: ${longDate(date)}   |   Division: ${division}   |   Stage: ${stageName}`;

    const headers = [...table.querySelectorAll('thead th:not([hidden])')].map(th => clean(th.textContent));
    const body = [...table.querySelectorAll('tbody tr')].map(row => [...row.cells].map((cell, index) => {
      if (cell.querySelector('.report-status')) {
        const style = STATUS_STYLE[statusKind(cell)];
        return { content: clean(cell.textContent), styles: { ...style, fontStyle: 'bold', halign: 'center' } };
      }
      if (index === 0) return { content: clean(cell.textContent), styles: { halign: 'center' } };
      return clean(cell.textContent);
    }));

    // Column widths: No | Check Point | Acceptance Criteria (pre only) | Status | Action
    const columnStyles = headers.length === 5
      ? { 0: { cellWidth: 36 }, 3: { cellWidth: 90 } }
      : { 0: { cellWidth: 36 }, 2: { cellWidth: 90 } };

    // Title block below the header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text(title, margin.left, 58);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(37, 99, 235);
    doc.text(subtitle, margin.left, 74);
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(meta, margin.left, 88, { maxWidth: pageWidth - margin.left - margin.right });

    doc.autoTable({
      head: [headers],
      body,
      startY: 100,
      margin: { left: margin.left, right: margin.right, top: 46, bottom: 50 },
      // Slim header with grey rule on every page
      didDrawPage: () => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42);
        doc.text('Imo Chicken & Agro (Pvt) Ltd', margin.left, HEADER_H / 2 + 3);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.text('Quality Assurance Department', pageWidth - margin.right, HEADER_H / 2 + 3, { align: 'right' });
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.8);
        doc.line(margin.left, HEADER_H, pageWidth - margin.right, HEADER_H);
        doc.setTextColor(0, 0, 0);
      },
      styles: { fontSize: 9, cellPadding: 5, textColor: [30, 41, 59], lineColor: [215, 226, 243], lineWidth: 0.5, valign: 'middle' },
      headStyles: { fillColor: [234, 240, 248], textColor: [15, 23, 42], fontStyle: 'bold', halign: 'center' },
      columnStyles,
      theme: 'grid'
    });

    // Footer on every page: grey rule, generated date/time, copyright, page number
    const pages = doc.internal.getNumberOfPages();
    const generated = new Date().toLocaleString();
    for (let page = 1; page <= pages; page += 1) {
      doc.setPage(page);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.8);
      doc.line(margin.left, pageHeight - 34, pageWidth - margin.right, pageHeight - 34);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated ${generated}`, margin.left, pageHeight - 22);
      doc.text('© 2026 Imo Chicken & Agro (Pvt) Ltd. MIS Department . All rights reserved.', pageWidth / 2, pageHeight - 22, { align: 'center' });
      doc.text(`Page ${page} of ${pages}`, pageWidth - margin.right, pageHeight - 22, { align: 'right' });
    }

    const stage = slug(stageName);
    doc.save(`operational-inspection-${stage}-${slug(division)}-${date}.pdf`);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const option = document.querySelector('[data-export-pdf="inspection"]');
    if (!option) return;

    // Capture this click before the shared screenshot-based export handler runs
    option.addEventListener('click', event => {
      event.stopPropagation();
      const wrap = option.closest('.report-export-wrap');
      wrap.querySelector('.report-export-menu').hidden = true;
      wrap.querySelector('.report-export-trigger').setAttribute('aria-expanded', 'false');

      if (!document.querySelector('.inspection-report-table tbody tr')) {
        window.alert('Load report data before exporting.');
        return;
      }
      try {
        buildPdf();
      } catch (error) {
        console.error(error);
        window.alert('PDF could not be created. Please check your connection and try again.');
      }
    });
  });
})();

// Birds Quality report PDF: the printed "Daily Birds Quality Report" layout
// (logo + Verification of Production Process header, document control box, data table, sign-off footer).
// Built as a real text PDF with jsPDF + jspdf-autotable from the loaded report table.
(() => {
  const L = 28;                 // left margin
  const HEADER_TOP = 18;
  const HEADER_H = 68;
  const HEADER_BOTTOM = HEADER_TOP + HEADER_H;
  const CONTENT_TOP = 96;       // table start on later pages
  const FIRST_TABLE_TOP = 138;  // table start on page 1 (below title row)
  const FOOTER_NEEDED = 118;    // space the sign-off block needs at the bottom of the last page

  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
  const slug = value => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'report';

  // Logo from the page's own image (same origin, so the canvas can be exported)
  function logoData() {
    const img = document.querySelector('#reportSheet .report-logo');
    if (!img || !img.complete || !img.naturalWidth) return null;
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);
    return { data: canvas.toDataURL('image/png'), ratio: img.naturalWidth / img.naturalHeight };
  }

  // Document control rows from the on-page block: label/value pairs, last row = single cell (PSSC)
  function documentRows() {
    return [...document.querySelectorAll('.report-doc-table tr')].map(row => [...row.cells].map(cell => clean(cell.textContent)));
  }

  function formatDate(isoDate) {
    const match = String(isoDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}-${match[2]}-${match[1]}` : clean(isoDate);
  }

  function drawHeader(doc, logo, docRows) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const R = pageWidth - L;
    const logoCellRight = L + 150;
    const docLeft = R - 250;
    const titleCenter = (logoCellRight + docLeft) / 2;

    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(0.8);
    doc.rect(L, HEADER_TOP, R - L, HEADER_H);
    doc.line(logoCellRight, HEADER_TOP, logoCellRight, HEADER_BOTTOM);
    doc.line(docLeft, HEADER_TOP, docLeft, HEADER_BOTTOM);

    if (logo) {
      const width = Math.min(120, 46 * logo.ratio);
      const height = width / logo.ratio;
      doc.addImage(logo.data, 'PNG', L + (150 - width) / 2, HEADER_TOP + (HEADER_H - height) / 2, width, height);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('Verification of Production Process', titleCenter, HEADER_TOP + HEADER_H / 2 + 4, { align: 'center' });

    // Document control box: label | value rows, then a full-width bottom row
    const rowHeight = HEADER_H / 5;
    const labelRows = docRows.filter(cells => cells.length >= 2);
    const footRow = docRows.find(cells => cells.length === 1);
    labelRows.forEach((cells, index) => {
      const y = HEADER_TOP + index * rowHeight;
      doc.line(docLeft, y + rowHeight, R, y + rowHeight);
      doc.line(docLeft + 110, y, docLeft + 110, y + rowHeight);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text(cells[0], docLeft + 5, y + rowHeight / 2 + 2.5);
      doc.setFont('helvetica', 'normal');
      doc.text(cells[1] || '', docLeft + 115, y + rowHeight / 2 + 2.5);
    });
    const footY = HEADER_TOP + labelRows.length * rowHeight;
    doc.line(docLeft, footY, R, footY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(footRow ? footRow[0] : 'PSSC 2000 Ver. 6', R - 6, footY + rowHeight / 2 + 3, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }

  function drawTitleRow(doc, dateText, legendRight) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const R = pageWidth - L;
    const y = 112;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text('Date:', L, y);
    doc.setFont('helvetica', 'normal');
    doc.text(dateText, L + 30, y);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    const title = 'Daily Birds Quality Report';
    const center = pageWidth / 2;
    doc.text(title, center, y, { align: 'center' });
    const titleWidth = doc.getTextWidth(title);
    doc.setLineWidth(0.6);
    doc.line(center - titleWidth / 2, y + 2, center + titleWidth / 2, y + 2);

    // Legend box on the right
    const legend = 'A: Acceptable    NA: Not acceptable';
    doc.setFontSize(8);
    const boxWidth = doc.getTextWidth(legend) + 16;
    doc.setLineWidth(0.6);
    doc.rect(R - boxWidth, y - 12, boxWidth, 18);
    doc.setFont('helvetica', 'bold');
    doc.text('A:', R - boxWidth + 8, y);
    doc.setFont('helvetica', 'normal');
    doc.text('Acceptable', R - boxWidth + 17, y);
    doc.setFont('helvetica', 'bold');
    doc.text('NA:', R - boxWidth + 80, y);
    doc.setFont('helvetica', 'normal');
    doc.text('Not acceptable', R - boxWidth + 92, y);
    doc.setTextColor(0, 0, 0);
    return legendRight;
  }

  // Table head rows straight from the on-screen <thead> (rowspan/colspan kept)
  function headRows(table) {
    return [...table.querySelectorAll('thead tr')].map(row => [...row.cells].map(cell => ({
      content: clean(cell.textContent),
      colSpan: cell.colSpan,
      rowSpan: cell.rowSpan,
      styles: { halign: 'center', valign: 'middle' }
    })));
  }

  function bodyRows(table) {
    return [...table.querySelectorAll('tbody tr')].map(row => [...row.cells].map(cell => {
      const text = clean(cell.textContent);
      if (text === 'A') return { content: text, styles: { fillColor: [209, 250, 229], textColor: [22, 101, 52], fontStyle: 'bold', halign: 'center' } };
      if (text === 'NA') return { content: text, styles: { fillColor: [254, 226, 226], textColor: [153, 27, 27], fontStyle: 'bold', halign: 'center' } };
      return { content: text, styles: { halign: /^[\d.,\-—]+$/.test(text) || text === '' ? 'center' : 'left' } };
    }));
  }

  function drawSignOff(doc, pageNo, pages, footPage) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const R = pageWidth - L;
    const y = pageHeight - 96;

    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(0.6);
    doc.line(L + 30, y, L + 190, y);
    doc.line(L + 260, y, L + 420, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Checked by', L + 60, y + 12);
    doc.text('Reviewed by', L + 290, y + 12);

    doc.rect(R - 120, y - 16, 120, 22);
    doc.text(`Page ${pageNo} of ${pages}`, R - 60, y - 2, { align: 'center' });

    // Bottom company block
    const blockTop = pageHeight - 62;
    const blockH = 44;
    const companyW = 430;
    doc.rect(L, blockTop, companyW, blockH);
    doc.rect(L + companyW, blockTop, (R - L - companyW) / 2, blockH / 2);
    doc.rect(L + companyW + (R - L - companyW) / 2, blockTop, (R - L - companyW) / 2, blockH / 2);
    doc.rect(L + companyW, blockTop + blockH / 2, (R - L - companyW) / 2, blockH / 2);
    doc.rect(L + companyW + (R - L - companyW) / 2, blockTop + blockH / 2, (R - L - companyW) / 2, blockH / 2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(footPage.company, L + 8, blockTop + blockH / 2 + 3, { maxWidth: companyW - 16 });
    doc.setFont('helvetica', 'normal');
    const x1 = L + companyW;
    const x2 = x1 + (R - L - companyW) / 2;
    doc.text('Reviewed by', x1 + 8, blockTop + 13);
    doc.text('Approved by', x2 + 8, blockTop + 13);
    doc.text('Quality Assurance Supervisor', x1 + 8, blockTop + blockH - 8);
    doc.text('Food Safety Team Leader', x2 + 8, blockTop + blockH - 8);
    doc.setTextColor(0, 0, 0);
  }

  function buildPdf() {
    const table = document.querySelector('#reportSheet .report-table');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const logo = logoData();
    const docRows = documentRows();
    const dateText = formatDate(document.getElementById('reportDate').value);
    const footPage = {
      company: clean(document.querySelector('.report-foot-table .foot-company')?.textContent) ||
        'Imo Chicken & Agro (Pvt) Ltd, No 20/A, Loluwagoda Watta, Loluwagoda.'
    };

    doc.autoTable({
      head: headRows(table),
      body: bodyRows(table),
      startY: FIRST_TABLE_TOP,
      margin: { left: L, right: L, top: CONTENT_TOP, bottom: FOOTER_NEEDED },
      styles: { fontSize: 7.5, cellPadding: 3, textColor: [15, 23, 42], lineColor: [30, 41, 59], lineWidth: 0.5, valign: 'middle', font: 'helvetica' },
      headStyles: { fillColor: [234, 240, 248], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 7 },
      theme: 'grid',
      // Fixed column widths that add up to the printable width (page 842pt - two 28pt margins = 786pt)
      tableWidth: 786,
      columnStyles: {
        0: { cellWidth: 30 },   // Se No
        1: { cellWidth: 110 },  // Farm or farmer name
        2: { cellWidth: 58 },   // Batch number
        3: { cellWidth: 52 },   // Numbers of birds
        4: { cellWidth: 48 },   // Average weight
        5: { cellWidth: 58 },   // Processing order
        6: { cellWidth: 46 },   // Cleanliness
        7: { cellWidth: 46 },   // Damage birds
        8: { cellWidth: 46 },   // Skin condition
        9: { cellWidth: 46 },   // Gizzard content
        10: { cellWidth: 46 },  // Crop content
        11: { cellWidth: 46 },  // Flesh colour
        12: { cellWidth: 44 },  // Mortality: transport
        13: { cellWidth: 44 },  // Mortality: bay
        14: { cellWidth: 66 }   // Remark
      },
      didDrawPage: data => {
        drawHeader(doc, logo, docRows);
        if (data.pageNumber === 1) drawTitleRow(doc, dateText);
      }
    });

    // Sign-off on the last page; add a page if the table ends too low
    const lastY = doc.lastAutoTable.finalY;
    if (lastY + FOOTER_NEEDED > pageHeight - 10) {
      doc.addPage();
      drawHeader(doc, logo, docRows);
    }

    const pages = doc.internal.getNumberOfPages();
    for (let page = 1; page <= pages; page += 1) {
      doc.setPage(page);
      if (page === pages) drawSignOff(doc, page, pages, footPage);
      else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(`Page ${page} of ${pages}`, pageWidth - L, pageHeight - 14, { align: 'right' });
        doc.setTextColor(0, 0, 0);
      }
    }

    doc.save(`birds-quality-report-${slug(dateText)}.pdf`);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const option = document.querySelector('[data-birds-quality-pdf]');
    if (!option) return;

    option.addEventListener('click', event => {
      event.stopPropagation();
      const wrap = option.closest('.report-export-wrap');
      wrap.querySelector('.report-export-menu').hidden = true;
      wrap.querySelector('.report-export-trigger').setAttribute('aria-expanded', 'false');

      if (!document.querySelector('#reportSheet .report-table tbody tr') || document.getElementById('reportSheet').style.display === 'none') {
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

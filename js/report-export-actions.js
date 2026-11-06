/* Shared PDF and CSV exports for report pages. */
(() => {
  const HEADER_H = 28;   // header height (pt), grey rule drawn at its bottom
  const TOP = 46;        // content starts below the header
  const CDN = {
    jspdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    autotable: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
    canvas: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
  };

  function loadScript(src) {
    if ([...document.scripts].some((tag) => tag.src === src)) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const tag = document.createElement('script');
      tag.src = src;
      tag.async = true;
      tag.onload = resolve;
      tag.onerror = () => reject(new Error('PDF library could not be loaded'));
      document.head.appendChild(tag);
    });
  }

  async function ensurePdfLibraries() {
    if (!window.jspdf?.jsPDF) await loadScript(CDN.jspdf);
    if (!window.jspdf?.jsPDF?.API?.autoTable) await loadScript(CDN.autotable);
    if (!window.jspdf?.jsPDF?.API?.autoTable) throw new Error('PDF library unavailable');
  }

  function visible(element) {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
  }

  function mainTable() {
    const tables = [...document.querySelectorAll('table')].filter((table) =>
      visible(table) && !table.matches('.report-doc-table, .report-foot-table')
    );
    return tables.find((table) => table.tBodies.length && table.tBodies[0].rows.length) || null;
  }

  function cleanText(value) { return (value || '').replace(/\s+/g, ' ').trim(); }
  function reportName() { return cleanText(document.querySelector('.page-header h1')?.textContent) || 'Report'; }
  function slug(value) { return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'report'; }
  function fileBase() { return `${slug(reportName())}-${new Date().toISOString().slice(0, 10)}`; }

  function cellValue(cell) {
    const select = cell.querySelector('select');
    if (select) return cleanText(select.options[select.selectedIndex]?.textContent || '');
    const input = cell.querySelector('input, textarea');
    return input ? cleanText(input.value) : cleanText(cell.textContent);
  }

  function requireTable() {
    const table = mainTable();
    if (!table) window.alert('Load report data before exporting.');
    return table;
  }

  function exportCsv() {
    const table = requireTable();
    if (!table) return;
    const csv = [...table.rows].map((row) => [...row.cells].map((cell) =>
      `"${cellValue(cell).replace(/"/g, '""')}"`
    ).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${fileBase()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  }

  function captureOptions(element) {
    return {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: Math.ceil(element.scrollWidth || element.getBoundingClientRect().width),
      height: Math.ceil(element.scrollHeight || element.getBoundingClientRect().height),
      windowWidth: Math.ceil(element.scrollWidth || element.getBoundingClientRect().width)
    };
  }

  async function capture(element) {
    return window.html2canvas(element, captureOptions(element));
  }

  function prepareTable(table) {
    const wrapper = table.closest('.report-table-wrapper, .analytics-table-wrapper, .table-wrap, .table-responsive, .report-table-scroll') || table.parentElement;
    const scroll = wrapper ? { left: wrapper.scrollLeft, top: wrapper.scrollTop } : null;
    if (wrapper) { wrapper.scrollLeft = 0; wrapper.scrollTop = 0; }

    table.classList.add('pdf-capture-mode');
    const sticky = table.querySelectorAll('thead, thead tr, thead th, tfoot, tfoot tr, tfoot td, tfoot th, tbody td:first-child');
    const positions = [...sticky].map((el) => el.style.position);
    sticky.forEach((el) => { el.style.position = 'static'; });

    // PDF copy: always show grid lines and dark text (the on-screen light borders/fonts get lost in the image)
    const cells = [...table.querySelectorAll('th, td')];
    const cellStyles = cells.map((cell) => [cell.style.border, cell.style.color]);
    const tableBorder = table.style.borderCollapse;
    table.style.borderCollapse = 'collapse';
    cells.forEach((cell) => {
      cell.style.border = '1px solid #94a3b8';
      cell.style.color = '#0f172a';
    });

    return () => {
      sticky.forEach((el, index) => { el.style.position = positions[index]; });
      cells.forEach((cell, index) => {
        cell.style.border = cellStyles[index][0];
        cell.style.color = cellStyles[index][1];
      });
      table.style.borderCollapse = tableBorder;
      table.classList.remove('pdf-capture-mode');
      if (wrapper && scroll) { wrapper.scrollLeft = scroll.left; wrapper.scrollTop = scroll.top; }
    };
  }

  async function captureTableParts(table) {
    const restore = prepareTable(table);
    try {
      const thead = table.querySelector('thead');
      const tbody = table.querySelector('tbody');
      const tfoot = table.querySelector('tfoot');
      const head = thead ? await capture(thead) : null;
      const body = await capture(tbody || table);
      const foot = tfoot ? await capture(tfoot) : null;
      const source = tbody || table;
      const sourceRect = source.getBoundingClientRect();
      const boundaries = tbody
        ? [...tbody.rows].map((row) => Math.max(1, Math.round((row.getBoundingClientRect().bottom - sourceRect.top) * 2)))
        : [body.height];
      return { head, body, foot, boundaries };
    } finally {
      restore();
    }
  }

  function imageHeight(canvas, width) {
    return canvas ? (canvas.height * width) / canvas.width : 0;
  }

  // Slim header (company + department) with a grey rule under it; grey rule + generated time and copyright in the footer
  function drawPageChrome(doc, pageNo) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('Imo Chicken & Agro (Pvt) Ltd', 24, HEADER_H / 2 + 3);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text('Quality Assurance Department', pageWidth - 24, HEADER_H / 2 + 3, { align: 'right' });
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.8);
    doc.line(24, HEADER_H, pageWidth - 24, HEADER_H);

    doc.line(24, pageHeight - 34, pageWidth - 24, pageHeight - 34);
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated ${new Date().toLocaleString()}`, 24, pageHeight - 22);
    doc.text('© 2026 Imo Chicken & Agro (Pvt) Ltd. MIS Department . All rights reserved.', pageWidth / 2, pageHeight - 22, { align: 'center' });
    doc.text(`Page ${pageNo}`, pageWidth - 24, pageHeight - 22, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }

  // Date / month filters the user picked on the page, e.g. "Month: October 2026   |   Date: 25 Oct 2026"
  function formatPeriod(input) {
    if (input.type === 'month') {
      const parsed = new Date(`${input.value}-01T00:00:00`);
      return isNaN(parsed) ? input.value : parsed.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    }
    const parsed = new Date(`${input.value}T00:00:00`);
    return isNaN(parsed) ? input.value : parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function periodText() {
    const parts = [];
    document.querySelectorAll('input[type="month"], input[type="date"]').forEach((input) => {
      if (!input.value || !visible(input)) return;
      // "SELECT MONTH" -> "Month", "FROM MONTH" -> "From Month", "DATE" -> "Date"
      const raw = cleanText(input.closest('.form-group')?.querySelector('label')?.textContent).replace(/\*/g, '');
      const label = raw.replace(/select/i, '').trim().toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
      parts.push(`${label || 'Date'}: ${formatPeriod(input)}`);
    });
    return parts.join('   |   ');
  }

  function renderTablePdf(parts, title, prefix, suffix) {
    const { jsPDF } = window.jspdf;
    const period = periodText();
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4', compress: true });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const left = 24, right = 24, bottom = 44;
    const contentWidth = pageWidth - left - right;
    const headHeight = imageHeight(parts.head, contentWidth);
    const footHeight = imageHeight(parts.foot, contentWidth);
    // Document-control block (Doc Code / Issue Date) keeps its natural size, not stretched to the full page width
    const prefixWidth = Math.min(contentWidth, 300);
    const prefixHeight = imageHeight(prefix, prefixWidth);
    const suffixHeight = imageHeight(suffix, contentWidth);
    const pxPerPt = parts.body.width / contentWidth;
    let rendered = 0, pageNo = 0, footerPending = false, suffixPending = false;

    while (rendered < parts.body.height) {
      if (pageNo > 0) doc.addPage();
      pageNo += 1;
      const first = pageNo === 1;
      let y = TOP;

      if (first && prefix) {
        doc.addImage(prefix, 'PNG', left, y, prefixWidth, prefixHeight);
        y += prefixHeight + 8;
      } else if (first) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(15);
        doc.setTextColor(15, 23, 42);
        doc.text(title, left, y + 14);
        doc.setTextColor(0, 0, 0);
        y += 28;
      }

      if (first && period) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text(period, left, y + 8);
        doc.setTextColor(0, 0, 0);
        y += 18;
      }

      if (parts.head) {
        doc.addImage(parts.head, 'PNG', left, y, contentWidth, headHeight);
        y += headHeight;
      }

      const reservedSuffix = (parts.body.height - rendered) <= 1 ? suffixHeight : 0;
      const availablePx = Math.max(1, Math.floor((pageHeight - bottom - y - reservedSuffix) * pxPerPt));
      const target = rendered + availablePx;
      const remaining = parts.body.height - rendered;
      let end = parts.boundaries.filter((point) => point > rendered && point <= target).pop();
      if (!end) end = Math.min(target, parts.body.height);
      if (remaining <= availablePx) end = parts.body.height;
      const slice = Math.max(1, end - rendered);

      const pageSlice = document.createElement('canvas');
      pageSlice.width = parts.body.width;
      pageSlice.height = slice;
      pageSlice.getContext('2d').drawImage(parts.body, 0, rendered, parts.body.width, slice, 0, 0, parts.body.width, slice);
      const sliceHeight = slice / pxPerPt;
      doc.addImage(pageSlice, 'PNG', left, y, contentWidth, sliceHeight);
      y += sliceHeight;

      if (end === parts.body.height) {
        if (parts.foot) {
          if (y + footHeight <= pageHeight - bottom) {
            doc.addImage(parts.foot, 'PNG', left, y, contentWidth, footHeight);
            y += footHeight;
          } else {
            footerPending = true;
          }
        }
        if (suffix) {
          if (y + suffixHeight <= pageHeight - bottom) {
            doc.addImage(suffix, 'PNG', left, y, contentWidth, suffixHeight);
          } else {
            suffixPending = true;
          }
        }
      }

      drawPageChrome(doc, pageNo);
      rendered = end;
    }

    if (footerPending || suffixPending) {
      // Only the leftover totals / sign-off go on this page. The column header is not repeated,
      // so the report structure is not duplicated.
      doc.addPage();
      pageNo += 1;
      let y = TOP;
      if (footerPending && parts.foot) {
        doc.addImage(parts.foot, 'PNG', left, y, contentWidth, footHeight);
        y += footHeight + 8;
      }
      if (suffixPending && suffix) {
        doc.addImage(suffix, 'PNG', left, y, contentWidth, suffixHeight);
      }
      drawPageChrome(doc, pageNo);
    }
    return doc;
  }

  // ===== Standard PDF: same layout as the Birds Quality report (logo + header, doc control box,
  // title row with filter, data table, sign-off footer). Built from the table data, not a screenshot.
  const STD_LEFT = 28;
  const STD_HEADER_TOP = 18;
  const STD_HEADER_H = 68;
  const STD_TABLE_TOP = 98;
  const STD_TABLE_TOP_LATER = 64;
  const STD_FOOTER_SPACE = 40;

  // Logo: use the page's own logo image when it has one, otherwise load the shared logo file
  function logoFromImage(img) {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);
    return { data: canvas.toDataURL('image/png'), ratio: img.naturalWidth / img.naturalHeight };
  }

  async function standardLogo() {
    const pageImg = document.querySelector('.report-logo');
    if (pageImg && pageImg.complete && pageImg.naturalWidth) return logoFromImage(pageImg);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(logoFromImage(img));
      img.onerror = () => resolve(null);
      img.src = new URL('../assets/images/logo.png', document.baseURI).href;
    });
  }

  // Document control block: same controlled document as the Birds Quality report
  const STD_DOC_ROWS = [
    ['Doc Code:', 'ICMS / CL / QD/ 05'],
    ['Issue Date:', '10.08.2023'],
    ['Revision No:', '04'],
    ['Revision Date:', '10.03.2026'],
    ['PSSC 2000 Ver. 6']
  ];

  function standardDocRows() {
    const rows = [...document.querySelectorAll('.report-doc-table tr')]
      .map(row => [...row.cells].map(cell => cleanText(cell.textContent)));
    return rows.length ? rows : STD_DOC_ROWS;
  }

  function standardHead(table) {
    return [...table.querySelectorAll('thead tr')].map(row => [...row.cells].map(cell => ({
      content: cleanText(cell.textContent),
      colSpan: cell.colSpan,
      rowSpan: cell.rowSpan,
      styles: { halign: 'center', valign: 'middle' }
    })));
  }

  // Body rows keep rowspan/colspan so merged cells (e.g. the Rep name) line up with the screen
  // Tick and cross symbols are drawn with ZapfDingbats (the standard PDF font has no ✓ / ✗ glyphs)
  function standardBody(table) {
    return [...table.querySelectorAll('tbody tr')].map(row => [...row.cells].map(cell => {
      const text = cellValue(cell);
      const spans = {};
      if (cell.rowSpan > 1) spans.rowSpan = cell.rowSpan;
      if (cell.colSpan > 1) spans.colSpan = cell.colSpan;
      if (text === '✓') return { content: '4', ...spans, styles: { font: 'ZapfDingbats', halign: 'center' } };
      if (text === '✗' || text === '×') return { content: '8', ...spans, styles: { font: 'ZapfDingbats', halign: 'center' } };
      if (text === 'A') return { content: text, ...spans, styles: { fillColor: [209, 250, 229], textColor: [22, 101, 52], fontStyle: 'bold', halign: 'center' } };
      if (text === 'NA') return { content: text, ...spans, styles: { fillColor: [254, 226, 226], textColor: [153, 27, 27], fontStyle: 'bold', halign: 'center' } };
      return { content: text, ...spans, styles: { halign: /^[\d.,\-—]*$/.test(text) ? 'center' : 'left' } };
    }));
  }

  function drawStandardHeader(doc, logo, docRows) {
    const width = doc.internal.pageSize.getWidth();
    const right = width - STD_LEFT;
    const top = STD_HEADER_TOP;
    const bottom = STD_HEADER_TOP + STD_HEADER_H;
    const logoRight = STD_LEFT + 150;
    const docLeft = right - 250;
    const hasDoc = docRows.length > 0;

    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(0.8);
    doc.rect(STD_LEFT, top, right - STD_LEFT, STD_HEADER_H);
    doc.line(logoRight, top, logoRight, bottom);
    if (hasDoc) doc.line(docLeft, top, docLeft, bottom);

    if (logo) {
      const logoWidth = Math.min(120, 46 * logo.ratio);
      const logoHeight = logoWidth / logo.ratio;
      doc.addImage(logo.data, 'PNG', STD_LEFT + (150 - logoWidth) / 2, top + (STD_HEADER_H - logoHeight) / 2, logoWidth, logoHeight);
    }

    const centre = hasDoc ? (logoRight + docLeft) / 2 : (logoRight + right) / 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('Verification of Production Process', centre, top + STD_HEADER_H / 2 + 4, { align: 'center' });

    if (hasDoc) {
      const labelRows = docRows.filter(cells => cells.length >= 2);
      const footRow = docRows.find(cells => cells.length === 1);
      const rowHeight = STD_HEADER_H / 5;
      labelRows.forEach((cells, index) => {
        const y = top + index * rowHeight;
        doc.line(docLeft, y + rowHeight, right, y + rowHeight);
        doc.line(docLeft + 110, y, docLeft + 110, y + rowHeight);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text(cells[0], docLeft + 5, y + rowHeight / 2 + 2.5);
        doc.setFont('helvetica', 'normal');
        doc.text(cells[1] || '', docLeft + 115, y + rowHeight / 2 + 2.5);
      });
      const footY = top + labelRows.length * rowHeight;
      doc.line(docLeft, footY, right, footY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(footRow ? footRow[0] : '', right - 6, footY + rowHeight / 2 + 3, { align: 'right' });
    }
    doc.setTextColor(0, 0, 0);
  }

  function drawStandardTitle(doc, period, title) {
    const width = doc.internal.pageSize.getWidth();
    const y = 112;
    if (period) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(period, STD_LEFT, y);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(title, width / 2, y, { align: 'center' });
    const titleWidth = doc.getTextWidth(title);
    doc.setLineWidth(0.6);
    doc.line(width / 2 - titleWidth / 2, y + 2, width / 2 + titleWidth / 2, y + 2);
    doc.setTextColor(0, 0, 0);
  }

  function drawStandardSignOff(doc, pageNo, pages, company) {
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    const right = width - STD_LEFT;
    const y = height - 96;

    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(0.6);
    doc.line(STD_LEFT + 30, y, STD_LEFT + 190, y);
    doc.line(STD_LEFT + 260, y, STD_LEFT + 420, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Checked by', STD_LEFT + 60, y + 12);
    doc.text('Reviewed by', STD_LEFT + 290, y + 12);
    doc.rect(right - 120, y - 16, 120, 22);
    doc.text(`Page ${pageNo} of ${pages}`, right - 60, y - 2, { align: 'center' });

    const blockTop = height - 62;
    const blockHeight = 44;
    const companyWidth = 430;
    const half = (right - STD_LEFT - companyWidth) / 2;
    const x1 = STD_LEFT + companyWidth;
    const x2 = x1 + half;
    doc.rect(STD_LEFT, blockTop, companyWidth, blockHeight);
    doc.rect(x1, blockTop, half, blockHeight / 2);
    doc.rect(x2, blockTop, half, blockHeight / 2);
    doc.rect(x1, blockTop + blockHeight / 2, half, blockHeight / 2);
    doc.rect(x2, blockTop + blockHeight / 2, half, blockHeight / 2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(company, STD_LEFT + 8, blockTop + blockHeight / 2 + 3, { maxWidth: companyWidth - 16 });
    doc.setFont('helvetica', 'normal');
    doc.text('Reviewed by', x1 + 8, blockTop + 13);
    doc.text('Approved by', x2 + 8, blockTop + 13);
    doc.text('Quality Assurance Supervisor', x1 + 8, blockTop + blockHeight - 8);
    doc.text('Food Safety Team Leader', x2 + 8, blockTop + blockHeight - 8);
    doc.setTextColor(0, 0, 0);
  }

  // Plain header: logo top-left, company name and department name, grey rule under them
  function drawPlainHeader(doc, logo) {
    const width = doc.internal.pageSize.getWidth();
    const right = width - STD_LEFT;
    let x = STD_LEFT;
    if (logo) {
      const logoHeight = 34;
      const logoWidth = Math.min(110, logoHeight * logo.ratio);
      doc.addImage(logo.data, 'PNG', x, 16, logoWidth, logoWidth / logo.ratio);
      x += logoWidth + 12;
    }
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Imo Chicken & Agro (Pvt) Ltd', x, 30);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Quality Assurance Department', x, 44);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.8);
    doc.line(STD_LEFT, 56, right, 56);
    doc.setTextColor(0, 0, 0);
  }

  // Report name centred with its underline; month / date filter on the left of the same row
  function drawPlainTitle(doc, period, title) {
    const width = doc.internal.pageSize.getWidth();
    const y = 84;
    if (period) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(period, STD_LEFT, y);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(title, width / 2, y, { align: 'center' });
    const titleWidth = doc.getTextWidth(title);
    doc.setLineWidth(0.6);
    doc.line(width / 2 - titleWidth / 2, y + 2, width / 2 + titleWidth / 2, y + 2);
    doc.setTextColor(0, 0, 0);
  }

  // Footer on every page: grey rule, generated date/time, copyright, page number
  function drawPlainFooter(doc, pageNo, pages) {
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.8);
    doc.line(STD_LEFT, height - 34, width - STD_LEFT, height - 34);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated ${new Date().toLocaleString()}`, STD_LEFT, height - 22);
    doc.text('© 2026 Imo Chicken & Agro (Pvt) Ltd. MIS Department . All rights reserved.', width / 2, height - 22, { align: 'center' });
    doc.text(`Page ${pageNo} of ${pages}`, width - STD_LEFT, height - 22, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }

  function buildStandardPdf(table, logo) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const period = periodText();
    const title = reportName();

    doc.autoTable({
      head: standardHead(table),
      body: standardBody(table),
      startY: STD_TABLE_TOP,
      margin: { left: STD_LEFT, right: STD_LEFT, top: STD_TABLE_TOP_LATER, bottom: STD_FOOTER_SPACE },
      styles: { fontSize: 7.5, cellPadding: 3, textColor: [15, 23, 42], lineColor: [30, 41, 59], lineWidth: 0.25, valign: 'middle', font: 'helvetica' },
      headStyles: { fillColor: [234, 240, 248], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 7 },
      theme: 'grid',
      didDrawPage: data => {
        drawPlainHeader(doc, logo);
        if (data.pageNumber === 1) drawPlainTitle(doc, period, title);
      }
    });

    const pages = doc.internal.getNumberOfPages();
    for (let page = 1; page <= pages; page += 1) {
      doc.setPage(page);
      drawPlainFooter(doc, page, pages);
    }
    return doc;
  }

  async function exportTablePdf() {
    const table = requireTable();
    if (!table) return;
    await ensurePdfLibraries();
    const logo = await standardLogo();
    const doc = buildStandardPdf(table, logo);
    doc.save(`${fileBase()}.pdf`);
  }

  async function exportBirdsQualityPdf() {
    const sheet = document.getElementById('reportSheet');
    const table = sheet?.querySelector('.report-table');
    if (!sheet || !table || !visible(sheet)) {
      window.alert('Load report data before exporting.');
      return;
    }
    await ensurePdfLibraries();

    const old = { width: sheet.style.width, maxWidth: sheet.style.maxWidth, height: sheet.style.height, overflow: sheet.style.overflow };
    sheet.style.width = `${Math.max(1000, sheet.scrollWidth)}px`;
    sheet.style.maxWidth = 'none';
    sheet.style.height = 'auto';
    sheet.style.overflow = 'visible';

    try {
      const prefix = sheet.querySelector('.report-doc-table');
      const suffix = sheet.querySelector('.report-foot-table');
      const prefixCanvas = prefix ? await capture(prefix) : null;
      const suffixCanvas = suffix ? await capture(suffix) : null;
      const parts = await captureTableParts(table);
      const doc = renderTablePdf(parts, reportName(), prefixCanvas, suffixCanvas);
      doc.save(`${fileBase()}.pdf`);
    } finally {
      sheet.style.width = old.width;
      sheet.style.maxWidth = old.maxWidth;
      sheet.style.height = old.height;
      sheet.style.overflow = old.overflow;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('click', async (event) => {
      const option = event.target.closest('.report-export-option');
      if (!option) return;
      const wrap = option.closest('.report-export-wrap');
      const menu = wrap?.querySelector('.report-export-menu');
      const trigger = wrap?.querySelector('.report-export-trigger');
      if (menu) menu.hidden = true;
      if (trigger) trigger.setAttribute('aria-expanded', 'false');

      try {
        if (option.textContent.includes('CSV')) exportCsv();
        else if (wrap?.dataset.exportPdf === 'full-document') await exportBirdsQualityPdf();
        else await exportTablePdf();
      } catch (error) {
        console.error(error);
        window.alert('Export could not be completed. Please check your connection and try again.');
      }
    });
  });

  // Shared with other report scripts (e.g. the water report PDF) so they get the same header, title and footer
  window.ReportPdf = {
    standardLogo, drawPlainHeader, drawPlainTitle, drawPlainFooter,
    STD_LEFT, STD_TABLE_TOP, STD_TABLE_TOP_LATER, STD_FOOTER_SPACE
  };
})();

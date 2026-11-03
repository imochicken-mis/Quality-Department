// ============================================
// WATER PLANT REPORT (monthly)
// ============================================
const API_URL_WATER = 'https://script.google.com/macros/s/AKfycbxY0TPyoSAOTACaDzjOAwI4y3Fo5Movlx5G6hhROxNBHUpx7cZSRctCRaWNtd1iw4U6/exec';

// Sheet eke 1,2,3 -> report eke pennana text eka
const COLOUR_MAP = { '1': 'Light yellow', '2': 'Yellow', '3': 'Off / brown' };
const SMELL_MAP  = { '1': 'Slightly off smell', '2': 'Off smell', '3': 'Badly smell' };

// Apps Script cold start / HTML error response wela fail unoth auto retry
async function fetchJsonRetry(url, tries = 4) {
  let lastErr;
  const hit = ReportCache.get(url);
  if (hit) return hit;          // cache eke thiyenawanam network ekata yanna epa
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url + '&_r=' + Date.now());
      const text = await res.text();
      const json = JSON.parse(text);
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
  const loadBtn = document.getElementById('loadReportBtn');
  let currentRecords = [];
  if (!monthInput) return;

  // Apps Script eka wake up karanna
  fetch(API_URL_WATER + '?action=ping&_w=' + Date.now()).catch(() => {});

  const restored = ReportCache.restoreInput(monthInput, 'water');
  if (restored) setTimeout(loadReport, 0);   // kalin balapu masaya auto load
  // Default = this month (yyyy-MM)
  if (!monthInput.value) {
    const now = new Date();
    monthInput.value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  }

  loadBtn && loadBtn.addEventListener('click', () => { ReportCache.clear(); loadReport(); });

  const printBtn = document.getElementById('printBtn');
  printBtn && printBtn.addEventListener('click', downloadPdf);
  monthInput.addEventListener('change', loadReport);

  // ===== PDF libraries: HTML eke tags nathnam JS eken load karanawa =====
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(s);
    });
  }

  async function ensurePdfLibs() {
    const ready = () => window.jspdf && window.jspdf.jsPDF &&
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

  // ===== PDF builder (jsPDF + autoTable) =====
  function buildWaterPdf(records, images, month) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const M = 8;                                   // page margin (mm)

    const GREEN = { fill: [209, 242, 228], text: [4, 120, 87] };
    const RED   = { fill: [253, 226, 226], text: [185, 28, 28] };

    // pH / CL cell (green / red)
    function scoreCell(text, cls) {
      const c = { content: String(text == null || text === '' ? '-' : text) };
      if (cls === 'wp-ok')  c.styles = { fillColor: GREEN.fill, textColor: GREEN.text, fontStyle: 'bold' };
      if (cls === 'wp-bad') c.styles = { fillColor: RED.fill,   textColor: RED.text,   fontStyle: 'bold' };
      return c;
    }

    // Yes / No cell -> icon (tick / cross). invert = Leakage
    function ynCell(v, invert) {
      const raw = String(v == null ? '' : v).trim();
      const s = raw.toLowerCase();
      if (s !== 'yes' && s !== 'no') return { content: raw || '-' };
      const good = invert ? s === 'no' : s === 'yes';
      return { content: '', icon: good ? 'tick' : 'cross' };
    }

    function imgCell(url) {
      const id = driveId(url);
      if (id && images[id]) return { content: '', imgId: id };
      return { content: '-' };
    }

    const head = [[
      'DATE', 'PH\n(6.8-8.5)', 'CL\n(<0.5)', 'PARABOLIC\nSCREEN\nCLEANNESS', 'COLOUR', 'SMELL',
      'SOLID WASTE\nBUCKET', 'CHEMICAL\nDOSING', 'LEAKAGE\nM1', 'LEAKAGE\nM2',
      'BACKWASH\nSAND BED', 'BACKWASH\nCLARIFIER', 'REMARKS', 'IMAGE'
    ]];

    const body = records.map(r => [
      formatDate(r.date),
      scoreCell(r.ph, phClass(r.ph)),
      scoreCell(r.cl, clClass(r.cl)),
      ynCell(r.parabolic),
      mapScore(r.colour, COLOUR_MAP),
      mapScore(r.smell, SMELL_MAP),
      r.solidWaste || '-',
      ynCell(r.chemicalDosing),
      ynCell(r.leakageM1, true),
      ynCell(r.leakageM2, true),
      r.backwashSandBed || '-',
      r.backwashClarifier || '-',
      { content: r.remarks || '', styles: { halign: 'left' } },
      imgCell(r.imageUrl)
    ]);

    // ---- Title block (page 1) ----
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Month:', M, 13);
    const w1 = doc.getTextWidth('Month: ');
    doc.setFont('helvetica', 'normal');
    doc.text(formatMonth(month), M + w1, 13);
    const x2 = M + w1 + doc.getTextWidth(formatMonth(month)) + 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Records:', x2, 13);
    const w2 = doc.getTextWidth('Records: ');
    doc.setFont('helvetica', 'normal');
    doc.text(String(records.length), x2 + w2, 13);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    const title = 'Water Plant Report';
    const tw = doc.getTextWidth(title);
    doc.text(title, pageW / 2, 13, { align: 'center' });
    doc.setLineWidth(0.4);
    doc.setDrawColor(15, 23, 42);
    doc.line(pageW / 2 - tw / 2, 14.6, pageW / 2 + tw / 2, 14.6);

    // ---- Table ----
    doc.autoTable({
      head: head,
      body: body,
      startY: 19,
      margin: { top: 10, left: M, right: M, bottom: 14 },
      theme: 'grid',
      tableWidth: 'auto',
      styles: {
        font: 'helvetica', fontSize: 8, cellPadding: 1.4,
        halign: 'center', valign: 'middle',
        lineColor: [51, 65, 85], lineWidth: 0.2,
        textColor: [15, 23, 42], fillColor: [255, 255, 255],
        minCellHeight: 15
      },
      headStyles: {
        fillColor: [238, 242, 247], textColor: [15, 23, 42],
        fontStyle: 'bold', fontSize: 7, minCellHeight: 12
      },
      alternateRowStyles: { fillColor: [241, 245, 249] },
      columnStyles: {
        0:  { cellWidth: 20 },   // Date
        1:  { cellWidth: 15 },   // pH
        2:  { cellWidth: 14 },   // CL
        3:  { cellWidth: 22 },   // Parabolic
        4:  { cellWidth: 22 },   // Colour
        5:  { cellWidth: 28 },   // Smell
        6:  { cellWidth: 18 },   // Solid waste
        7:  { cellWidth: 17 },   // Chemical dosing
        8:  { cellWidth: 16 },   // Leakage M1
        9:  { cellWidth: 16 },   // Leakage M2
        10: { cellWidth: 19 },   // Backwash sand bed
        11: { cellWidth: 20 },   // Backwash clarifier
        12: { cellWidth: 32 },   // Remarks
        13: { cellWidth: 22 }    // Image
      },
      rowPageBreak: 'avoid',
      didDrawCell: function (d) {
        if (d.section !== 'body') return;
        const raw = d.cell.raw;
        if (!raw || typeof raw !== 'object') return;
        const cx = d.cell.x + d.cell.width / 2;
        const cy = d.cell.y + d.cell.height / 2;

        // Yes / No icons
        if (raw.icon) {
          const ok = raw.icon === 'tick';
          const col = ok ? GREEN.text : RED.text;
          const bg  = ok ? GREEN.fill : RED.fill;
          doc.setFillColor(bg[0], bg[1], bg[2]);
          doc.setDrawColor(col[0], col[1], col[2]);
          doc.setLineWidth(0.4);
          doc.circle(cx, cy, 2.6, 'FD');
          if (ok) {
            doc.line(cx - 1.3, cy + 0.1, cx - 0.3, cy + 1.1);
            doc.line(cx - 0.3, cy + 1.1, cx + 1.4, cy - 0.9);
          } else {
            doc.line(cx - 1.2, cy - 1.2, cx + 1.2, cy + 1.2);
            doc.line(cx + 1.2, cy - 1.2, cx - 1.2, cy + 1.2);
          }
        }

        // Image (Drive thumbnail)
        if (raw.imgId && images[raw.imgId]) {
          try {
            const data = images[raw.imgId];
            const fmt = /^data:image\/png/i.test(data) ? 'PNG' : 'JPEG';
            const p = doc.getImageProperties(data);
            const maxW = d.cell.width - 3, maxH = d.cell.height - 3;
            const k = Math.min(maxW / p.width, maxH / p.height);
            const w = p.width * k, h = p.height * k;
            doc.addImage(data, fmt, cx - w / 2, cy - h / 2, w, h);
          } catch (e) { /* image skip */ }
        }
      }
    });

    // ---- Footer (every page) ----
    const pages = doc.internal.getNumberOfPages();
    const pageH = doc.internal.pageSize.getHeight();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text('Imo Chicken & Agro (Pvt) Ltd', M, pageH - 6);
      doc.text('Page ' + i + ' of ' + pages, pageW - M, pageH - 6, { align: 'right' });
    }

    return doc;
  }

  // ===== Download PDF =====
  async function downloadPdf() {
    if (!currentRecords.length) return;

    try {
      await ensurePdfLibs();
    } catch (e) {
      console.error('PDF lib load error:', e);
      alert('PDF library load wenne na. Internet connection eka balanna.');
      return;
    }

    const btn = printBtn;
    const originalHTML = btn.innerHTML;
    btn.innerHTML = 'Generating PDF...';
    btn.disabled = true;

    try {
      // Drive thumbnails -> base64 (Apps Script eken)
      const ids = [...new Set(currentRecords.map(r => driveId(r.imageUrl)).filter(Boolean))];
      let images = {};
      if (ids.length) {
        try {
          const res = await fetchJsonRetry(`${API_URL_WATER}?action=getWaterImages&ids=${encodeURIComponent(ids.join(','))}`);
          images = (res && res.images) || {};
        } catch (e) {
          console.warn('Image fetch failed', e);
        }
      }

      const month = monthInput.value;
      const doc = buildWaterPdf(currentRecords, images, month);
      doc.save('Water-Plant-Report-' + (month || 'report') + '.pdf');

    } catch (err) {
      console.error('PDF error:', err);
      alert('PDF generate wenna bari una. Ayeth try karanna.');
    } finally {
      btn.innerHTML = originalHTML;
      btn.disabled = false;
    }
  }

  // ===== Load report =====
  async function loadReport() {
    const month = monthInput.value;
    if (!month) return;

    const empty = document.getElementById('reportEmpty');
    const loading = document.getElementById('reportLoading');
    const sheet = document.getElementById('reportSheet');

    empty.style.display = 'none';
    sheet.style.display = 'none';
    loading.style.display = 'flex';
    const pb = document.getElementById('printBar');
    if (pb) pb.style.display = 'none';

    try {
      const data = await fetchJsonRetry(`${API_URL_WATER}?action=getWaterDataByMonth&month=${encodeURIComponent(month)}`);
      loading.style.display = 'none';

      if (!data.success || !data.records || data.records.length === 0) {
        empty.style.display = 'flex';
        empty.querySelector('p').textContent = 'No water plant data found for ' + formatMonth(month);
        return;
      }

      renderReport(data.records, month);

    } catch (err) {
      console.error('Water report load error:', err);
      loading.style.display = 'none';
      empty.style.display = 'flex';
      empty.querySelector('p').textContent = 'Error loading report. Please try again.';
    }
  }

  // ===== Render =====
  function renderReport(records, month) {
    const sheet = document.getElementById('reportSheet');
    const tbody = document.getElementById('reportBody');

    records.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    currentRecords = records;

    document.getElementById('rptMonth').textContent = formatMonth(month);
    document.getElementById('rptCount').textContent = records.length;

    tbody.innerHTML = records.map(r => `
      <tr>
        <td class="nowrap">${formatDate(r.date)}</td>
        <td class="${phClass(r.ph)}">${esc(r.ph)}</td>
        <td class="${clClass(r.cl)}">${esc(r.cl)}</td>
        <td>${yesNoIcon(r.parabolic)}</td>
        <td>${esc(mapScore(r.colour, COLOUR_MAP))}</td>
        <td>${esc(mapScore(r.smell, SMELL_MAP))}</td>
        <td>${esc(r.solidWaste)}</td>
        <td>${yesNoIcon(r.chemicalDosing)}</td>
        <td>${yesNoIcon(r.leakageM1, true)}</td>
        <td>${yesNoIcon(r.leakageM2, true)}</td>
        <td>${esc(r.backwashSandBed)}</td>
        <td>${esc(r.backwashClarifier)}</td>
        <td class="left">${esc(r.remarks)}</td>
        <td>${imageCell(r.imageUrl)}</td>
      </tr>`).join('');

    // Drive thumbnail load wenne nathnam "View" link ekak pennanna
    tbody.querySelectorAll('img.wp-thumb').forEach(img => {
      img.addEventListener('error', () => {
        const a = document.createElement('a');
        a.href = img.dataset.full;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = 'View';
        img.parentElement.replaceWith(a);
      });
    });

    sheet.style.display = 'block';
    const pb2 = document.getElementById('printBar');
    if (pb2) pb2.style.display = 'flex';
  }

  // ===== Helpers =====

  // 1,2,3 -> text. Number nathnam (e.g. "Good") ehemama pennanawa
  // pH: 6.8 - 8.5 (eka ekka) athule = green, eliye = red
  function phClass(v) {
    const n = parseFloat(v);
    if (isNaN(n)) return '';
    return (n >= 6.8 && n <= 8.5) ? 'wp-ok' : 'wp-bad';
  }

  // CL: 0.5 ta adu / samana = green, 0.5 ta wadi = red
  function clClass(v) {
    const n = parseFloat(v);
    if (isNaN(n)) return '';
    return n <= 0.1 ? 'wp-ok' : 'wp-bad';
  }

  // Yes / No -> icon. invert = true nam (e.g. Leakage) "No" = hari (green tick), "Yes" = weradi (red cross)
  const ICON_TICK  = '<svg class="wp-ic ok" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" fill="#d1f2e4" stroke="currentColor"></circle><polyline points="7.5 12.5 10.5 15.5 16.5 9"></polyline></svg>';
  const ICON_CROSS = '<svg class="wp-ic bad" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" fill="#fde2e2" stroke="currentColor"></circle><line x1="8.5" y1="8.5" x2="15.5" y2="15.5"></line><line x1="15.5" y1="8.5" x2="8.5" y2="15.5"></line></svg>';

  function yesNoIcon(v, invert) {
    const raw = String(v == null ? '' : v).trim();
    const s = raw.toLowerCase();
    if (!s) return '-';
    if (s !== 'yes' && s !== 'no') return esc(raw);      // Yes/No nathnam ehemama pennanna
    const good = invert ? s === 'no' : s === 'yes';
    return `<span title="${raw}">${good ? ICON_TICK : ICON_CROSS}</span>`;
  }

  function mapScore(v, map) {
    const s = String(v == null ? '' : v).trim();
    if (!s) return '-';
    return map[s] || s;
  }

  function statusBadge(v) {
    const s = String(v == null ? '' : v).trim();
    if (!s) return '-';
    const ok = s.toLowerCase() === 'accept';
    return `<span class="wp-badge ${ok ? 'ok' : 'bad'}">${esc(s)}</span>`;
  }

  // Drive link eken file id eka thumbnail eka hadanawa
  function driveId(url) {
    const s = String(url || '');
    const m = s.match(/\/d\/([\w-]+)/) || s.match(/[?&]id=([\w-]+)/);
    return m ? m[1] : '';
  }

  function imageCell(url) {
    const u = String(url || '').trim();
    if (!u) return '-';
    const id = driveId(u);
    if (!id) return `<a href="${escAttr(u)}" target="_blank" rel="noopener">View</a>`;
    const thumb = `https://drive.google.com/thumbnail?id=${id}&sz=w400`;
    return `<a href="${escAttr(u)}" target="_blank" rel="noopener">` +
           `<img class="wp-thumb" src="${thumb}" data-id="${id}" data-full="${escAttr(u)}" loading="lazy" alt="Water plant photo" /></a>`;
  }

  function formatDate(s) {
    const p = String(s || '').split('-');
    return p.length === 3 ? p[2] + '-' + p[1] + '-' + p[0] : (s || '-');
  }

  function formatMonth(m) {
    const p = String(m || '').split('-');
    if (p.length !== 2) return m || '-';
    const names = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return names[Number(p[1]) - 1] + ' ' + p[0];
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function escAttr(s) {
    return esc(s).replace(/"/g, '&quot;');
  }
});
// ============================================
// BIRDS QUALITY REPORT
// ============================================

const API_URL_REPORT = 'https://script.google.com/macros/s/AKfycbxY0TPyoSAOTACaDzjOAwI4y3Fo5Movlx5G6hhROxNBHUpx7cZSRctCRaWNtd1iw4U6/exec';

// Apps Script cold start / 404 HTML response wela fail unoth auto retry
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
      return json;          // HTML awoth meka throw wenawa -> retry
    } catch (err) {
      lastErr = err;
      await new Promise(r => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw lastErr;
}

document.addEventListener('DOMContentLoaded', () => {
  const dateInput = document.getElementById('reportDate');
  const loadBtn = document.getElementById('loadReportBtn');
  const exportTrigger = document.querySelector('.report-export-trigger');
  const exportMenu = document.querySelector('.report-export-menu');

  if (!dateInput) return;
  exportTrigger && exportTrigger.addEventListener('click', (event) => {
    event.stopPropagation();
    const open = exportMenu && exportMenu.hidden;
    if (exportMenu) exportMenu.hidden = !open;
    if (exportTrigger) exportTrigger.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', () => {
    if (exportMenu) exportMenu.hidden = true;
    if (exportTrigger) exportTrigger.setAttribute('aria-expanded', 'false');
  });

  // Page eka open wenakotama Apps Script eka "wake up" karanawa (cold start eka adu karanna)
  fetch(API_URL_REPORT + '?action=ping&_w=' + Date.now()).catch(() => {});

  const restored = ReportCache.restoreInput(dateInput, 'bq');
  if (restored) setTimeout(loadReport, 0);   // kalin balapu date eka auto load
  // Default = today
  if (!dateInput.value) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }

  loadBtn && loadBtn.addEventListener('click', () => { ReportCache.clear(); loadReport(); });
  dateInput.addEventListener('change', loadReport);
  let currentBatches = [];

  async function loadReport() {
    const date = dateInput.value;
    if (!date) return;

    const empty = document.getElementById('reportEmpty');
    const loading = document.getElementById('reportLoading');
    const sheet = document.getElementById('reportSheet');
    const cacheKey = 'bqReport_' + date;
    let shownFromCache = false;

    empty.style.display = 'none';
    sheet.style.display = 'none';
    loading.style.display = 'flex';

    // 1) kalin thibba data thiyenawanam instant pennanna
    try {
      const cached = JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
      if (cached && cached.length) {
        loading.style.display = 'none';
        currentBatches = cached;
        renderReport(cached, date);
        shownFromCache = true;
      }
    } catch (e) { /* ignore */ }

    // 2) aluth data ganna (background)
    try {
      const data = await fetchJsonRetry(`${API_URL_REPORT}?action=getBirdsQualityByDate&date=${encodeURIComponent(date)}`);
      loading.style.display = 'none';

      if (!data.success || !data.batches || data.batches.length === 0) {
        sheet.style.display = 'none';
        empty.style.display = 'flex';
        empty.querySelector('p').textContent = 'No quality data found for ' + formatDateSL(date);
        return;
      }

      // user remark type karanawanam eka overwrite nokarannna
      currentBatches = data.batches;
      try { sessionStorage.setItem(cacheKey, JSON.stringify(data.batches)); } catch (e) {}
      renderReport(data.batches, date);

    } catch (err) {
      console.error('Report load error:', err);
      if (shownFromCache) return;      // cache eka pennala thiyenawa, error eka pennanna epa
      loading.style.display = 'none';
      empty.style.display = 'flex';
      empty.querySelector('p').textContent = 'Error loading report. Please try again.';
    }
  }

  // ===== Render =====
  function renderReport(batches, date) {
    const sheet = document.getElementById('reportSheet');
    const tbody = document.getElementById('reportBody');

    document.getElementById('rptDate').textContent = formatDateSL(date);
    const batchBox = document.getElementById('rptBatch');
    if (batchBox) batchBox.textContent = batches[0].julianDate || '-';

    tbody.innerHTML = batches.map((b, i) => {
      const quality = [
        b.cleanliness, b.damage, b.skin, b.gizzard, b.crop, b.flesh
      ];

      const qualityCells = quality.map(v => {
        const a = isAccept(v);
        const na = isNotAccept(v);
        return `<td class="${a ? 'mark-a' : (na ? 'mark-na' : '')}">${a ? 'A' : (na ? 'NA' : '-')}</td>`;
      }).join('');

      return `
        <tr>
          <td>${i + 1}</td>
          <td style="text-align:left; padding-left:0.5rem;">${esc(b.farm)}</td>
          <td><strong>${esc(b.batchNo)}</strong></td>
          <td>${esc(b.birds)}</td>
          <td>${fmtWeight(b.avgWt)}</td>
          <td></td>
          ${qualityCells}
          <td>${esc(b.doa)}</td>
          <td>${esc(b.bayMortality)}</td>
          <td><span class="report-remark-text">${esc(b.remark)}</span></td>
        </tr>`;
    }).join('');

    sheet.style.display = 'block';
  }

  // ===== Accept / Not Accept helpers =====
  function isAccept(v) {
    return String(v || '').trim().toLowerCase() === 'accept';
  }

  function isNotAccept(v) {
    const s = String(v || '').trim().toLowerCase();
    return s === 'not accept' || s === 'notaccept' || s === 'not_accept';
  }
  // ===== Helpers =====
  // Average weight -> decimal 2k walata (2.253 -> 2.25). Number nathnam ehemama pennanawa
  function fmtWeight(v) {
    if (v === '' || v == null) return '';
    const n = parseFloat(v);
    return isNaN(n) ? esc(v) : n.toFixed(2);
  }

  function formatDateSL(dateStr) {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length === 3) return parts[2] + '-' + parts[1] + '-' + parts[0];
    return dateStr;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function escAttr(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
});





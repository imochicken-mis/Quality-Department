const API_URL_BIRDS_REPORT = 'https://script.google.com/macros/s/AKfycbxY0TPyoSAOTACaDzjOAwI4y3Fo5Movlx5G6hhROxNBHUpx7cZSRctCRaWNtd1iw4U6/exec';

document.addEventListener('DOMContentLoaded', () => {
  const dateInput = document.getElementById('birdsReportDate');
  const loadButton = document.getElementById('loadBirdsReportBtn');
  if (!dateInput) return;
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cell = v => v === '' || v == null ? '<span class="birds-data-empty">—</span>' : esc(v);
  const dateText = v => { const p = String(v || '').split('-'); return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : '—'; };
  if (!dateInput.value) dateInput.value = new Date().toISOString().slice(0, 10);
  loadButton?.addEventListener('click', loadReport);
  dateInput.addEventListener('change', loadReport);
  window.addEventListener('resize', fitTableToViewport);
  document.addEventListener('fullscreenchange', () => requestAnimationFrame(fitTableToViewport));

  function fitTableToViewport() {
    const wrap = document.querySelector('.birds-data-table-wrap');
    if (!wrap || wrap.offsetParent === null) return;
    const height = Math.max(180, window.innerHeight - wrap.getBoundingClientRect().top - 42);
    wrap.style.height = height + 'px';
    wrap.style.maxHeight = height + 'px';
  }
  async function loadReport() {
    const date = dateInput.value;
    if (!date) return;
    $('birdsReportEmpty').style.display = 'none';
    $('birdsReportSheet').style.display = 'none';
    $('birdsReportLoading').style.display = 'flex';
    try {
      const response = await fetch(`${API_URL_BIRDS_REPORT}?action=getLivebirdByDate&date=${encodeURIComponent(date)}&_r=${Date.now()}`, { cache: 'no-store' });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Unable to load report');
      const rows = data.batches || [];
      const total = rows.reduce((sum, row) => sum + (Number(String(row.birdQty || '').replace(/,/g, '')) || 0), 0);
      $('birdsRptDate').textContent = dateText(date);
      $('birdsRptLoads').textContent = rows.length;
      $('birdsRptQty').textContent = total.toLocaleString();
      $('birdsReportBody').innerHTML = rows.map((r, i) => `<tr><td>${i + 1}</td><td>${dateText(date)}</td><td>${cell(r.loadNo)}</td><td>${cell(r.farmer)}</td><td>${cell(r.batchNo)}</td><td class="birds-data-qty">${cell(r.birdQty)}</td><td>${cell(r.hangingTime)}</td></tr>`).join('');
      $('birdsReportLoading').style.display = 'none';
      if (!rows.length) { $('birdsReportEmpty').innerHTML = `<p>No birds data found for ${esc(dateText(date))}</p>`; $('birdsReportEmpty').style.display = 'flex'; return; }
      $('birdsReportSheet').style.display = 'block';
      requestAnimationFrame(fitTableToViewport);
    } catch (error) {
      console.error('Birds data report error:', error);
      $('birdsReportLoading').style.display = 'none';
      $('birdsReportEmpty').innerHTML = '<p>Failed to load birds data. Please try again.</p>';
      $('birdsReportEmpty').style.display = 'flex';
    }
  }
});
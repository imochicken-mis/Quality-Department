// ============================================
// MASTER REPORT (monthly) - Admin
// Livebird + SlaughterData + EVData + PackingData merged by date
// ============================================
const API_URL_MASTER = 'https://script.google.com/macros/s/AKfycbxY0TPyoSAOTACaDzjOAwI4y3Fo5Movlx5G6hhROxNBHUpx7cZSRctCRaWNtd1iw4U6/exec';

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
      await new Promise(r => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw lastErr;
}

document.addEventListener('DOMContentLoaded', () => {
  const monthInput = document.getElementById('reportMonth');
  const loadBtn = document.getElementById('loadReportBtn');
  const dateFilterButton = document.getElementById('ccpDateFilterButton');
  const dateFilterMenu = document.getElementById('ccpDateFilterMenu');
  const dateFilterAll = document.getElementById('ccpDateFilterAll');
  const dateFilterOptions = document.getElementById('ccpDateFilterOptions');
  const dateFilterApply = document.getElementById('ccpDateFilterApply');
  const dateFilterCancel = document.getElementById('ccpDateFilterCancel');
  let reportDays = [];
  let selectedDates = new Set();
  if (!monthInput) return;

  const $ = id => document.getElementById(id);
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const val = v => {
    if (v === '' || v == null || Number(v) === 0) {
      return '<span class="mr-no">-</span>';
    }
    return esc(v);
  };


  const restored = ReportCache.restoreInput(monthInput, 'master');
  if (restored) setTimeout(loadReport, 0);
  if (!monthInput.value) {
    const n = new Date();
    monthInput.value = n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0');
  }
  loadBtn && loadBtn.addEventListener('click', () => { ReportCache.clear(); loadReport(); });
  monthInput.addEventListener('change', loadReport);
  dateFilterButton && dateFilterButton.addEventListener('click', event => {
    event.stopPropagation();
    if (!dateFilterMenu.hidden) {
      closeDateFilterMenu();
      return;
    }
    prepareDateFilterDraft();
    dateFilterMenu.hidden = false;
    positionDateFilterMenu();
    dateFilterButton.setAttribute('aria-expanded', 'true');
  });
  dateFilterMenu && dateFilterMenu.addEventListener('click', event => event.stopPropagation());
  dateFilterAll && dateFilterAll.addEventListener('change', () => {
    dateOptionCheckboxes().forEach(box => { box.checked = dateFilterAll.checked; });
  });
  dateFilterOptions && dateFilterOptions.addEventListener('change', syncShowAllCheckbox);
  dateFilterApply && dateFilterApply.addEventListener('click', applyDateFilter);
  dateFilterCancel && dateFilterCancel.addEventListener('click', closeDateFilterMenu);
  document.addEventListener('click', closeDateFilterMenu);
  window.addEventListener('resize', positionDateFilterMenu);
  window.addEventListener('scroll', positionDateFilterMenu, true);

  // "HH:mm[:ss]" -> minutes, or null
  function toMin(t) {
    const m = String(t || '').match(/^(\d{1,2}):(\d{2})/);
    return m ? (+m[1]) * 60 + (+m[2]) : null;
  }

  // CCP Start Time comes from the earliest Hanging Time recorded that day.
  function earliestHangingTime(batches) {
    return (batches || [])
      .map(batch => ({
        time: String(batch && batch.hangingTime || '').trim(),
        minutes: toMin(batch && batch.hangingTime)
      }))
      .filter(entry => entry.minutes !== null)
      .sort((a, b) => a.minutes - b.minutes)[0]?.time || '';
  }

  // Hanging Time -> Blast Freezer Time (crosses midnight if freezer < hanging)
  function gap(hang, freezer) {
    const a = toMin(hang), b = toMin(freezer);
    if (a == null || b == null) return '';
    let d = b - a;
    if (d < 0) d += 24 * 60;
    return String(Math.floor(d / 60)).padStart(2, '0') + ':' + String(d % 60).padStart(2, '0');
  }

  const items = list => (list && list.length)
    ? list.map((x, i) => '<span class="mr-lot"><span>' + (i + 1) + '. ' + esc(x.item) + '</span><em>' + esc(x.kilos) + ' kg</em></span>').join('')
    : '<span class="mr-no">-</span>';

  function dayRows(day) {
    const batches = day.batches || [];
    const s = day.slaughter, ev = day.ev, p = day.packing;
    const startTime = earliestHangingTime(batches);
    const totalBirds = batches.reduce((sum, batch) => sum + (parseInt(batch && batch.birdQty, 10) || 0), 0);
    const sv = k => s ? val(s[k]) : val('');
    const ev_ = k => ev ? val(ev[k]) : val('');
    const pv = k => p ? val(p[k]) : val('');
    const d = (html, cls) => '<td class="mr-day ' + (cls || '') + '">' + html + '</td>';

    let tr = '<tr>';
    tr += d(esc(day.date), 'mr-date');
    tr += d(val(totalBirds));
    tr += d(startTime);

    ['scalderTemp', 'scalderTime', 'waterSupply', 'noLabours', 'labourGap']
      .forEach(k => { tr += d(sv(k)); });
    tr += d(sv('remarks'), 'mr-wrap');

    ['ventCutting', 'cavityRemoval', 'washingPoints', 'noLabours', 'labourPositioning', 'gizzardTemp']
      .forEach(k => {
        tr += d(ev_(k));
      });

    ['liverTemp', 'chlorine7am', 'chlorine1pm', 'labourTotal', 'manpowerLabours']
      .forEach(k => {
        tr += d(pv(k));
      });

    tr += d(p ? items(p.delayedLots) : val(''), 'mr-wrap');
    tr += d(p ? val(p.remarks) : val(''), 'mr-wrap');
    return tr + '</tr>';
  }
  function dateOptionCheckboxes() {
    return Array.from(dateFilterOptions?.querySelectorAll('input[type="checkbox"]') || []);
  }

  function syncShowAllCheckbox() {
    const boxes = dateOptionCheckboxes();
    if (!dateFilterAll) return;
    dateFilterAll.checked = boxes.length > 0 && boxes.every(box => box.checked);
    dateFilterAll.indeterminate = boxes.some(box => box.checked) && !dateFilterAll.checked;
  }

  function setDateFilterOptions(days) {
    if (!dateFilterOptions) return;
    selectedDates.clear();
    dateFilterOptions.innerHTML = days.map(day =>
      '<label><input type="checkbox" value="' + esc(day.date) + '" checked> <span>' + esc(day.date) + '</span></label>'
    ).join('');
    if (dateFilterAll) {
      dateFilterAll.checked = true;
      dateFilterAll.indeterminate = false;
    }
    dateFilterButton?.classList.remove('is-filtered');
  }

  function prepareDateFilterDraft() {
    const showAll = selectedDates.size === 0;
    dateOptionCheckboxes().forEach(box => {
      box.checked = showAll || selectedDates.has(box.value);
    });
    syncShowAllCheckbox();
  }

  function positionDateFilterMenu() {
    if (!dateFilterButton || !dateFilterMenu || dateFilterMenu.hidden) return;

    const gap = 7;
    const edge = 8;
    const buttonRect = dateFilterButton.getBoundingClientRect();
    const menuWidth = dateFilterMenu.offsetWidth || 225;
    const menuHeight = dateFilterMenu.offsetHeight;
    const maxLeft = Math.max(edge, window.innerWidth - menuWidth - edge);
    const left = Math.min(Math.max(edge, buttonRect.left - 24), maxLeft);
    const below = buttonRect.bottom + gap;
    const top = below + menuHeight <= window.innerHeight - edge
      ? below
      : Math.max(edge, buttonRect.top - menuHeight - gap);

    dateFilterMenu.style.left = `${Math.round(left)}px`;
    dateFilterMenu.style.top = `${Math.round(top)}px`;
  }
  function closeDateFilterMenu() {
    if (!dateFilterMenu) return;
    dateFilterMenu.hidden = true;
    dateFilterButton?.setAttribute('aria-expanded', 'false');
  }

  function applyDateFilter() {
    const boxes = dateOptionCheckboxes();
    const checked = boxes.filter(box => box.checked).map(box => box.value);
    selectedDates = checked.length === boxes.length ? new Set() : new Set(checked);
    dateFilterButton?.classList.toggle('is-filtered', selectedDates.size > 0);
    renderFilteredDays();
    closeDateFilterMenu();
  }

  function renderFilteredDays() {
    const filteredDays = selectedDates.size
      ? reportDays.filter(day => selectedDates.has(day.date))
      : reportDays;
    $('reportBody').innerHTML = filteredDays.map(dayRows).join('');
  }
  async function loadReport() {
    const month = monthInput.value;
    if (!month) return;
    $('reportEmpty').style.display = 'none';
    $('reportSheet').style.display = 'none';
    $('reportLoading').style.display = 'flex';

    try {
      const res = await fetchJsonRetry(API_URL_MASTER + '?action=getMonthlyMasterReport&month=' + encodeURIComponent(month) + '&_fresh=' + Date.now());
      if (!res.success) throw new Error(res.error || 'Failed to load');

      const days = res.days || [];
      let batches = 0, birds = 0;
      days.forEach(d => d.batches.forEach(b => { batches++; birds += parseInt(b.birdQty, 10) || 0; }));

      $('rptMonth').textContent = month;
      $('rptDays').textContent = days.length;
      $('rptBatches').textContent = batches;
      $('rptBirds').textContent = birds.toLocaleString();
      reportDays = days;
      setDateFilterOptions(reportDays);
      renderFilteredDays();

      $('reportLoading').style.display = 'none';
      if (!days.length) {
        $('reportEmpty').innerHTML = '<p>No data found for ' + esc(month) + '</p>';
        $('reportEmpty').style.display = '';
        return;
      }
      $('reportSheet').style.display = '';
    } catch (err) {
      console.error('Master report error:', err);
      $('reportLoading').style.display = 'none';
      $('reportEmpty').innerHTML = '<p>Failed to load report. Please try again.</p>';
      $('reportEmpty').style.display = '';
    }
  }
});

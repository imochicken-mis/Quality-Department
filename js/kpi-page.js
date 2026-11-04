/* ============================================================
   KPI PAGE (shared)  -  js/kpi-page.js
   Fills the summary cards, progress bar and formula of a KPI page.
   Each KPI page calls KpiPage.init(config) from its own js file.

   Backend contract (Apps Script):
     ?action=<action>&month=YYYY-MM
       -> { success, kpi:'1.23%', numerator, denominator }

   KpiPage.init({
     prefix:      'kpi3',         // element id prefix (kpi3Month, kpi3Rate, ...)
     action:      'getKpi3',      // month summary action
     target:      0.5,            // KPI standard
     better:      'lower' | 'higher',
     scaleMax:    1,              // progress bar runs 0 .. scaleMax
     decimals:    2,
     numField:    'numerator',    // response field for the formula numerator (default)
     denField:    'denominator'   // response field for the formula denominator (default)
   });
   ============================================================ */
(function () {
  'use strict';

  const API_URL = 'https://script.google.com/macros/s/AKfycbxY0TPyoSAOTACaDzjOAwI4y3Fo5Movlx5G6hhROxNBHUpx7cZSRctCRaWNtd1iw4U6/exec';
  // Retries only when the connection itself drops (Failed to fetch), not when the server answers
  async function getJson(action, month) {
    let lastError;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const url = `${API_URL}?action=${action}&month=${encodeURIComponent(month)}&_r=${Date.now()}`;
        const response = await fetch(url, { cache: 'no-store' });
        return await response.json();
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
      }
    }
    throw lastError;
  }

  function init(cfg) {
    const byId = (suffix) => document.getElementById(cfg.prefix + suffix);
    const month = byId('Month');
    if (!month) return;


    const el = {
      rate: byId('Rate'),
      variance: byId('Variance'),
      status: byId('Status'),
      progress: byId('Progress'),
      actualLabel: byId('ActualLabel'),
      actualMarker: byId('ActualMarker'),
      num: byId('Num'),
      den: byId('Den'),
      result: byId('Result')
    };
    const dec = cfg.decimals == null ? 2 : cfg.decimals;
    // Colour stops, written in each KPI's config as bands: [[value, colour], ...] in the value's own units.
    // Each colour runs up to its value; the last colour runs to the end of the track.
    // Without bands, the default mix is used: lower is better = solid green, then red at the far end;
    // higher is better = red at the left, green from the target on.
    const t = cfg.target / cfg.scaleMax * 100;
    const trackGradient = cfg.bands
      ? `linear-gradient(90deg,${cfg.bands.map(([v, c]) => `${c} ${v / cfg.scaleMax * 100}%`).join(',')},${cfg.bands[cfg.bands.length - 1][1]} 100%)`
      : cfg.better === 'lower'
        ? `linear-gradient(90deg,#16a34a 0%,#16a34a ${Math.min(t, 70)}%,#dc2626 100%)`
        : `linear-gradient(90deg,#dc2626 0%,#f87171 ${t * 0.4}%,#facc15 ${t * 0.75}%,#4ade80 ${t * 0.9}%,#16a34a ${t}%,#16a34a 100%)`;
    const numField = cfg.numField || 'numerator';
    const denField = cfg.denField || 'denominator';
    const fmt = (value) => value.toFixed(dec) + '%';
    // Formula figures: at most 2 decimals, so 59692.77000000001 shows as 59692.77
    const fmtNum = (value) => value == null || value === '' || !Number.isFinite(Number(value)) ? '-' : String(Math.round(Number(value) * 100) / 100);
    const isAchieved = (value) => cfg.better === 'lower' ? value <= cfg.target : value >= cfg.target;
    const parseKpi = (data) => Number(String(data.kpi || '').replace('%', '').trim());


    // Target marker sits on the standard position of the 0 .. scaleMax track
    const targetMarker = document.querySelector('.kpi-target-marker');
    if (targetMarker) targetMarker.style.left = (cfg.target / cfg.scaleMax * 100) + '%';

    // Each KPI page keeps its own last month for this browser tab (sessionStorage)
    const MONTH_KEY = 'kpiMonth:' + cfg.prefix;
    const savedMonth = (() => { try { return sessionStorage.getItem(MONTH_KEY) || ''; } catch (_) { return ''; } })();
    const saveMonth = (value) => { try { sessionStorage.setItem(MONTH_KEY, value); } catch (_) { /* storage blocked: skip */ } };
    const now = new Date();
    month.value = /^\d{4}-\d{2}$/.test(savedMonth) ? savedMonth : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    function setLoading(on) {
      document.querySelectorAll('.kpi-summary-card').forEach((c) => c.classList.toggle('kpi-loading', on));
      if (on) {
        if (el.rate) el.rate.textContent = '…';
        if (el.variance) el.variance.textContent = '…';
        if (el.status) el.status.textContent = '…';
      }
    }

    function fillSummary(data) {
      const value = parseKpi(data);
      // No data for this month (no value, or a denominator of 0): show the standard only, not 0 or Achieved
      const denominator = data[denField];
      if (!Number.isFinite(value) || (denominator !== undefined && !(Number(denominator) > 0))) {
        clearSummary();
        return;
      }
      const valid = Number.isFinite(value);
      const achieved = valid && isAchieved(value);

      if (el.rate) el.rate.textContent = valid ? fmt(value) : (data.kpi || '-');
      if (el.num) el.num.textContent = fmtNum(data[numField]);
      if (el.den) el.den.textContent = fmtNum(data[denField]);
      if (el.result) el.result.textContent = valid ? fmt(value) : '-';

      if (el.variance) {
        const delta = value - cfg.target;
        el.variance.textContent = valid ? (delta >= 0 ? '+' : '') + delta.toFixed(dec) + '%' : '-';
      }
      if (el.status) el.status.textContent = achieved ? 'Achieved' : valid ? 'Not Achieved' : '-';

      const pct = valid ? Math.max(0, Math.min(100, value / cfg.scaleMax * 100)) : 0;
      if (el.progress) {
        el.progress.style.width = pct + '%';
        // The mix is stretched to the full track, so the fill shows only the part of it that it reaches
        el.progress.style.background = trackGradient;
        el.progress.style.backgroundSize = pct > 0 ? (10000 / pct) + '% 100%' : '100% 100%';
        el.progress.style.backgroundPosition = 'left center';
      }
      if (el.actualLabel) el.actualLabel.textContent = valid ? fmt(value) + ' (Actual)' : '- (Actual)';
      if (el.actualMarker) el.actualMarker.style.left = pct + '%';

      document.querySelector('.kpi-value-card')?.classList.toggle('is-achieved', achieved);
      document.querySelector('.kpi-value-card')?.classList.toggle('is-below-target', valid && !achieved);
      document.querySelector('.kpi-variance-card')?.classList.toggle('is-achieved', achieved);
      document.querySelector('.kpi-variance-card')?.classList.toggle('is-below-target', valid && !achieved);
      document.querySelector('.kpi-status-card')?.classList.toggle('is-achieved', achieved);
      document.querySelector('.kpi-status-card')?.classList.toggle('is-below-target', valid && !achieved);
    }

    function clearSummary() {
      if (el.rate) el.rate.textContent = '-';
      if (el.variance) el.variance.textContent = '-';
      if (el.status) el.status.textContent = '-';
      if (el.progress) el.progress.style.width = '0%';
      if (el.actualLabel) el.actualLabel.textContent = '- (Actual)';
      if (el.actualMarker) el.actualMarker.style.left = '0%';
      ['num', 'den', 'result'].forEach((key) => { if (el[key]) el[key].textContent = '-'; });
      document.querySelectorAll('.kpi-value-card, .kpi-variance-card, .kpi-status-card')
        .forEach((c) => c.classList.remove('is-achieved', 'is-below-target'));
    }

    async function loadSummary() {
      if (!month.value) return;
      setLoading(true);
      try {
        const data = await getJson(cfg.action, month.value);
        if (!data.success) throw new Error(data.error || 'KPI data unavailable');
        fillSummary(data);
      } catch (error) {
        console.error(cfg.prefix + ' load error:', error);
        clearSummary();
      } finally {
        setLoading(false);
      }
    }

    // Day-wise line chart and table under the summary. Needs cfg.dailyAction and the trend panel in the page.
    async function loadDaily() {
      const chart = byId('DailyChart');
      const table = byId('DailyTable');
      if (!chart || !cfg.dailyAction) return;
      try {
        const data = await getJson(cfg.dailyAction, month.value);
        // Backend lists only days that have data. Every day of the month gets a column; days without data stay empty
        const byDate = {};
        if (data.success) (data.days || []).forEach((d) => { byDate[d.date] = d; });
        const [year, mon] = month.value.split('-').map(Number);
        const dayCount = new Date(year, mon, 0).getDate();
        const rows = Array.from({ length: dayCount }, (_, i) => {
          const key = `${month.value}-${String(i + 1).padStart(2, '0')}`;
          const d = byDate[key];
          return {
            label: String(i + 1).padStart(2, '0'),
            title: key,
            value: d ? parseFloat(d.kpi) : null,
            numerator: d ? (d.numerator ?? d.complaints) : null,
            denominator: d ? (d.denominator ?? d.sold) : null
          };
        });
        KpiTrend.mount({
          chart: chart,
          table: table,
          rows: rows,
          target: cfg.target,
          better: cfg.better,
          decimals: dec,
          detailDecimals: cfg.detailDecimals,
          standardLabel: cfg.standardLabel || '',
          cornerLabel: 'Date',
          kpiLabel: cfg.kpiLabel || 'KPI (%)',
          details: [
            { label: cfg.denLabel || 'Denominator', get: (r) => r.denominator, color: '#60a5fa' },
            { label: cfg.numLabel || 'Numerator', get: (r) => r.numerator, color: '#ef4444' }
          ]
        });
      } catch (error) {
        console.error(cfg.prefix + ' daily load error:', error);
        KpiTrend.clear(chart, table);
      }
    }

    // Month-wise line chart for the selected year: one summary call per month, same as KPI 01
    async function loadMonthly() {
      const chart = byId('MonthlyChart');
      const table = byId('MonthlyTable');
      if (!chart || !month.value) return;
      const year = Number(month.value.slice(0, 4));
      const labelOf = (monthNo) => new Date(year, monthNo - 1, 1).toLocaleDateString('en-US', { month: 'short' });
      try {
        const rows = await Promise.all(Array.from({ length: 12 }, async (_, i) => {
          const key = `${year}-${String(i + 1).padStart(2, '0')}`;
          let data = {};
          try { data = await getJson(cfg.action, key); } catch (_) { data = {}; }
          return {
            label: labelOf(i + 1),
            title: `${labelOf(i + 1)} ${year}`,
            value: parseKpi(data),
            numerator: data[numField] ?? data.complaints,
            denominator: data[denField] ?? data.sold
          };
        }));
        KpiTrend.mount({
          chart: chart,
          table: table,
          rows: rows,
          target: cfg.target,
          better: cfg.better,
          decimals: dec,
          detailDecimals: cfg.detailDecimals,
          standardLabel: cfg.standardLabel || '',
          cornerLabel: 'Month',
          kpiLabel: cfg.kpiLabel || 'KPI (%)',
          details: [
            { label: cfg.denLabel || 'Denominator', get: (r) => r.denominator, color: '#60a5fa' },
            { label: cfg.numLabel || 'Numerator', get: (r) => r.numerator, color: '#ef4444' }
          ]
        });
      } catch (error) {
        console.error(cfg.prefix + ' monthly load error:', error);
        KpiTrend.clear(chart, table);
      }
    }

    month.addEventListener('change', () => { saveMonth(month.value); loadSummary(); loadDaily(); loadMonthly(); });
    loadSummary();
    loadDaily();
    loadMonthly();
  }

  window.KpiPage = { init: init };
})();
